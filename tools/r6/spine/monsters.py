"""R6 종족 단위 Spine 파츠 준비, 프로젝트 왕복, 공용 아틀라스 출력."""

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageChops

from parts import extract, load_part, suggest_pivot
from pilot import SKINS, write_json
from rigs import VARIANTS, layout, world_bones


SPECIES = ("elf", "human", "machine", "insect", "stone")
FAMILIES = tuple(VARIANTS)[:-1]
ACTORS = {**{family: SKINS for family in FAMILIES}, **{f"boss-t{i}": (skin,) for i, skin in enumerate(SKINS, 1)}}
LIMIT = 2048


@contextmanager
def new_directory(out):
    if out.exists():
        raise ValueError(f"새 출력 경로가 필요합니다 · {out}")
    out.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=f".{out.name}-", dir=out.parent) as temp:
        stage = Path(temp)
        yield stage
        if out.exists():
            raise ValueError(f"출력 경로가 이미 생성됐습니다 · {out}")
        stage.rename(out)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_config(source):
    config = read_json(source / "species.json")
    species = config["species"]
    if species not in SPECIES:
        raise ValueError("종족 키는 elf·human·machine·insect·stone 중 하나여야 합니다.")
    canvas, root = tuple(config["canvas"]), tuple(config["root"])
    if (len(canvas) != 2 or len(root) != 2
            or any(type(size) != int or not 1 <= size <= LIMIT for size in canvas)
            or any(type(value) != int or not 0 <= value < size for value, size in zip(root, canvas))):
        raise ValueError("캔버스와 발밑 원점을 확인하세요.")
    ppu = config["pixelsPerUnit"]
    if type(ppu) not in (int, float) or not .25 <= ppu <= 32:
        raise ValueError("pixelsPerUnit은 0.25~32 사이 숫자여야 합니다.")
    profiles = config.get("rigs", {})
    if not isinstance(profiles, dict) or set(profiles) - ACTORS.keys():
        raise ValueError("rigs에는 계통 또는 boss-t1~boss-t4 키만 지정할 수 있습니다.")
    return species, canvas, root, ppu, profiles


def base_rig(family, profile, canvas, root, ppu):
    variant, bones, slots, animations = layout(family, profile)
    anchors = world_bones(bones)
    offsets = profile.get("pivots", {})
    if not isinstance(offsets, dict) or set(offsets) - anchors.keys() or "root" in offsets:
        raise ValueError("pivots에는 해당 틀에 있는 뼈 이름만 지정할 수 있습니다.")
    positions = {}
    for name, (x, y) in anchors.items():
        point = offsets.get(name, [root[0] + x * ppu, root[1] - y * ppu])
        if (not isinstance(point, list) or len(point) != 2
                or any(type(value) not in (int, float) or not 0 <= value < size
                       for value, size in zip(point, canvas))):
            raise ValueError(f"{name} 뼈의 기준점이 캔버스 밖입니다 · {point}")
        positions[name] = tuple(point)
    return variant, bones, slots, animations, positions


def slots_for_skin(slots, profile, skin):
    if skin in profile.get("armlessSkins", []):
        return [slot for slot in slots if not slot.name.startswith("arm-")]
    return slots


def load_skin(folder, slots, canvas):
    parts = {path.stem: path for path in folder.glob("*.png")}
    missing = {slot.name for slot in slots if slot.required} - parts.keys()
    unknown = parts.keys() - {slot.name for slot in slots}
    if missing or unknown:
        raise ValueError(f"{folder} · 누락 {sorted(missing)} · 알 수 없는 슬롯 {sorted(unknown)}")
    return {name: load_part(path, canvas) for name, path in parts.items()}


