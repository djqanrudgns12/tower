import hashlib
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageDraw

from check import manifest_errors, palette_violations, scene_difference, silhouette_iou, sprite_errors


class QualityChecks(unittest.TestCase):
    def test_pivot_aligned_silhouettes(self):
        first = Image.new("RGBA", (48, 48))
        second = first.copy()
        ImageDraw.Draw(first).rectangle((0, 0, 23, 23), fill="white")
        ImageDraw.Draw(second).rectangle((12, 0, 35, 23), fill="white")
        self.assertAlmostEqual(silhouette_iou((first, [0, 0]), (second, [0, 0])), 1 / 3)
        self.assertEqual(silhouette_iou((first, [0, 0]), (second, [12, 0])), 1)

    def test_palette_shades_and_opaque_off_palette_colors(self):
        image = Image.new("RGBA", (4, 1))
        image.putdata([(47, 181, 163, 255), (35, 134, 121, 255), (255, 0, 255, 255), (255, 0, 255, 120)])
        self.assertEqual(palette_violations(image), 1)

    def test_sprite_dimensions_pivot_and_trailing_blank(self):
        sheet = Image.new("RGBA", (8, 4))
        sheet.putpixel((1, 1), (18, 22, 27, 255))
        spec = {"frameWidth": 4, "frameHeight": 4, "frameCount": 1, "pivot": [2, 3]}
        self.assertEqual(sprite_errors(sheet, spec), [])
        self.assertIn("1번 칸", sprite_errors(sheet, dict(spec, frameCount=2))[0])
        self.assertIn("피벗", sprite_errors(sheet, dict(spec, pivot=[4, 3]))[0])
        self.assertIn("정수배", sprite_errors(sheet, dict(spec, frameWidth=3))[0])

    def test_manifest_checks_webp_hash_and_escape(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "asset.webp"
            Image.new("RGBA", (2, 3), "#12161B").save(path, lossless=True)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            entry = {"id": "a", "file": path.name, "width": 2, "height": 3, "artifactHash": digest}
            self.assertEqual(manifest_errors({"assets": [entry]}, root), [])
            self.assertIn("SHA-256 불일치", manifest_errors({"assets": [dict(entry, artifactHash="0" * 64)]}, root)[0])
            self.assertIn("상대 WebP", manifest_errors({"assets": [dict(entry, file="../asset.webp")]}, root)[0])

    def test_scene_ignores_hidden_color_and_detects_visible_change(self):
        first = Image.new("RGBA", (2, 1), (255, 0, 0, 0))
        second = Image.new("RGBA", (2, 1), (0, 255, 0, 0))
        second.putpixel((0, 0), (20, 28, 32, 255))
        self.assertEqual(scene_difference(first, second), {"changedPixels": 1, "maxChannelDelta": 6})


if __name__ == "__main__":
    unittest.main()
