"""합성 파츠로 입력 오류·좌표·단계 및 종족 검사를 검증한다."""

from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image, ImageDraw

from batch import resolve_display_scale, white_patches
from contrast import INTERIOR_DELTA_E_LIMIT, OUTLINE_EFFECTIVE_ALPHA, OUTLINE_RGB, apply_outer_outline, interior_color_delta_e
from cut_parts import cut, orient_parts
from fit_parts import fit
from monsters import ACTORS, compose_rig, prepare, read_json
from part_guides import CANVAS, SHEET, guide_data
from parts import extract, suggest_pivot
from pilot import write_json
from review import ground_contrast, review, review_images, silhouette
from rig_audit import MIN_JOINT_PIXELS, hinge_pixels, measure, overlap_pixels, rasterize
from rigs import VARIANTS, layout
from sample import generate
from swarm import animate_swarm
from white_key import clean


FIXTURE = Path(__file__).resolve().parents[3] / "asset-source/r6/monsters/_pipeline-test/species.json"


class MonsterPipelineTest(unittest.TestCase):
    def test_cross_species_color_keeps_silhouette_results(self):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            images = {}
            for species, color in (("machine", "#1D242C"), ("stone", "#1D242C"), ("elf", "#E69F24")):
                actor = f"{species}-infantry-t1"
                path = root / (actor + ".png")
                Image.new("RGBA", (32, 48), color).save(path)
                images[species] = {actor: path}
            with redirect_stdout(StringIO()):
                self.assertEqual(review_images(images, root), 3)
            report = read_json(root / "silhouettes.json")
            self.assertEqual(report["speciesLimit"], .55)
            self.assertEqual([g["failures"][0]["iou"] for g in report["crossSpecies"]], [1, 1, 1])
            color = report["crossSpeciesColor"]
            self.assertEqual(len(color["A"]), 2)
            self.assertEqual([(p["first"], p["second"], p["deltaE"]) for p in color["B"]],
                             [("machine-infantry-t1", "stone-infantry-t1", 0)])
            self.assertTrue((root / "cross-species-worst.webp").is_file())

    def test_white_key_edge_and_matted_pixel(self):
        image = Image.new("RGBA", (20, 20), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((3, 3, 15, 15), fill=(80, 100, 120, 255))
        image.putpixel((3, 8), (168, 178, 188, 128))
        cleaned, mask, stats = clean(image)
        self.assertEqual(stats["removedPixels"], 400 - 13**2)
        self.assertEqual(mask.getpixel((0, 0)), 255)
        self.assertEqual(cleaned.getpixel((0, 0))[3], 0)
        self.assertEqual(cleaned.getpixel((3, 8)), (82, 102, 122, 128))
        self.assertEqual(image.getpixel((0, 0))[3], 255)

    def test_white_key_closed_gap(self):
        image = Image.new("RGBA", (18, 18), "#4A5563")
        ImageDraw.Draw(image).rectangle((4, 6, 9, 10), fill=(241, 242, 240, 255))
        cleaned, _, stats = clean(image)
        self.assertEqual(stats["removedPixels"], 30)
        self.assertEqual(cleaned.getpixel((8, 10))[3], 0)
        self.assertEqual(cleaned.getpixel((3, 6)), image.getpixel((3, 6)))

    def test_white_key_keeps_marks(self):
        image = Image.new("RGBA", (32, 32), "#1D242C")
        draw = ImageDraw.Draw(image)
        for box in ((2, 2, 4, 4), (2, 8, 28, 8), (8, 12, 16, 20)):
            draw.rectangle(box, fill="white")
        draw.rectangle((2, 24, 24, 28), fill="#B8C0C8")
        cleaned, _, stats = clean(image, [(8, 12, 17, 21)])
        self.assertEqual(stats["removedPixels"], 0)
        self.assertEqual(cleaned.tobytes(), image.tobytes())

    def test_white_patch_requires_opaque_connected_near_white_pixels(self):
        image = Image.new("RGBA", (24, 16), (255, 255, 255, 0))
        draw = ImageDraw.Draw(image)
        draw.rectangle((1, 1, 4, 3), fill=(240, 242, 255, 255))
        draw.rectangle((5, 4, 8, 6), fill=(255, 255, 255, 255))
        draw.rectangle((12, 1, 15, 5), fill=(255, 255, 255, 255))
        draw.rectangle((1, 9, 9, 15), fill=(239, 255, 255, 255))
        draw.rectangle((11, 9, 19, 15), fill=(255, 255, 255, 200))
        self.assertEqual(white_patches(image), [{"pixels": 24, "box": [1, 1, 9, 7]}])

    def test_swarm_hinge_preserves_skin_positions_and_loops(self):
        covers = [{"x": x, "y": 2, "width": 30, "height": 20, "scaleX": .5, "scaleY": .5} for x in (4, 9)]
        rig = {"slots": [{"name": "armor", "bone": "body"}], "bones": [],
               "skins": [{"attachments": {"armor": {"armor": cover}}} for cover in covers],
               "animations": {"walk": {"bones": {"body": {"translate": [{"time": .8}]}, "swarm-1": {}}}}}
        animate_swarm(rig)
        hinge, = rig["bones"]
        self.assertEqual(rig["slots"][0]["bone"], hinge["name"])
        self.assertEqual(hinge["parent"], "body")
        for x, cover in zip((4, 9), covers):
            self.assertEqual((hinge["x"] + cover["x"], hinge["y"] + cover["y"]), (x, 2))
        walk = rig["animations"]["walk"]["bones"]
        for name in ("swarm-1", hinge["name"]):
            keys = walk[name]["rotate"]
            self.assertEqual(keys[0]["value"], keys[-1]["value"])
            self.assertNotEqual(keys[1]["value"], keys[0]["value"])

    def test_rotated_part_preserves_source_box_and_fixed_joint(self):
        part = Image.new("RGBA", (8, 24), (74, 85, 99, 255))
        source_box = [12, 20, 20, 44]
        pieces = orient_parts({"body": [(part, source_box)]}, {"body": -90})
        (turned, original), = pieces["body"]
        self.assertEqual((turned.size, original), ((24, 8), source_box))
        reference = Image.new("RGBA", CANVAS)
        reference.paste(turned, (105, 108))
        placement = {"targets": {"body": [100, 108, 124, 116]}, "fixedTargets": ["body"]}
        pivots = {"body": [107, 112]}
        fit(pieces, guide_data("infantry", "biped"), reference, placement, pivots)
        self.assertEqual(placement["targets"]["body"], [100, 108, 124, 116])
        self.assertEqual(placement["pivots"], pivots)

    def test_guide_cut_reports_crossings_and_disconnected_pieces(self):
        with TemporaryDirectory() as tmp, redirect_stdout(StringIO()):
            root = Path(tmp)
            guide = guide_data("infantry", "biped")
            write_json(root / "guide.json", guide)
            reference = Image.new("RGBA", CANVAS)
            ImageDraw.Draw(reference).ellipse((81, 60, 175, 215), fill=(100, 150, 180, 255))
            reference.save(root / "reference.png")
            sheet = Image.new("RGBA", SHEET)
            draw = ImageDraw.Draw(sheet)
            required = {name for name, slot in guide["slots"].items() if slot["required"]}
            for name in required:
                x, y, _, _ = guide["slots"][name]["box"]
                draw.ellipse((x + 35, y + 20, x + 68, y + 74), fill=(100, 150, 180, 220))
            sheet.save(root / "sheet.png")
            args = (root / "sheet.png", root / "reference.png", root / "guide.json")
            identity = ("machine", "infantry", "T1")
            self.assertTrue(cut(*args, root / "ready", *identity))
            self.assertEqual({p.stem for p in (root / "ready/infantry/T1").glob("*.png")}, required)
            with Image.open(root / "ready/infantry/T1/head.png") as part:
                self.assertEqual((part.mode, part.size), ("RGBA", CANVAS))
                self.assertGreater(part.getchannel("A").getextrema()[1], 0)
            prepare(root / "ready", root / "work", ("infantry", "T1"))
            pack = read_json(root / "work/manifest-fragment.json")["species"]["machine"]
            self.assertEqual(set(pack["entities"]), {"machine-infantry-t1"})
            self.assertNotIn("tierSkins", pack["fallback"])
            x, y, right, _ = guide["slots"]["body"]["box"]
            draw.rectangle((x + 80, y + 30, x + 104, y + 60), fill=(100, 150, 180, 255))
            draw.rectangle((right - 4, y + 80, right + 31, y + 90), fill=(100, 150, 180, 255))
            sheet.save(root / "sheet.png")
            self.assertFalse(cut(*args, root / "rejected", *identity))
            issues = read_json(root / "rejected/report.json")["issues"]
            self.assertIn("crossing_cells", {issue["code"] for issue in issues})
            self.assertIn("multiple_components", {issue["code"] for issue in issues})
            self.assertFalse((root / "rejected/species.json").exists())

    def test_templates_have_motion_and_unique_slot_bindings(self):
        for family, variants in VARIANTS.items():
            for variant in variants:
                with self.subTest(family=family, variant=variant):
                    _, bones, slots, clips = layout(family, {"variant": variant})
                    self.assertEqual(len({slot.name for slot in slots}), len(slots))
                    self.assertTrue(all(slot.bone in bones for slot in slots))
                    for timeline in clips["walk"]["bones"].values():
                        for channel, keys in timeline.items():
                            if channel == "rotate":
                                self.assertAlmostEqual((keys[-1]["value"] - keys[0]["value"]) % 360, 0)
                            else:
                                self.assertEqual([keys[0]["x"], keys[0]["y"]], [keys[-1]["x"], keys[-1]["y"]])
                    self.assertEqual("boss-skill" in clips, family == "boss")

    def test_crop_keeps_setup_position_and_optional_slot_absence(self):
        with TemporaryDirectory() as tmp:
            out = Path(tmp)
            generate(FIXTURE, out / "source")
            textures = out / "parts"
            textures.mkdir()
            config = read_json(FIXTURE)
            rig, preview, _ = compose_rig(out / "source", textures, tuple(config["canvas"]), config["root"],
                                           config["pixelsPerUnit"], "qa", "infantry", "infantry", ACTORS["infantry"], {})
            bones = {}
            for bone in rig["bones"]:
                px, py = bones.get(bone.get("parent"), (0, 0))
                bones[bone["name"]] = (px + bone.get("x", 0), py + bone.get("y", 0))
            body = rig["skins"][0]["attachments"]["body"]["body"]
            bone_x, bone_y = bones["body"]
            with Image.open(out / "source/infantry/T1/body.png") as image:
                left, top, right, bottom = image.getbbox()
            distance = config["pixelsPerUnit"]
            self.assertAlmostEqual((bone_x + body["x"]) * distance + config["root"][0], (left + right) / 2)
            self.assertAlmostEqual(config["root"][1] - (bone_y + body["y"]) * distance, (top + bottom) / 2)
            self.assertAlmostEqual(body["width"] * body["scaleX"], (right - left) / distance)
            self.assertNotIn("gear", rig["skins"][0]["attachments"])
            self.assertIn("gear", rig["skins"][1]["attachments"])
            self.assertIsNotNone(preview["T1"].getbbox())

    def test_skin_slot_plan_keeps_other_skins_and_mounts_gear_on_the_far_hand(self):
        with TemporaryDirectory() as tmp:
            out = Path(tmp)
            generate(FIXTURE, out / "source")
            textures = out / "parts"
            textures.mkdir()
            config = read_json(FIXTURE)
            profile = {"views": {"T2": {"headFront": True, "gearBone": "arm-hand-far"}}}
            rig, _, _ = compose_rig(out / "source", textures, tuple(config["canvas"]), config["root"],
                                    config["pixelsPerUnit"], "qa", "infantry", "infantry", ACTORS["infantry"], profile)
            skins = {skin["name"]: skin["attachments"] for skin in rig["skins"]}
            slots = {slot["name"]: slot["bone"] for slot in rig["slots"]}
            self.assertLess(list(slots).index("head"), list(slots).index("head-front"))
            self.assertIn("head", skins["T1"])
            self.assertNotIn("head-front", skins["T1"])
            self.assertNotIn("head", skins["T2"])
            self.assertIn("head", skins["T2"]["head-front"])
            self.assertEqual(slots["gear-on-arm-hand-far"], "arm-hand-far")
            self.assertEqual(skins["T2"]["gear-on-arm-hand-far"]["gear"]["path"], "qa-t2-gear")
            self.assertNotIn("gear", skins["T2"])

    def test_joint_raster_counts_only_solid_pixels_around_the_pivot(self):
        image = Image.new("L", (5, 3), 255)
        image.putpixel((0, 0), 127)
        first = rasterize(image, [[0, 0], [5/3, 0], [0, -1]])
        second = rasterize(image, [[1, 0], [8/3, 0], [1, -1]])
        self.assertEqual(overlap_pixels(first, second), MIN_JOINT_PIXELS - 1)
        self.assertEqual(hinge_pixels(first, second, [1, -.5]), MIN_JOINT_PIXELS - 1)
        self.assertEqual(hinge_pixels(first, second, [20, 0]), 0)

    def test_joint_audit_records_the_worst_pose_in_consecutive_clips(self):
        image = Image.new("RGBA", (12, 5), (0, 0, 0, 255))
        def pose(clip, offset):
            return {"clip": clip, "phase": .5, "pivots": {"arm-near": [1, 0]}, "slots": {
                "body": {"box": [0, 0, 6, 5], "vertices": [[0, 0], [2, 0], [0, -5/3]]},
                "arm-near": {"box": [6, 0, 12, 5],
                             "vertices": [[offset, 0], [offset + 2, 0], [offset, -5/3]]},
            }}
        actor = {"slots": {"body": "body", "arm-near": "arm-near"}, "parents": {"body": "root", "arm-near": "body"},
                 "poses": [pose("walk", 1)] * 13 + [pose("hit", 2)] * 10 + [pose("fall", 1)] * 10}
        report = measure(actor, image)
        self.assertEqual(report["poses"], 33)
        self.assertEqual(report["joints"]["arm-near"], {"parent": "body", "pixels": 0, "pose": ["hit", .5]})

    def test_prepare_rejects_missing_required_part_without_partial_output(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            generate(FIXTURE, root / "source")
            (root / "source/infantry/T2/body.png").unlink()
            with self.assertRaisesRegex(ValueError, "누락.*body"):
                prepare(root / "source", root / "work")
            self.assertFalse((root / "work").exists())

    def test_mask_preserves_alpha_placement_and_peels_speckles(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            image = Image.new("RGBA", (10, 10), (0, 120, 130, 180))
            image.save(root / "source.png")
            mask = Image.new("L", (10, 10))
            ImageDraw.Draw(mask).rectangle((3, 3, 6, 6), fill=255)
            mask.putpixel((0, 0), 255)
            mask.save(root / "mask.png")
            write_json(root / "spec.json", {"canvas": [16, 16], "parts": {"body": {
                "box": [0, 0, 10, 10], "position": [2, 4], "mask": "mask.png", "removeSpecks": True,
            }}})
            extract(root / "source.png", root / "spec.json", root / "parts")
            with Image.open(root / "parts/body.png") as part:
                self.assertEqual(part.getbbox(), (5, 7, 9, 11))
                self.assertEqual(part.getpixel((5, 7))[3], 180)
                self.assertEqual(suggest_pivot(part, (4, 7), 3), (5.5, 7.5))

    def test_review_gates_all_cross_species_pairs(self):
        with TemporaryDirectory() as tmp, redirect_stdout(StringIO()):
            root = Path(tmp)
            for species in ("machine", "human"):
                source, pack = root / f"{species}-source", root / species
                generate(FIXTURE, source)
                config = read_json(source / "species.json")
                write_json(source / "species.json", {**config, "species": species})
                prepare(source, pack)
            self.assertGreater(review([root / "machine", root / "human"], root / "qa"), 0)
            result = read_json(root / "qa/silhouettes.json")
            self.assertTrue(all(pair["pass"] for pair in result["evolution"]))
            cross, = result["crossSpecies"]
            self.assertEqual(cross["comparisons"], 400)
            self.assertEqual(cross["max"]["iou"], 1)
            self.assertFalse(cross["max"]["pass"])
            for species, pairs in result["bossVsRegular"].items():
                self.assertEqual(len(pairs), 64)
                self.assertTrue(all(pair["first"].startswith(species + "-boss-") for pair in pairs))
                self.assertTrue(all(pair["second"].startswith(species + "-") and "-boss-" not in pair["second"]
                                    for pair in pairs))

    def test_contrast_uses_visible_pixels_on_each_ground_color(self):
        icon = Image.new("RGBA", (32, 32))
        icon.putpixel((12, 12), (74, 85, 99, 255))
        result = ground_contrast(icon, silhouette(icon))
        self.assertEqual(result["path"], {"median": 1.0, "lowShare": 1.0})
        self.assertGreater(result["terrain"]["median"], 1.5)
        self.assertEqual(result["terrain"]["lowShare"], 0.0)

    def test_placement_display_scale_overrides_parts_scale(self):
        meta = {"scale": 1.0}
        self.assertEqual(resolve_display_scale(meta, {}), 1.0)
        self.assertEqual(resolve_display_scale(meta, {"displayScale": 1.45}), 1.45)
        with self.assertRaises(ValueError):
            resolve_display_scale(meta, {"displayScale": 0})

    def test_outer_outline_preserves_interior_colors_and_avoids_internal_seams(self):
        body = Image.new("RGBA", (32, 32))
        arm = Image.new("RGBA", (32, 32))
        ImageDraw.Draw(body).rectangle((6, 6, 22, 22), fill=(70, 80, 94, 255))
        ImageDraw.Draw(body).rectangle((6, 6, 22, 22), outline=(18, 22, 27, 255))
        ImageDraw.Draw(arm).rectangle((14, 10, 26, 20), fill=(72, 78, 88, 255))
        ImageDraw.Draw(arm).rectangle((14, 10, 26, 20), outline=(18, 22, 27, 255))
        composed = Image.alpha_composite(body, arm)
        padded = Image.new("RGBA", (34, 34))
        padded.paste(composed, (1, 1))
        outlined = apply_outer_outline(composed, pad=1)
        # 불투명 내부 화소 및 부위 이음매(15+1, 14+1)의 RGB는 원본과 완전히 같고 ΔE76은 3 이하(실측 0)다.
        self.assertEqual(outlined.getpixel((16, 15)), padded.getpixel((16, 15)))
        self.assertEqual(outlined.getpixel((8, 8)), padded.getpixel((8, 8)))
        self.assertLessEqual(interior_color_delta_e(padded, outlined), INTERIOR_DELTA_E_LIMIT)
        self.assertEqual(white_patches(outlined), [])
        # 실루엣 바깥 1px에는 R04 은회 저불투명도 테두리가 생기고 2px 바깥은 투명하다.
        expected_alpha = round(255 * OUTLINE_EFFECTIVE_ALPHA)
        self.assertEqual(outlined.getpixel((6, 6)), (*OUTLINE_RGB, expected_alpha))
        self.assertEqual(outlined.getpixel((5, 5))[3], 0)
        # 어두운 개체의 저대비 화소 비율이 줄고 바닥 대비가 개선된다.
        before = ground_contrast(composed, silhouette(composed))
        after = ground_contrast(outlined, silhouette(outlined))
        self.assertLess(after["path"]["lowShare"], before["path"]["lowShare"])
        self.assertLessEqual(after["terrain"]["lowShare"], before["terrain"]["lowShare"])


if __name__ == "__main__":
    unittest.main()
