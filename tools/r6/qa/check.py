"""R6 그림과 매니페스트를 검사한다. 기준 위반이 있으면 종료 코드 1을 반환한다."""

import argparse
from functools import lru_cache
import hashlib
import itertools
import json
from pathlib import Path
import re

from PIL import Image, ImageChops, ImageColor


R04 = ("#12161B", "#1D242C", "#4A5563", "#B8C0C8", "#E69F24", "#2FB5A3")
ALLOWED_COLORS = tuple(
    tuple(min(255, round(channel * shade)) for channel in ImageColor.getrgb(base))
    for base, shade in itertools.product(R04, (0.74, 0.88, 1.0, 1.12))
)
SHA256 = re.compile(r"[0-9a-f]{64}")


def read_image(path):
    with Image.open(path) as image:
        return image.convert("RGBA")


def mask_at_48(image, pivot):
    # 비율과 피벗을 유지하는 48×48 축소다. 투명 여백을 자르지 않는다.
    width, height = image.size
    scale = min(48 / width, 48 / height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    x, y = pivot
    scaled = image.getchannel("A").resize(size, Image.Resampling.BOX)
    return scaled.point(lambda alpha: 255 if alpha >= 128 else 0), (round(x * scale), round(y * scale))


def silhouette_iou(first, second):
    left, left_pivot = mask_at_48(*first)
    right, right_pivot = mask_at_48(*second)
    pivot = tuple(map(max, zip(left_pivot, right_pivot)))
    extents = tuple(map(max, zip(
        (left.width - left_pivot[0], left.height - left_pivot[1]),
        (right.width - right_pivot[0], right.height - right_pivot[1]),
    )))
    size = tuple(map(sum, zip(pivot, extents)))
    aligned = []
    for image, (x, y) in ((left, left_pivot), (right, right_pivot)):
        canvas = Image.new("L", size)
        canvas.paste(image, (pivot[0] - x, pivot[1] - y))
        if not canvas.getbbox():
            raise ValueError("48px 실루엣에 보이는 화소가 없습니다.")
        aligned.append(canvas)
    a, b = aligned
    return ImageChops.darker(a, b).histogram()[255] / ImageChops.lighter(a, b).histogram()[255]


@lru_cache(maxsize=4096)
def in_palette(rgb):
    return any(max(abs(actual - expected) for actual, expected in zip(rgb, color)) <= 3
               for color in ALLOWED_COLORS)


def palette_violations(image):
    # AA 경계는 실루엣 검사에 포함하되 팔레트는 불투명에 가까운 영역의 색을 본다.
    return sum(count for count, rgba in image.getcolors(image.width * image.height)
               if rgba[3] >= 250 and not in_palette(rgba[:3]))


def positive_int(value):
    return type(value) is int and value > 0


def valid_pivot(pivot, width, height):
    return (isinstance(pivot, list) and len(pivot) == 2
            and all(type(value) is int for value in pivot)
            and 0 <= pivot[0] < width and 0 <= pivot[1] < height)


def sprite_errors(image, spec):
    keys = {"frameWidth", "frameHeight", "frameCount", "pivot"}
    if not isinstance(spec, dict) or spec.keys() != keys:
        return ["스프라이트 규격에 크기·프레임 수·피벗이 모두 필요합니다."]
    width, height, count = (spec[k] for k in ("frameWidth", "frameHeight", "frameCount"))
    if not all(map(positive_int, (width, height, count))):
        return ["프레임 크기와 수는 양의 정수여야 합니다."]
    errors = []
    if not valid_pivot(spec["pivot"], width, height):
        errors.append("피벗이 프레임 밖이거나 정수 좌표가 아닙니다.")
    if image.width % width or image.height % height:
        return [*errors, "시트 크기가 프레임 크기의 정수배가 아닙니다."]
    alpha = image.getchannel("A")
    cells = list(itertools.product(range(0, image.height, height), range(0, image.width, width)))
    if count > len(cells):
        return [*errors, "프레임 수가 시트 칸 수를 초과합니다."]
    for index, (y, x) in enumerate(cells):
        present = alpha.crop((x, y, x + width, y + height)).getbbox() is not None
        if present != (index < count):
            errors.append(f"{index}번 칸의 알파가 프레임 수와 맞지 않습니다.")
    return errors


def asset_path(root, filename):
    if not isinstance(filename, str) or not filename or "\\" in filename:
        raise ValueError("상대 WebP 경로가 필요합니다.")
    rel = Path(filename)
    path = (root / rel).resolve()
    if rel.is_absolute() or ".." in rel.parts or not path.is_relative_to(root) or rel.suffix != ".webp":
        raise ValueError("매니페스트 폴더 안의 상대 WebP 경로만 허용합니다.")
    return path


def manifest_errors(manifest, root):
    assets = manifest.get("assets") if isinstance(manifest, dict) else None
    if not isinstance(assets, list) or not assets:
        return ["매니페스트에 에셋 배열이 필요합니다."]
    errors = []
    ids, files = set(), set()
    for index, asset in enumerate(assets):
        if not isinstance(asset, dict):
            errors.append(f"{index}번 에셋은 객체여야 합니다.")
            continue
        name = asset.get("id")
        if not isinstance(name, str) or not name or name in ids:
            errors.append(f"{index}번 에셋 ID가 비어 있거나 중복됩니다.")
        else:
            ids.add(name)
        try:
            path = asset_path(root.resolve(), asset["file"])
            if path in files:
                errors.append(f"{name} · 파일 중복")
            files.add(path)
            digest = asset.get("artifactHash")
            if not isinstance(digest, str) or not SHA256.fullmatch(digest):
                raise ValueError("SHA-256 형식 오류")
            with path.open("rb") as handle:
                if hashlib.file_digest(handle, "sha256").hexdigest() != digest:
                    errors.append(f"{name} · SHA-256 불일치")
            with Image.open(path) as raw:
                if raw.format != "WEBP" or getattr(raw, "is_animated", False):
                    raise ValueError("정적 WebP 파일이 필요합니다.")
                width, height = asset["width"], asset["height"]
                if not all(map(positive_int, (width, height))) or raw.size != (width, height):
                    errors.append(f"{name} · 이미지 크기 불일치")
                image = raw.convert("RGBA")
            if "sprite" in asset:
                errors.extend(f"{name} · {error}" for error in sprite_errors(image, asset["sprite"]))
        except (KeyError, ValueError, OSError) as error:
            errors.append(f"{name or index} · {error}")
    return errors


def scene_difference(reference, candidate):
    if reference.size != candidate.size:
        raise ValueError("장면 캡처의 크기가 다릅니다.")
    # 투명 화소의 숨은 RGB를 무시하고 R04 카본 위에서 보이는 차이를 본다.
    def visible(image):
        bg = Image.new("RGBA", image.size, R04[0])
        return Image.alpha_composite(bg, image).convert("RGB")

    red, green, blue = ImageChops.difference(visible(reference), visible(candidate)).split()
    histogram = ImageChops.lighter(ImageChops.lighter(red, green), blue).histogram()
    return {"changedPixels": sum(histogram[1:]), "maxChannelDelta": max(i for i, n in enumerate(histogram) if n)}


def silhouette_report(path):
    spec = json.loads(path.read_text())
    entries = []
    for item in spec:
        image = read_image(path.parent / item["file"])
        if not valid_pivot(item["pivot"], *image.size):
            raise ValueError(f"{item['id']}의 피벗이 이미지 밖이거나 정수 좌표가 아닙니다.")
        entries.append((item, image))
    pairs = [
        {"a": a["id"], "b": b["id"], "iou": iou, "pass": iou < 0.55}
        for (a, first), (b, second) in itertools.combinations(entries, 2)
        if a["family"] != b["family"]
        for iou in [silhouette_iou((first, a["pivot"]), (second, b["pivot"]))]
    ]
    if not pairs:
        raise ValueError("비교할 서로 다른 타워 계열이 필요합니다.")
    return pairs, all(pair["pass"] for pair in pairs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="check", required=True)
    sub.add_parser("silhouette", help="계열 간 48px IoU").add_argument("file", type=Path)
    sub.add_parser("palette", help="R04 팔레트 위반").add_argument("file", type=Path, nargs="+")
    sub.add_parser("manifest", help="WebP 해시·치수·스프라이트 검사").add_argument("file", type=Path)
    sprite = sub.add_parser("sprite", help="프레임 크기·수·피벗 검사")
    sprite.add_argument("file", type=Path)
    sprite.add_argument("spec", type=Path)
    scene = sub.add_parser("scene", help="같은 크기의 장면 비교")
    scene.add_argument("reference", type=Path)
    scene.add_argument("candidate", type=Path)
    scene.add_argument("--max-delta", type=int, choices=range(256), default=0, metavar="0..255")
    args = parser.parse_args()

    try:
        if args.check == "silhouette":
            result, passed = silhouette_report(args.file)
        elif args.check == "palette":
            result = {str(path): palette_violations(read_image(path)) for path in args.file}
            passed = not any(result.values())
        elif args.check == "manifest":
            result = manifest_errors(json.loads(args.file.read_text()), args.file.parent)
            passed = not result
        elif args.check == "sprite":
            result = sprite_errors(read_image(args.file), json.loads(args.spec.read_text()))
            passed = not result
        else:
            result = scene_difference(read_image(args.reference), read_image(args.candidate))
            passed = result["maxChannelDelta"] <= args.max_delta
    except (KeyError, TypeError, ValueError, OSError) as error:
        parser.exit(1, f"검사 오류 · {error}\n")
    print(json.dumps({"pass": passed, "result": result}, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
