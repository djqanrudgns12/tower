"""Spine CLI 출력에서 런타임 파츠 WebP와 프레임 시트 WebP를 만든다."""

import argparse
import hashlib
import itertools
import json
import math
from pathlib import Path
import sys

from PIL import Image


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "qa"))
from check import manifest_errors, palette_violations, read_image
from pilot import SKINS, write_json


CLIPS = {"walk": 12, "hit": 4, "fall": 7}


def asset(path, image, **extra):
    return {
        "id": path.stem, "file": path.name, "width": image.width, "height": image.height,
        "artifactHash": hashlib.sha256(path.read_bytes()).hexdigest(), **extra,
    }


def pack(out):
    config = json.loads(Path(__file__).with_name("bake.export.json").read_text())
    width, height = config["cropWidth"], config["cropHeight"]
    pivot = [-config["cropX"], height + config["cropY"]]
    packed = out / "packed"
    atlas_path = packed / "walker.atlas"
    atlas = atlas_path.read_text()
    if atlas.startswith("walker.png\n"):
        atlas = atlas.replace("walker.png\n", "walker.webp\n", 1)
    elif not atlas.startswith("walker.webp\n"):
        raise ValueError("walker 아틀라스의 페이지 이름이 다릅니다.")
    packed_image = read_image(packed / "walker.png")
    packed_webp = packed / "walker.webp"
    packed_image.save(packed_webp, lossless=True, method=6)
    atlas_path.write_text(atlas)

    baked = out / "baked"
    baked.mkdir(exist_ok=True)
    frame_count = len(SKINS) * sum(CLIPS.values())
    columns = 12
    sheet = Image.new("RGBA", (columns * width, math.ceil(frame_count / columns) * height))
    skins = []
    index = 0
    for skin in SKINS:
        clips = {}
        for clip, count in CLIPS.items():
            paths = sorted((out / "frames-wide").glob(f"walker-{skin}-{clip}_*.png"),
                           key=lambda path: int(path.stem.rsplit("_", 1)[1]))
            if len(paths) != count + (clip == "walk"):
                raise ValueError(f"{skin}/{clip}의 출력 프레임 수가 다릅니다.")
            clips[clip] = {"start": index, "count": count}
            for path in itertools.islice(paths, count):
                image = read_image(path)
                bounds = image.getbbox()
                if (image.size != (width, height) or not bounds or bounds[0] <= 0 or bounds[1] <= 0
                        or bounds[2] >= width or bounds[3] >= height):
                    raise ValueError(f"{path.name}이 비어 있거나 잘렸거나 크기가 다릅니다.")
                sheet.paste(image, (index % columns * width, index // columns * height))
                index += 1
        skins.append(clips)
    baked_webp = baked / "walker.webp"
    sheet.save(baked_webp, lossless=True, method=6)
    write_json(baked / "frames.json", {"fps": config["fps"], "pivot": pivot, "skins": skins})
    spec = {"frameWidth": width, "frameHeight": height, "frameCount": frame_count, "pivot": pivot}
    for directory, image, path, extra in (
        (packed, packed_image, packed_webp, {}),
        (baked, sheet, baked_webp, {"sprite": spec}),
    ):
        manifest = {"assets": [asset(path, image, **extra)]}
        errors = manifest_errors(manifest, directory)
        if palette_violations(read_image(path)) or errors:
            raise ValueError(f"{path.name} 자동 검수 실패 · {errors or '팔레트 위반'}")
        write_json(directory / "manifest.json", manifest)
    print(f"파츠 아틀라스 {packed_image.size} · 프레임 시트 {sheet.size} · {frame_count}프레임 검사 통과")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path, help="Spine 시범 출력 폴더")
    pack(parser.parse_args().out.resolve())