def compose_rig(source, textures, canvas, root, ppu, rig_id, family, entry, skins, profile):
    variant, bones, slots, animations, points = base_rig(family, profile, canvas, root, ppu)
    layers = {skin: load_skin(source / entry / skin, slots_for_skin(slots, profile, skin), canvas) for skin in skins}
    reference = layers[skins[0]]
    for slot in slots:
        if slot.name == slot.bone and slot.name in reference and slot.bone not in profile.get("pivots", {}):
            points[slot.bone] = suggest_pivot(reference[slot.name], points[slot.bone], 3 * ppu)

    # 원점을 유지한 상태에서 절대 화소 좌표를 부모 뼈 기준 Spine 좌표로 변환한다.
    skeleton_bones = []
    for name, (parent, _, _) in bones.items():
        bone = {"name": name}
        if parent:
            px, py = points[parent]
            x, y = points[name]
            bone.update(parent=parent, x=(x - px) / ppu, y=(py - y) / ppu)
        skeleton_bones.append(bone)
    setup_slots = [{"name": slot.name, "bone": slot.bone, "attachment": slot.name} for slot in slots
                   if any(slot.name in parts for parts in layers.values())]
    skeleton_skins = []
    previews = {}
    for skin, parts in layers.items():
        attachments = {}
        preview = Image.new("RGBA", canvas)
        for slot in slots:
            part = parts.get(slot.name)
            if part is None:
                continue
            if slot.name != "shadow":
                preview.alpha_composite(part)
            left, top, right, bottom = part.getbbox()
            path = f"{rig_id}-{skin.lower()}-{slot.name}"
            part.crop((left, top, right, bottom)).save(textures / f"{path}.png")
            px, py = points[slot.bone]
            attachments[slot.name] = {slot.name: {
                "path": path, "x": ((left + right) / 2 - px) / ppu, "y": (py - (top + bottom) / 2) / ppu,
                "width": right - left, "height": bottom - top, "scaleX": 1 / ppu, "scaleY": 1 / ppu,
            }}
        skeleton_skins.append({"name": skin, "attachments": attachments})
        previews[skin] = preview
    rig = {
        "skeleton": {"spine": "4.3.26", "images": "../parts/"},
        "bones": skeleton_bones, "slots": setup_slots, "skins": skeleton_skins, "animations": animations,
    }
    return rig, previews, {"variant": variant, "pivots": points, "root": root}


def prepare(source, out, actor=None, *, available=None):
    species, canvas, root, ppu, profiles = load_config(source)
    actors = ACTORS if available is None else available
    if actor:
        entry, skin = actor
        if skin not in ACTORS.get(entry, ()):
            raise ValueError(f"계통과 단계 조합을 확인하세요 · {entry}/{skin}")
        actors = {entry: (skin,)}
    specs, links, bindings = {}, {}, {}
    with new_directory(out) as stage:
        for directory in ("parts", "rigs", "silhouettes"):
            (stage / directory).mkdir()
        for entry, skins in actors.items():
            family = "boss" if entry.startswith("boss-") else entry
            rig_id = f"{species}-{entry}"
            profile = profiles.get(entry, {})
            if not isinstance(profile, dict) or set(profile) - {"variant", "proportions", "pivots", "scale", "armlessSkins"}:
                raise ValueError(f"{entry} · 틀, 비례, 피벗 또는 표시 배율을 확인하세요.")
            armless = profile.get("armlessSkins", [])
            if (not isinstance(armless, list) or any(skin not in ACTORS[entry] for skin in armless)
                    or (armless and profile.get("variant", VARIANTS[family][0]) != "biped")):
                raise ValueError(f"{entry} · armlessSkins는 이족 계통의 단계 목록이어야 합니다.")
            scale = profile.get("scale", 1)
            if type(scale) not in (int, float) or not 0 < scale <= 8:
                raise ValueError(f"{entry} · 게임 표시 배율은 0 초과 8 이하여야 합니다.")
            rig, previews, binding = compose_rig(source, stage / "parts", canvas, root, ppu,
                                                rig_id, family, entry, skins, profile)
            write_json(stage / "rigs" / f"{rig_id}.json", rig)
            bindings[rig_id] = binding
            specs[rig_id] = {"file": f"{species}/{rig_id}.json", "scale": scale,
                             "walk": "walk", "hit": "hit", "fall": "fall"}
            for skin, img in previews.items():
                actor_id = rig_id if family == "boss" else f"{rig_id}-{skin.lower()}"
                links[actor_id] = {"rig": rig_id, "skin": skin}
                img.save(stage / "silhouettes" / f"{actor_id}.png")
        fallback = next(iter(links.values())).copy()
        if actor is None and available is None:
            fallback["tierSkins"] = list(SKINS)
        write_json(stage / "manifest-fragment.json", {
            "atlases": {species: f"{species}/{species}.atlas"}, "rigs": specs,
            "species": {species: {"atlas": species, "fallback": fallback, "entities": links}},
        })
        write_json(stage / "bindings.json", bindings)
    print(f"{species} · 뼈대 {len(specs)}개 · 개체 {len(links)}개 준비 완료")


