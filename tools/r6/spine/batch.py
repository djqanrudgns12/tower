"""몬스터 다섯 종족의 원본 폴더를 찾아 검수한 개체를 종족별로 묶는다."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory

import numpy as np

from cut_parts import assemble, components, cut, normalize_reference, open_rgba, orient_parts, read_guide
from fit_parts import fit
from monsters import ACTORS, SPECIES, export, prepare, read_json
from pilot import write_json
from review import review_images
from swarm import animate_swarm
from white_key import preprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / "asset-source/r6/monsters"
PUBLIC = ROOT / "public/assets/r6/monsters"
CATALOG = ROOT / "src/game/r6/monsters"
REVIEW = ROOT / "docs/renewal/r6/tech/monsters"
CACHE = ROOT / ".orchestrate/r6-monster-batch"
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


def white_patches(image):
    pixels = np.asarray(image.convert("RGBA"))
    mask = (pixels[:, :, 3] == 255) & (pixels[:, :, :3] >= 240).all(axis=2)
    return [{"pixels": c.area, "box": list(c.box)} for c in components(mask) if c.area >= 24]


def actor_inputs(folder, placement):
    sheet, assembly = folder / "sheet.png", folder / "assembly.png"
    setting = placement.get("whiteKey", {})
    if not setting or setting["sourceHash"] != digest(sheet, assembly):
        return sheet, assembly, None
    key = digest(setting, HERE / "white_key.py", HERE / "cut_parts.py")
    cache = CACHE / folder.relative_to(SOURCE) / "white-key" / key
    stats = preprocess(folder, cache, setting.get("protect", {}))
    return cache / sheet.name, cache / assembly.name, stats


def process_actor(folder, canonical, first_targets, *, publish_review=True):
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
    clean_sheet, clean_assembly, white_key = actor_inputs(folder, placement)
    inputs = digest(folder / "parts.json", sheet, assembly, guide, canonical, HERE / "fit_parts.py",
                    HERE / "cut_parts.py", HERE / "part_guides.py", HERE / "parts.py", HERE / "slot_plan.py")
    if white_key:
        inputs = digest(inputs, clean_sheet.parent.name)
    config = {k: v for k, v in placement.items() if k not in ("fitKey", "fitScores", "artReview", "whiteMark")}
    if placement.get("fitKey") != digest(inputs, config):
        template = read_json(guide)
        issues = []
        pieces = read_guide(open_rgba(clean_sheet), template, issues)
        if not any(i.get("blocking") for i in issues) and set(pieces) == set(meta["slots"]):
            orient_parts(pieces, placement.get("rotations", {}))
            reference = normalize_reference(open_rgba(clean_assembly), {})
            if set(placement.get("fixedTargets", ())) == pieces.keys() and placement.get("pivots"):
                placement["fitScores"] = [assemble(pieces, template, reference, placement, [])[-1]]
            elif white_key and placement.get("targets"):
                # 배경만 달라지면 기존 좌표를 먼저 평가한다. T1의 회전축도 유지한다.
                prior_iou = assemble(pieces, template, reference, placement, [])[-1]
                if prior_iou >= .70:
                    placement["fitScores"] = [prior_iou]
                else:
                    previous = dict(placement)
                    scores = fit(pieces, template, reference, placement, canonical or placement["pivots"])
                    if prior_iou > max(scores):
                        placement.update(previous)
                    placement["fitScores"] = [prior_iou, *scores]
            else:
                placement["fitScores"] = fit(pieces, template, reference, placement, canonical)
        else:
            placement["fitScores"] = []
        config = {k: v for k, v in placement.items() if k not in ("fitKey", "fitScores", "artReview", "whiteMark")}
        placement["fitKey"] = digest(inputs, config)
        save(placement_path, placement)
    work = CACHE / species / entry / skin / placement["fitKey"]
    if not (work / "report.json").exists():
        cut(clean_sheet, clean_assembly, guide, work, species, entry, skin, placement_path)
    report = read_json(work / "report.json")
    if white_key:
        report["whiteKey"] = white_key
        if white_key["applied"] and publish_review:
            publish(REVIEW / "white-key" / (actor_id(meta) + ".webp"), (clean_sheet.parent / "review.webp").read_bytes())
    missing = set(report["parts"]) ^ set(meta["slots"])
    if missing:
        report["issues"].append({"code": "slot_manifest_mismatch", "slots": sorted(missing)})
        report["ready"] = False
    report["fitScores"] = placement["fitScores"]
    report["accepted"] = report["ready"] and report["silhouetteIoU"] >= .70
    review = placement.get("artReview")
    if review and review["sourceHash"] == digest(sheet, assembly):
        report["artRedo"] = review["reason"]
        report["accepted"] = False
    spots = {name: found for name in ("reference", "preview")
             if (found := white_patches(open_rgba(work / f"assembly-{name}.webp")))}
    if spots:
        report["whitePatches"] = spots
        mark = placement.get("whiteMark", {})
        if mark.get("reviewKey") == digest(sheet, assembly, spots) and mark.get("reason"):
            report["whiteMark"] = mark["reason"]
        else:
            details = []
            for name, groups in spots.items():
                g = max(groups, key=lambda group: group["pixels"])
                label = "원화" if name == "reference" else "조립"
                details.append(f"{label} {g['box']}에서 {g['pixels']}px")
            reason = "흰 얼룩 · " + ", ".join(details) + ". 부품 사이에 남은 흰 면을 확인해 주세요."
            report["artRedo"] = " ".join(filter(None, [report.get("artRedo"), reason]))
            report["accepted"] = False
    if not report["accepted"]:
        reasons = [report["artRedo"]] if report.get("artRedo") else []
        if not report["ready"] or report["silhouetteIoU"] < .70:
            reasons.append(placement.get("redoNote") or redo_reason(work, report))
        report["redo"] = " ".join(reasons)
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


def pack_species(species, items, *, sync_source=True):
    accepted = [(m, r, w) for m, r, w in items if r["accepted"]]
    if not accepted:
        return None
    # 변경된 개체만 절단·정렬하고, 아틀라스는 달라진 종족만 다시 묶는다.
    key = digest([(m, r, w.name) for m, r, w in accepted],
                 *(HERE / f for f in ("monsters.py", "rigs.py", "pilot.py", "slot_plan.py", "check-runtime.mjs")))
    if species == "insect":
        key = digest(key, HERE / "swarm.py")
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
                if view := config["rigs"][entry].get("views", {}).get(skin):
                    profile.setdefault("views", {})[skin] = view
                if meta.get("armless"):
                    profile["armlessSkins"].append(skin)
                available.setdefault(entry, []).append(skin)
                shutil.copytree(single / entry / skin, source / entry / skin)
            config["rigs"] = profiles
            write_json(source / "species.json", config)
            prepare(source, work, available=available)
            if species == "insect" and profiles.get("special", {}).get("variant") == "swarm":
                path = work / "rigs/insect-special.json"
                rig = read_json(path)
                animate_swarm(rig)
                write_json(path, rig)
            export(work, "spine-cli", rig_cache=CACHE / species / "rigs", atlas_budget=ATLAS_BUDGET)
            subprocess.run(["node", HERE / "check-runtime.mjs", work], check=True)
            shutil.copyfile(source / "species.json", work / "species.json")
            work.rename(cache)
    # 기존 종족의 편집용 명세만 동기화한다. 새 명세는 저작 캐시에서 열 수 있다.
    source_config = SOURCE / species / "species.json"
    if sync_source and source_config.exists():
        publish(source_config, (cache / "species.json").read_bytes())
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
        if row.get("artRedo"):
            clips = "원화 재요청"
        if row["accepted"] and row["entry"].startswith("boss-"):
            clips += "·기술"
        table.append(f"| {row['species']} | {row['entry']}/{row['skin']} | {row['iou']:.3f} | {row['slots']} | {clips} |")
    passed = sum(row["iou"] >= .70 for row in rows)
    connected = sum(row["accepted"] for row in rows)
    atlases = {s: atlases[s] for s in dict.fromkeys(row["species"] for row in rows) if s in atlases}
    save(REVIEW / "batch.json", {"actors": rows, "atlases": atlases, "assemblyPassed": passed,
         "publishedActors": connected, "silhouettePairFailures": comparisons["failures"] if comparisons else None})
    table += ["", f"- 조립 IoU 0.70 이상 {passed}/{len(rows)}개체, 전장 연결 {connected}/{len(rows)}개체."]
    for species, stats in atlases.items():
        table.append(f"- `{species}` 아틀라스 {stats['width']}×{stats['height']}, WebP {stats['bytes']:,}바이트, "
                     f"RGBA8 {stats['rgbaBytes']:,}바이트.")
    if comparisons:
        adjacent = comparisons["evolution"]
        cross = comparisons["crossSpecies"]
        bosses = comparisons["bossVsRegular"]
        table.append(f"- 인접 단계 {len(adjacent)}쌍 중 {sum(not p['pass'] for p in adjacent)}쌍, "
                     f"종족 간 {sum(g['comparisons'] for g in cross)}쌍 중 "
                     f"{sum(len(g['failures']) for g in cross)}쌍이 32px 구분 기준에 미달했다.")
        table.append(f"- 같은 종족의 보스·일반 {sum(map(len, bosses.values()))}쌍 중 "
                     f"{comparisons['bossPairFailures']}쌍의 IoU가 {comparisons['bossLimit']:.2f} 이상으로 재검수 대상이다.")
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
    files.extend(p for p in REVIEW.glob("*") if p.name in ("batch.json", "silhouettes.json") or p.name.endswith("-32px.webp"))
    return digest([(str(p.relative_to(ROOT)), digest(p)) for p in sorted(files)])


def published_work(row):
    species, entry, skin = (row[k] for k in ("species", "entry", "skin"))
    folder = SOURCE / species / entry / skin
    placement = folder / "placement.json"
    work = CACHE / species / entry / skin / read_json(placement)["fitKey"]
    if not (work / "report.json").exists():
        # 다른 제작자가 원본을 교체하는 중이면 지난 판의 캐시에 새 원화를 섞지 않는다.
        guide = SOURCE / "_guides" / read_json(folder / "parts.json")["guide"]
        saved = read_json(folder / "report.json")
        with TemporaryDirectory(dir=CACHE) as tmp:
            rebuilt = Path(tmp) / "cut"
            sheet, assembly, _ = actor_inputs(folder, read_json(placement))
            cut(sheet, assembly, guide, rebuilt, species, entry, skin, placement)
            result = read_json(rebuilt / "report.json")
            if any(saved[k] != result[k] for k in ("parts", "pivots", "silhouetteIoU", "issues")):
                raise ValueError(f"{species}/{entry}/{skin} 원본이 바뀌었습니다. 해당 종족을 포함해 실행하세요.")
            work.parent.mkdir(parents=True, exist_ok=True)
            rebuilt.rename(work)
    return work


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--species", nargs="+", choices=SPECIES, default=SPECIES,
                        help="지정한 종족만 갱신하고 다른 종족의 게시 결과는 비교에 재사용한다.")
    parser.add_argument("--actor", nargs=3, metavar=("SPECIES", "ENTRY", "SKIN"), action="append",
                        help="지정한 개체만 다시 조립하고 나머지는 이전 검수 결과를 사용한다.")
    parser.add_argument("--runtime-only", action="store_true", help="원화 폴더의 종족 편집 명세는 제작자가 관리한다.")
    parser.add_argument("--skip-shared-review", action="store_true",
                        help="개체·게임 묶음·게시 기록을 갱신하고 공용 문서와 비교판은 보존한다.")
    args = parser.parse_args()
    if args.skip_shared_review and not args.actor:
        parser.error("--skip-shared-review는 --actor와 함께 사용하세요.")
    actors = {tuple(actor) for actor in args.actor or []}
    for species, entry, skin in actors:
        if species not in args.species or skin not in ACTORS.get(entry, ()):
            parser.error(f"개체를 확인하세요 · {species}/{entry}/{skin}")
    selected = {species for species, _, _ in actors} if actors else set(args.species)
    receipt = CACHE / "batch-state.json"
    if receipt.exists() and read_json(receipt) == batch_signature():
        print("몬스터 원본·리그·아틀라스·검수 결과가 최신입니다.")
        return
    if os.environ.get("RESOURCE_GUARD_ACTIVE") != "1":
        guard = Path.home() / ".local/bin/resource-guard"
        os.execv(guard, [str(guard), "run", "--profile", "avatar", "--wait-seconds", "900", "--",
                        sys.executable, "-B", str(Path(__file__).resolve()), *sys.argv[1:]])
    CACHE.mkdir(parents=True, exist_ok=True)
    previous = read_json(REVIEW / "batch.json") if (REVIEW / "batch.json").exists() else {}
    previous_rows = {(r["species"], r["entry"], r["skin"]): r for r in previous.get("actors", [])}
    rows, images, redos = [], {}, {}
    atlases = {s: stats for s, stats in previous.get("atlases", {}).items() if s not in selected}
    for species in sorted(SPECIES, key=lambda s: (s not in ("machine", "stone"), s)):
        if species not in selected:
            for row in previous.get("actors", []):
                if row["species"] != species:
                    continue
                rows.append(row)
                if not args.skip_shared_review:
                    images.setdefault(species, {})[actor_id(row)] = published_work(row) / "assembly-preview.webp"
            continue
        items, redo = [], []
        species_images = {}
        catalog = read_json(CATALOG / f"{species}.json") if args.skip_shared_review else {}
        for entry, skins in ACTORS.items():
            canonical, first_targets = {}, {}
            for skin in skins:
                key = species, entry, skin
                folder = SOURCE.joinpath(*key)
                old = previous_rows.get(key)
                if actors and key not in actors:
                    if not old:
                        continue
                    report = read_json(folder / "report.json")
                    work = published_work(old)
                    if args.skip_shared_review:
                        # 유지할 스킨의 배율과 팔 사용 여부를 게시된 자료에서 가져온다.
                        source_profile = read_json(work / "species.json")["rigs"][entry]
                        meta = {**old, "scale": catalog["entities"][actor_id(old)]["scale"],
                                "armless": skin in source_profile.get("armlessSkins", ())}
                    else:
                        meta = read_json(folder / "parts.json")
                else:
                    if not all((folder / f).is_file() for f in ("sheet.png", "assembly.png", "parts.json")):
                        if key in actors:
                            raise ValueError(f"{folder} · 시트·조립 그림·슬롯 명세가 필요합니다.")
                        continue
                    if skin != skins[0] and not canonical:
                        print(f"{species}/{entry}/{skin} · T1 관절이 준비되면 처리합니다.")
                        continue
                    meta, report, work = process_actor(folder, canonical, first_targets, publish_review=not args.skip_shared_review)
                if args.skip_shared_review and old and old["accepted"] and not report["accepted"]:
                    raise ValueError(f"{folder} · 이전 승인 스킨을 제외할 수 없습니다. {report['redo']}")
                if not canonical:
                    canonical = report["pivots"]
                    first_targets = {k: v["targetBox"] for k, v in report["parts"].items()}
                items.append((meta, report, work))
                species_images[actor_id(meta)] = work / "assembly-preview.webp"
                if not report["accepted"]:
                    redo.append(f"- `{entry}/{skin}` {report['redo']}")
                rows.append({"species": species, "entry": entry, "skin": skin, "iou": report["silhouetteIoU"],
                             "slots": len(report["parts"]), "accepted": report["accepted"],
                             **({"artRedo": report["artRedo"]} if "artRedo" in report else {})})
        if species_images:
            images[species] = species_images
        pack = pack_species(species, items, sync_source=not args.runtime_only)
        if pack:
            atlases[species] = read_json(pack / "export/atlas-report.json")
        else:
            save(CATALOG / f"{species}.json", {"atlas": f"monsters/{species}/{species}.atlas", "entities": {}, "rigs": {}})
        redos[species] = redo
    if args.skip_shared_review:
        # 게시 시험이 실제 WebP와 비교하는 종족별 SHA-256도 함께 갱신한다.
        save(REVIEW / "batch.json", {**previous, "actors": rows, "atlases": atlases,
             "assemblyPassed": sum(row["iou"] >= .70 for row in rows),
             "publishedActors": sum(row["accepted"] for row in rows)})
        return
    comparisons = None
    if images:
        review_images(images, REVIEW)
        comparisons = read_json(REVIEW / "silhouettes.json")
    for species, redo in redos.items():
        lines = ["# 그림 재검수", "", "## 조립", "", *(redo or ["조립 기준 미달 개체 없음."])]
        path = SOURCE / species / "REDO.md"
        if comparisons:
            lines.extend(["", "## 32px 비교", ""])
            for group in comparisons["crossSpecies"]:
                if species in group["species"]:
                    other, = [s for s in group["species"] if s != species]
                    worst = group["max"]
                    lines.append(f"- {other} 비교 {group['comparisons']}쌍 중 {len(group['failures'])}쌍 미달. "
                                 f"가장 비슷한 쌍은 `{worst['first']}`와 `{worst['second']}` (IoU {worst['iou']:.3f}).")
        if path.exists():
            existing = path.read_text()
            _, marker, notes = existing.partition("\n## 32px 재작화\n")
            if marker:
                lines.append(marker + notes.split("\n## ", 1)[0].rstrip())
            history = existing.split("## 도구로 해결", 1)
            accepted = {f"`{r['entry']}/{r['skin']}`": r for r in rows if r['species'] == species and r['accepted']}
            entries = []
            if len(history) == 2:
                entries = [line for line in history[1].split("\n## ", 1)[0].splitlines()
                           if line.startswith("- ") and line.split()[1] in accepted]
            pending = history[0].split("## 조립\n", 1)[-1].split("\n## ", 1)[0]
            for line in pending.splitlines():
                if line.startswith("- ") and (key := line.split()[1]) in accepted:
                    entries.append(f"- {key} 재작화 반영 · 조립 IoU {accepted[key]['iou']:.3f}")
            if entries:
                lines.extend(["", "## 도구로 해결", "", *entries])
            _, marker, notes = existing.partition("\n## 32px 외곽선")
            if marker:
                lines.append("\n## 32px 외곽선 · 이전 검수 기록" + notes.removeprefix(" · 이전 검수 기록").rstrip())
        publish(path, ("\n".join(lines) + "\n").encode())
    write_summary(rows, atlases, comparisons)
    if selected == set(SPECIES) and not args.runtime_only and not actors:
        save(receipt, batch_signature())


if __name__ == "__main__":
    main()
