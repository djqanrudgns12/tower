"""기계·바위 원본 폴더를 찾아 검수한 개체를 종족별로 묶는다."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory

from cut_parts import cut, normalize_reference, open_rgba, orient_parts, read_guide
from fit_parts import fit
from monsters import ACTORS, export, prepare, read_json
from pilot import write_json
from review import review_images

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / "asset-source/r6/monsters"
PUBLIC = ROOT / "public/assets/r6/monsters"
CATALOG = ROOT / "src/game/r6/monsters"
REVIEW = ROOT / "docs/renewal/r6/tech/monsters"
CACHE = ROOT / ".orchestrate/r6-monster-batch"
SPECIES = ("machine", "stone")
ATLAS_BUDGET = 768 * 1024


def digest(*values):
    h = hashlib.sha256()
    for value in values:
        data = value.read_bytes() if isinstance(value, Path) else json.dumps(value, sort_keys=True).encode()
        h.update(len(data).to_bytes(8, "big"))
        h.update(data)
    return h.hexdigest()


def publish(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != data:
        with TemporaryDirectory(dir=path.parent) as temp:
            staged = Path(temp) / path.name
            staged.write_bytes(data)
            staged.replace(path)


def save(path, data):
    publish(path, (json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode())


def actor_id(meta):
    rig = f"{meta['species']}-{meta['entry']}"
    return rig if meta["entry"].startswith("boss-") else rig + "-" + meta["skin"].lower()


def process_actor(folder, canonical, first_targets):
    meta = read_json(folder / "parts.json")
    species, entry, skin = folder.relative_to(SOURCE).parts
    if (species, entry, skin) != tuple(meta[k] for k in ("species", "entry", "skin")):
        raise ValueError(f"폴더와 개체 식별자가 다릅니다 · {folder}")
    guide = SOURCE / "_guides" / meta["guide"]
    sheet, assembly = folder / "sheet.png", folder / "assembly.png"
    placement_path = folder / "placement.json"
    placement = read_json(placement_path) if placement_path.exists() else {}
    if first_targets and "targets" not in placement:
        placement["targets"] = {name: box for name, box in first_targets.items() if name in meta["slots"]}
    placement.update(scale=meta["scale"], armless=meta.get("armless", False))
    inputs = digest(folder / "parts.json", sheet, assembly, guide, canonical, HERE / "fit_parts.py",
                    HERE / "cut_parts.py", HERE / "part_guides.py", HERE / "parts.py")
    config = {k: v for k, v in placement.items() if k not in ("fitKey", "fitScores")}
    if placement.get("fitKey") != digest(inputs, config):
        template = read_json(guide)
        issues = []
        pieces = read_guide(open_rgba(sheet), template, issues)
        if not any(i.get("blocking") for i in issues) and set(pieces) == set(meta["slots"]):
            orient_parts(pieces, placement.get("rotations", {}))
            placement["fitScores"] = fit(pieces, template, normalize_reference(open_rgba(assembly), {}),
                                         placement, canonical)
        else:
            placement["fitScores"] = []
        config = {k: v for k, v in placement.items() if k not in ("fitKey", "fitScores")}
        placement["fitKey"] = digest(inputs, config)
        save(placement_path, placement)
    work = CACHE / species / entry / skin / placement["fitKey"]
    if not (work / "report.json").exists():
        cut(sheet, assembly, guide, work, species, entry, skin, placement_path)
    report = read_json(work / "report.json")
    missing = set(report["parts"]) ^ set(meta["slots"])
    if missing:
        report["issues"].append({"code": "slot_manifest_mismatch", "slots": sorted(missing)})
        report["ready"] = False
    report["fitScores"] = placement["fitScores"]
    report["accepted"] = report["ready"] and report["silhouetteIoU"] >= .70
    if not report["accepted"]:
        report["redo"] = placement.get("redoNote") or redo_reason(work, report)
    save(folder / "report.json", report)
    return meta, report, work


def redo_reason(work, report):
    if not report["ready"]:
        return "시트와 슬롯 명세 확인 · " + str(report["issues"])
    from PIL import ImageChops, ImageStat
    ref, preview = [open_rgba(work / f"assembly-{kind}.webp").getchannel("A") for kind in ("reference", "preview")]
    errors = ImageChops.difference(ref, preview)
    def difference(name):
        box = report["parts"][name]["placedBox"]
        return ImageStat.Stat(errors.crop(box)).sum[0]
    names = sorted(report["parts"], key=difference, reverse=True)[:3]
    return f"{', '.join(names)} 부위를 같은 자세·비율로 다시 분리해 주세요. 두 차례 정렬 후 IoU {report['silhouetteIoU']:.3f}."


def pack_species(species, items):
    accepted = [(m, r, w) for m, r, w in items if r["accepted"]]
    if not accepted:
        return None
    # 변경된 개체만 절단·정렬하고, 아틀라스는 달라진 종족만 다시 묶는다.
    key = digest([(m, r, w.name) for m, r, w in accepted],
                 *(HERE / f for f in ("monsters.py", "rigs.py", "pilot.py", "check-runtime.mjs")))
    cache = CACHE / species / "packs" / key
    if not (cache / "export/motion-report.json").exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        with TemporaryDirectory(dir=cache.parent) as tmp:
            source, work = Path(tmp) / "source", Path(tmp) / "work"
            profiles, available = {}, {}
            for meta, report, single in accepted:
                entry, skin = meta["entry"], meta["skin"]
                config = read_json(single / "species.json")
                profile = profiles.setdefault(entry, {"variant": config["rigs"][entry]["variant"],
                                                       "pivots": report["pivots"], "armlessSkins": []})
                if config["rigs"][entry]["variant"] != profile["variant"] or profile["pivots"] != report["pivots"]:
                    raise ValueError(f"{species}/{entry}/{skin} · T1 관절이나 보행 틀이 다릅니다.")
                if meta.get("armless"):
                    profile["armlessSkins"].append(skin)
                available.setdefault(entry, []).append(skin)
                shutil.copytree(single / entry / skin, source / entry / skin)
            config["rigs"] = profiles
            write_json(source / "species.json", config)
            prepare(source, work, available=available)
            export(work, "spine-cli", rig_cache=CACHE / species / "rigs")
            subprocess.run(["node", HERE / "check-runtime.mjs", work], check=True)
            shutil.copyfile(source / "species.json", work / "species.json")
            work.rename(cache)
    publish(SOURCE / species / "species.json", (cache / "species.json").read_bytes())
    stats = read_json(cache / "export/atlas-report.json")
    if stats["bytes"] > ATLAS_BUDGET:
        raise ValueError(f"{species} · 아틀라스 전송 예산 초과 {stats['bytes']}")
    for file in sorted((cache / "export" / species).iterdir()):
        if file.suffix in (".webp", ".atlas", ".json"):
            data = file.read_bytes()
            if file.suffix == ".json":
                exported = read_json(file)
                exported["skeleton"].pop("images", None)
                exported["skeleton"].pop("audio", None)
                data = (json.dumps(exported, separators=(",", ":")) + "\n").encode()
            publish(PUBLIC / species / file.name, data)
    fragment = read_json(cache / "manifest-fragment.json")
    actors = fragment["species"][species]["entities"]
    for meta, _, _ in accepted:
        actors[actor_id(meta)]["scale"] = meta["scale"]
    save(CATALOG / f"{species}.json", {"atlas": f"monsters/{species}/{species}.atlas",
         "rigs": {k: {**v, "file": "monsters/" + v["file"]} for k, v in fragment["rigs"].items()},
         "entities": actors})
    return cache


def write_summary(rows, atlases, comparisons):
    table = ["| 종족 | 개체 | 조립 IoU | 슬롯 | 내보낸 동작 |",
             "| --- | --- | ---: | ---: | --- |"]
    for row in rows:
        clips = "걷기·피격·쓰러짐" if row["accepted"] else "조립 재요청"
        if row["accepted"] and row["entry"].startswith("boss-"):
            clips += "·기술"
        table.append(f"| {row['species']} | {row['entry']}/{row['skin']} | {row['iou']:.3f} | {row['slots']} | {clips} |")
    table.append("")
    for species, stats in atlases.items():
        table.append(f"- `{species}` 아틀라스 {stats['width']}×{stats['height']}, WebP {stats['bytes']:,}바이트, "
                     f"RGBA8 {stats['rgbaBytes']:,}바이트.")
    if comparisons:
        adjacent = comparisons["evolution"]
        cross = comparisons["crossSpecies"]
        table.append(f"- 인접 단계 {len(adjacent)}쌍 중 {sum(not p['pass'] for p in adjacent)}쌍, "
                     f"종족 간 {sum(g['comparisons'] for g in cross)}쌍 중 "
                     f"{sum(len(g['failures']) for g in cross)}쌍이 32px 구분 기준에 미달했다.")
    doc = REVIEW.parent / "monster-pipeline.md"
    begin, end = "<!-- monster-batch:begin -->", "<!-- monster-batch:end -->"
    before, rest = doc.read_text().split(begin)
    _, after = rest.split(end)
    publish(doc, (before + begin + "\n\n" + "\n".join(table) + "\n\n" + end + after).encode())


def batch_signature():
    # 최신 묶음은 파일을 읽어 대조한 뒤 자원 대기열에 들어가지 않고 끝낸다.
    files = list(HERE.glob("*.py")) + [HERE / "check-runtime.mjs", REVIEW.parent / "monster-pipeline.md"]
    files += list((SOURCE / "_guides").glob("*.json"))
    for species in SPECIES:
        folder = SOURCE / species
        for name in ("sheet.png", "assembly.png", "parts.json", "placement.json", "report.json"):
            files.extend(folder.glob("*/*/" + name))
        files.extend(p for p in (folder / "REDO.md", folder / "species.json", CATALOG / f"{species}.json") if p.exists())
        files.extend(p for p in (PUBLIC / species).glob("*") if p.is_file())
    files.extend(p for p in REVIEW.glob("*") if p.name in ("machine-32px.webp", "stone-32px.webp", "batch.json", "silhouettes.json"))
    return digest([(str(p.relative_to(ROOT)), digest(p)) for p in sorted(files)])


def main():
    receipt = CACHE / "batch-state.json"
    if receipt.exists() and read_json(receipt) == batch_signature():
        print("몬스터 원본·리그·아틀라스·검수 결과가 최신입니다.")
        return
    if os.environ.get("RESOURCE_GUARD_ACTIVE") != "1":
        guard = Path.home() / ".local/bin/resource-guard"
        os.execv(guard, [str(guard), "run", "--profile", "avatar", "--wait-seconds", "900", "--",
                        sys.executable, "-B", str(Path(__file__).resolve())])
    packs, rows, images, redos = [], [], {}, {}
    for species in SPECIES:
        items, redo = [], []
        species_images = {}
        for entry, skins in ACTORS.items():
            canonical, first_targets = {}, {}
            for skin in skins:
                folder = SOURCE / species / entry / skin
                if not all((folder / f).is_file() for f in ("sheet.png", "assembly.png", "parts.json")):
                    continue
                if skin != skins[0] and not canonical:
                    raise ValueError(f"{species}/{entry} · 먼저 T1 관절이 필요합니다.")
                meta, report, work = process_actor(folder, canonical, first_targets)
                if not canonical:
                    canonical = report["pivots"]
                    first_targets = {k: v["targetBox"] for k, v in report["parts"].items()}
                items.append((meta, report, work))
                species_images[actor_id(meta)] = work / "assembly-preview.webp"
                if not report["accepted"]:
                    redo.append(f"- `{entry}/{skin}` {report['redo']}")
                rows.append({"species": species, "entry": entry, "skin": skin, "iou": report["silhouetteIoU"],
                             "slots": len(report["parts"]), "accepted": report["accepted"]})
        if species_images:
            images[species] = species_images
        pack = pack_species(species, items)
        if pack:
            packs.append(pack)
        else:
            save(CATALOG / f"{species}.json", {"atlas": f"monsters/{species}/{species}.atlas", "entities": {}, "rigs": {}})
        redos[species] = redo
    comparisons = None
    if images:
        review_images(images, REVIEW)
        comparisons = read_json(REVIEW / "silhouettes.json")
    for species, redo in redos.items():
        lines = ["# 그림 재검수", "", "## 조립", "", *(redo or ["조립 기준 미달 개체 없음."])]
        if comparisons:
            failures = [p for p in comparisons["evolution"] if not p["pass"]]
            failures += [p for group in comparisons["crossSpecies"] for p in group["failures"]]
            matches = [p for p in failures if any(p[k].startswith(species + "-") for k in ("first", "second"))]
            if matches:
                lines += ["", "## 32px 외곽선", "",
                          "아래 조합은 판독 띠에서 겹치는 면적이 기준 이상이다. 두 원화의 몸통 폭, 장비와 다리 사이의 빈 공간을 함께 검토한다.", ""]
                lines.extend(f"- `{p['first']}` · `{p['second']}` — IoU {p['iou']:.3f}" for p in matches)
        publish(SOURCE / species / "REDO.md", ("\n".join(lines) + "\n").encode())
    atlases = {
        next(iter(read_json(p / "manifest-fragment.json")["species"])): read_json(p / "export/atlas-report.json")
        for p in packs}
    save(REVIEW / "batch.json", {"actors": rows, "atlases": atlases,
         "assemblyPassed": sum(row["accepted"] for row in rows),
         "silhouettePairFailures": comparisons["failures"] if comparisons else None})
    write_summary(rows, atlases, comparisons)
    save(receipt, batch_signature())


if __name__ == "__main__":
    main()
