import json
import math
import unittest

from PIL import Image

from pack import MAX_BYTES, NORM_SIZE, HIGH_SIZE, ROOT, VRAM_BUDGET_BYTES


ASSETS = ROOT / "public/assets/r6/map"
SPEC = json.loads((ROOT / "src/game/r6/mapProjection.json").read_text())
MAPS = json.loads((ROOT / "docs/contracts/maps.candidate.v0.4.json").read_text())["maps"]
GARDEN = next(m for m in MAPS if m["id"] == "garden_u")


def road_pixel(x, y):
    ray_x, ray_y, ray_z = SPEC["cameraRay"]
    horizontal = math.hypot(ray_x, ray_y)
    squash = ray_z / math.hypot(horizontal, ray_z)
    x, y = x - 7, y - 4
    scale = SPEC["pixelsPerCell"] / horizontal
    origin_x, origin_y = SPEC["center"]
    return (
        round(origin_x + scale * (-ray_y * x - ray_x * y)),
        round(origin_y + scale * squash * (ray_x * x - ray_y * y)),
    )


class ProjectedMapAssetsTest(unittest.TestCase):
    def test_baked_road_covers_every_playable_cell_center(self):
        background = ASSETS / "meadow-plateau.webp"
        self.assertLessEqual(background.stat().st_size, MAX_BYTES)
        with Image.open(background) as image:
            self.assertEqual((image.format, image.size), ("WEBP", (960, 576)))
            for x, y in GARDEN["pathCells"]:
                with self.subTest(cell=(x, y)):
                    r, g, b = image.getpixel(road_pixel(x, y))
                    self.assertGreater(r + g + b, 155)

    def test_two_pad_frames_share_opaque_foot_and_transparent_padding(self):
        w, h = SPEC["padSize"]
        px, py = SPEC["padPivot"]
        with Image.open(ASSETS / "meadow-pads.webp") as image:
            self.assertEqual((image.format, image.size, image.mode), ("WEBP", (w * 2, h), "RGBA"))
            idle, active = (image.crop((i * w, 0, (i + 1) * w, h)) for i in range(2))
            self.assertEqual(idle.getchannel("A").tobytes(), active.getchannel("A").tobytes())
            self.assertEqual(idle.getpixel((0, 0))[3], 0)
            self.assertEqual(idle.getpixel((px, py))[3], 255)
            self.assertGreater(active.getpixel((px, py))[0], idle.getpixel((px, py))[0])

    def test_v2_multilayer_biomes_vram_and_gate_split(self):
        meta = json.loads((ASSETS / "map-v2-meta.json").read_text())
        self.assertLessEqual(meta["highVramMiB"] * 1024 * 1024, VRAM_BUDGET_BYTES)

        # 2× 고해상도 설치대 검증
        w2, h2 = SPEC["padSize"][0] * 2, SPEC["padSize"][1] * 2
        with Image.open(ASSETS / "meadow-pads-2x.webp") as pads2x:
            self.assertEqual(pads2x.size, (w2 * 2, h2))

        # 4대 학년 바이옴 × 주간/다크 × 1x/2x 검증
        for biome in ("meadow", "river", "ochre", "snow"):
            for theme in ("day", "dark"):
                entry = meta["terrains"][f"{biome}-{theme}"]
                with Image.open(ASSETS / entry["1x"]["file"]) as img1x:
                    self.assertEqual(img1x.size, NORM_SIZE)
                with Image.open(ASSETS / entry["2x"]["file"]) as img2x:
                    self.assertEqual(img2x.size, HIGH_SIZE)

        # 성문 앞/뒤 투명 POT 및 경계 비잘림 검증
        ov = SPEC["overview"]
        for key in ("gateBack", "gateFront"):
            g = meta[key]
            with Image.open(ASSETS / g["file"]) as gate_img:
                self.assertEqual(list(gate_img.size), g["potSize"])
                self.assertEqual(gate_img.mode, "RGBA")
                self.assertIsNotNone(gate_img.getbbox())
            self.assertGreaterEqual(g["worldX"], ov["x"])
            self.assertGreaterEqual(g["worldY"], ov["y"])
            self.assertLessEqual(
                g["worldX"] + g["contentSize"][0] / HIGH_SIZE[0] * ov["width"],
                ov["x"] + ov["width"] + 1,
            )
            self.assertLessEqual(
                g["worldY"] + g["contentSize"][1] / HIGH_SIZE[1] * ov["height"],
                ov["y"] + ov["height"] + 1,
            )

        with Image.open(ASSETS / "wave-aura.webp") as aura_img:
            self.assertEqual(aura_img.size, (256, 256))
            self.assertLessEqual((ASSETS / "wave-aura.webp").stat().st_size, 128 * 1024)


if __name__ == "__main__":
    unittest.main()
