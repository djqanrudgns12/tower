import io
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from bake import AMBER, LINE, MAX_BYTES, ROOT, TEAL, bake


class MeadowPlateauTest(unittest.TestCase):
    def test_webp_matches_garden_route_and_slots(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "map.webp"
            bake(output)
            data = output.read_bytes()
        checked_in = ROOT / "public/assets/r6/meadow-plateau.webp"
        self.assertEqual(data, checked_in.read_bytes())
        self.assertLessEqual(len(data), MAX_BYTES)
        with Image.open(io.BytesIO(data)) as image:
            self.assertEqual((image.format, image.size), ("WEBP", (960, 576)))
            maps = json.loads((ROOT / "docs/contracts/maps.candidate.v0.4.json").read_text())["maps"]
            garden = next(m for m in maps if m["id"] == "garden_u")
            for x, y in garden["pathCells"][1:-3]:
                with self.subTest(path=(x, y)):
                    self.assertEqual(image.getpixel((x * 64 + 32, y * 64 + 32)), (23, 28, 34))
            for slot in garden["slots"]:
                with self.subTest(slot=slot["id"]):
                    self.assertEqual(image.getpixel((slot["x"] * 64 + 32, slot["y"] * 64 + 32)), LINE)
            self.assertIn(AMBER, image.crop((0, 64, 64, 128)).getdata())
            self.assertIn(TEAL, image.crop((896, 448, 960, 512)).getdata())


if __name__ == "__main__":
    unittest.main()