def export(work, cli, *, rig_cache=None, atlas_budget=None):
    fragment = read_json(work / "manifest-fragment.json")
    species, = fragment["species"]
    names = tuple(fragment["rigs"])
    with new_directory(work / "export") as stage:
        projects, runtime, imports = stage / "projects", stage / species, stage / "imports"
        for folder in (projects, runtime, imports):
            folder.mkdir()
        command = [cli]
        new_rigs = {}
        for name in names:
            project = projects / f"{name}.spine"
            import_file = imports / f"{name}.json"
            source = read_json(work / "rigs" / import_file.name)
            if rig_cache is not None:
                # 같은 뼈대·스킨·부착물은 종족 아틀라스를 다시 묶을 때도 편집기 왕복을 재사용한다.
                identity = hashlib.sha256((work / "rigs" / import_file.name).read_bytes())
                identity.update(Path(__file__).read_bytes())
                for texture in sorted((work / "parts").glob(f"{name}-*.png")):
                    identity.update(hashlib.sha256(texture.read_bytes()).digest())
                cached = rig_cache / name / identity.hexdigest()
                if cached.exists():
                    shutil.copyfile(cached / project.name, project)
                    shutil.copyfile(cached / import_file.name, runtime / import_file.name)
                    continue
                new_rigs[name] = cached
            source["skeleton"]["images"] = os.path.relpath(work / "parts", imports) + "/"
            write_json(import_file, source)
            command += ["-i", str(import_file), "-o", str(project), "-r",
                        "-i", str(project), "-o", str(runtime), "-e", "json"]
        command += [
            "-i", str(work / "parts"), "-o", str(runtime),
            "--set", "maxWidth=2048", "--set", "maxHeight=2048", "--set", "pot=false",
            "--set", "rotation=false", "--set", "useIndexes=false", "--set", "premultiplyAlpha=false",
            "--set", "alphaThreshold=0", "--set", "bleed=true", "--set", "duplicatePadding=true",
            "--set", "filterMin=Linear", "--set", "filterMag=Linear", "-p", species,
        ]
        subprocess.run(command, check=True)
        for path in imports.iterdir():
            path.unlink()
        imports.rmdir()
        for name in names:
            source = read_json(work / "rigs" / f"{name}.json")
            final = read_json(runtime / f"{name}.json")
            for key in ("bones", "slots", "skins", "animations"):
                def names_of(data):
                    return set(data[key]) if key == "animations" else {value["name"] for value in data[key]}
                if names_of(final) != names_of(source):
                    raise ValueError(f"{name} · CLI 왕복 후 {key} 목록이 바뀌었습니다.")
        for name, cached in new_rigs.items():
            with new_directory(cached) as fresh:
                for folder, ext in ((projects, ".spine"), (runtime, ".json")):
                    shutil.copyfile(folder / (name + ext), fresh / (name + ext))
        stats = finish_atlas(runtime, species, atlas_budget)
        write_json(stage / "atlas-report.json", stats)
    print(f"{species} · Spine 프로젝트 {len(names)}개 · WebP {stats['width']}×{stats['height']} · {stats['bytes']}바이트")


