import io
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw

from bake import AMBER, CELL, EDGE_CLUSTERS, MAX_BYTES, ROOT, TEAL, bake, center, props

MAPS = json.loads((ROOT / 'docs/contracts/maps.candidate.v0.4.json').read_text())['maps']
GARDEN = next(m for m in MAPS if m['id'] == 'garden_u')


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
            path_min = 65 * 3
            for x, y in GARDEN["pathCells"][1:-2]:
                with self.subTest(path=(x, y)):
                    self.assertGreaterEqual(sum(image.getpixel(center((x, y)))), path_min)
            for slot in GARDEN["slots"]:
                with self.subTest(slot=slot["id"]):
                    self.assertLess(sum(image.getpixel(center((slot["x"], slot["y"])))), path_min * 0.65)
            self.assertGreater(sum(image.getpixel((400, 74))), sum(image.getpixel((400, 96))))
            self.assertIn(AMBER, image.crop((0, 64, 64, 128)).getdata())
            self.assertIn(TEAL, image.crop((896, 448, 960, 512)).getdata())
            self.assertIn(TEAL, image.crop((928, 492, 960, 517)).getdata())

    def test_rock_clusters_leave_path_and_pad_cells_clear(self):
        mask = Image.new('RGB', (960, 576))
        props(ImageDraw.Draw(mask), GARDEN)
        self.assertGreaterEqual(len(EDGE_CLUSTERS), 2)
        self.assertLessEqual(len(EDGE_CLUSTERS), 4)

        def cell_box(x, y):
            return x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL

        for x, y in EDGE_CLUSTERS:
            self.assertTrue(x in (0, 14) or y in (0, 8))
            self.assertIsNotNone(mask.crop(cell_box(x, y)).getbbox())
        blocked = [*GARDEN['pathCells'], *((s['x'], s['y']) for s in GARDEN['slots'])]
        for x, y in blocked:
            with self.subTest(blocked=(x, y)):
                self.assertIsNone(mask.crop(cell_box(x, y)).getbbox())


if __name__ == "__main__":
    unittest.main()
