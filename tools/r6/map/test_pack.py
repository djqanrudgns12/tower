import json
import math
import unittest

from PIL import Image

from pack import MAX_BYTES, ROOT


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
    return (round(origin_x + scale * (-ray_y * x - ray_x * y)),
            round(origin_y + scale * squash * (ray_x * x - ray_y * y)))


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


if __name__ == "__main__":
    unittest.main()