def finish_atlas(runtime, species, budget=None):
    atlas = runtime / f"{species}.atlas"
    text = atlas.read_text(encoding="utf-8")
    png = runtime / f"{species}.png"
    pages = sorted(runtime.glob("*.png"))
    if pages != [png] or text.splitlines()[0] != png.name:
        raise ValueError(f"종족 아틀라스 2048×2048 1장 초과 또는 페이지 이름 불일치 · {[p.name for p in pages]}")
    webp = png.with_suffix(".webp")
    with Image.open(png) as image:
        width, height = image.size
        if max(width, height) > LIMIT:
            raise ValueError(f"아틀라스 크기 초과 · {width}×{height}")
        rgba = image.convert("RGBA")
        rgba.save(webp, lossless=True, method=6, exact=True)
    if budget is not None and webp.stat().st_size > budget:
        # 전송 예산을 넘긴 경우 RGB만 압축하고 부품의 투명 경계는 원본을 유지한다.
        subprocess.run(["cwebp", "-quiet", "-q", "92", "-alpha_q", "100", "-m", "6", "-exact",
                        "-o", webp, "--", png], check=True)
        with Image.open(webp) as packed:
            if ImageChops.difference(packed.getchannel("A"), rgba.getchannel("A")).getbbox():
                raise ValueError(f"{species} · WebP 변환 후 알파가 바뀌었습니다.")
        if webp.stat().st_size > budget:
            raise ValueError(f"{species} · 아틀라스 전송 예산 초과 {webp.stat().st_size}")
    png.unlink()
    atlas.write_text(text.replace(png.name + "\n", webp.name + "\n", 1), encoding="utf-8")
    return {"width": width, "height": height, "bytes": webp.stat().st_size,
            "rgbaBytes": width * height * 4, "sha256": hashlib.sha256(webp.read_bytes()).hexdigest()}


def template(source, entry):
    _, canvas, root, ppu, profiles = load_config(source)
    family = "boss" if entry.startswith("boss-") else entry
    variant, _, slots, _, pivots = base_rig(family, profiles.get(entry, {}), canvas, root, ppu)
    print(json.dumps({"variant": variant, "canvas": canvas, "root": root, "pivots": pivots,
                      "slots": {slot.name: {"bone": slot.bone, "required": slot.required} for slot in slots}},
                     indent=2, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("prepare", help="공통 캔버스 PNG를 읽어 저작 JSON을 만든다.")
    build.add_argument("source", type=Path)
    build.add_argument("out", type=Path)
    build.add_argument("--actor", nargs=2, metavar=("계통", "단계"), help="한 개체만 시범용으로 준비한다.")
    pack = commands.add_parser("export", help="Spine CLI로 왕복하고 종족 아틀라스 한 장을 출력한다.")
    pack.add_argument("work", type=Path)
    pack.add_argument("--cli", default="spine-cli")
    guide = commands.add_parser("template", help="선택한 틀의 슬롯·피벗을 출력한다.")
    guide.add_argument("source", type=Path)
    guide.add_argument("entry", choices=ACTORS)
    masks = commands.add_parser("extract", help="시트 또는 개체 그림에서 마스크로 파츠를 분리한다.")
    masks.add_argument("sheet", type=Path)
    masks.add_argument("spec", type=Path)
    masks.add_argument("out", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            prepare(args.source.resolve(), args.out.resolve(), args.actor)
        elif args.command == "export":
            export(args.work.resolve(), args.cli)
        elif args.command == "template":
            template(args.source.resolve(), args.entry)
        else:
            extract(args.sheet.resolve(), args.spec.resolve(), args.out.resolve())
    except subprocess.CalledProcessError as error:
        parser.exit(error.returncode, f"Spine CLI 종료 코드 · {error.returncode}\n")
    except (ValueError, TypeError, KeyError, OSError) as error:
        parser.exit(1, f"처리 실패 · {error}\n")


if __name__ == "__main__":
    main()
