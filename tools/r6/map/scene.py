"""Blender 5.2 LTS에서 R6 V2 S++ 다층 지형 · 4학년 바이옴 · 성문 앞/뒤 패스 · 2× 설치대를 렌더한다."""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "tools/r6/blender"))
from mortar_render import CAMERA_RAY

SPEC = json.loads((ROOT / "src/game/r6/mapProjection.json").read_text())
MAPS = json.loads((ROOT / "docs/contracts/maps.candidate.v0.4.json").read_text())["maps"]
PLATEAU = next(m for m in MAPS if m["id"] == "garden_u")

PALETTE = {
    "carbon": (18, 22, 27),
    "slate": (29, 36, 44),
    "line": (74, 85, 99),
    "silver": (184, 192, 200),
    "amber": (230, 159, 36),
    "teal": (47, 181, 163),
}

RIDGES = (
    (1.1, 1.9, 3.9, 2.3, 24),
    (10.7, 3.5, 4.6, 3.3, 25),
    (5.2, 7.5, 6.1, 3.4, 46),
    (6.0, 3.5, 2.4, 2.6, -30),
    (6.9, 2.04, 4.6, 0.68, 57),
    (7.7, 4.06, 4.3, 0.75, 52),
    (-5.2, 7.0, 5.1, 8.3, 41),
    (14.9, -1.4, 5.3, 3.9, 48),
    (1.0, -5.6, 7.4, 3.9, 76),
    (10.7, -4.7, 7.2, 3.7, 64),
    (5.7, 11.2, 4.4, 4.3, 31),
    (20.8, 7.4, 5.4, 5.7, 43),
)
CLUSTERS = ((5.45, 0.25), (14.35, 5.5), (4.25, 8.75), (0.3, 6.4), (-1.2, 2.1), (8.2, -3.5))
TREE_SPOTS = ((-1.35, 1.95, 0.52), (-0.75, 3.10, 0.42), (7.65, -3.75, 0.48), (9.05, -2.90, 0.40), (3.85, 10.65, 0.46), (9.45, 10.45, 0.44))

STEP = 0.25
LEVELS = (12, 22, 32, 42, 52, 62, 72, 82)
TREADS = (-1.52, -1.38, -1.22, -1.04, -0.84, -0.65, -0.46, -0.27, -0.09)
SHADOW_BAND = 2.2
WORLD = (960, 576)
HIGH_SIZE = (2090, 1308)
PPC = SPEC["pixelsPerCell"]
RIGHT = Vector((0, 0, 1)).cross(CAMERA_RAY).normalized()
LIGHT_DIR = (CAMERA_RAY * 0.27 - RIGHT * 0.74 + Vector((0, 0, 0.72))).normalized()
BACK = Vector((CAMERA_RAY.x, CAMERA_RAY.y, 0)).normalized()

BIOME_SPECS = {
    "meadow": {
        "day": {
            "land_lo": (146, 198, 126), "land_hi": (198, 228, 174),
            "lip_lo": (124, 176, 108), "lip_hi": (178, 212, 152),
            "riser": (70, 86, 98), "cliff": (52, 66, 78), "ledge": (110, 154, 96),
            "road": (236, 232, 220), "curb": (208, 216, 224), "joint": (182, 184, 178),
            "line": (96, 112, 128), "carbon": (22, 28, 34), "rock": (116, 132, 146),
            "foliage_lo": (72, 146, 92), "foliage_hi": (122, 194, 120), "water": (52, 196, 182),
            "water_foam": (176, 245, 240), "survey": (142, 176, 132),
            "gate_stone": (212, 220, 228), "gate_trim": (58, 72, 84), "portal_core": (142, 246, 236),
        },
        "dark": {
            "land_lo": (26, 34, 42), "land_hi": (56, 68, 82),
            "lip_lo": (58, 70, 84), "lip_hi": (92, 106, 122),
            "riser": (34, 42, 52), "cliff": (24, 30, 38), "ledge": (20, 26, 33),
            "road": (96, 110, 126), "curb": (146, 160, 174), "joint": (64, 76, 90),
            "line": (74, 85, 99), "carbon": (18, 22, 27), "rock": (78, 90, 104),
            "foliage_lo": (32, 66, 64), "foliage_hi": (48, 98, 92), "water": (38, 156, 144),
            "water_foam": (118, 226, 214), "survey": (46, 56, 68),
            "gate_stone": (96, 110, 126), "gate_trim": (38, 48, 58), "portal_core": (118, 238, 226),
        },
    },
    "river": {
        "day": {
            "land_lo": (142, 196, 186), "land_hi": (196, 228, 220),
            "lip_lo": (114, 172, 162), "lip_hi": (166, 208, 198),
            "riser": (64, 86, 94), "cliff": (48, 68, 76), "ledge": (106, 156, 146),
            "road": (233, 240, 242), "curb": (196, 214, 218), "joint": (172, 190, 194),
            "line": (88, 110, 118), "carbon": (20, 28, 32), "rock": (108, 134, 140),
            "foliage_lo": (58, 142, 118), "foliage_hi": (104, 192, 158), "water": (40, 188, 180),
            "water_foam": (186, 248, 244), "survey": (126, 176, 166),
            "gate_stone": (204, 222, 226), "gate_trim": (52, 74, 82), "portal_core": (148, 248, 242),
        },
        "dark": {
            "land_lo": (22, 36, 42), "land_hi": (48, 74, 82),
            "lip_lo": (50, 76, 86), "lip_hi": (84, 114, 124),
            "riser": (30, 46, 54), "cliff": (20, 32, 38), "ledge": (18, 28, 34),
            "road": (94, 116, 124), "curb": (142, 168, 176), "joint": (62, 82, 90),
            "line": (72, 92, 102), "carbon": (16, 22, 26), "rock": (74, 96, 104),
            "foliage_lo": (28, 72, 68), "foliage_hi": (46, 108, 100), "water": (38, 162, 156),
            "water_foam": (122, 232, 226), "survey": (42, 62, 68),
            "gate_stone": (96, 118, 126), "gate_trim": (34, 52, 60), "portal_core": (124, 242, 234),
        },
    },
    "ochre": {
        "day": {
            "land_lo": (204, 174, 132), "land_hi": (234, 214, 182),
            "lip_lo": (184, 148, 106), "lip_hi": (218, 190, 148),
            "riser": (118, 90, 68), "cliff": (92, 68, 52), "ledge": (168, 134, 98),
            "road": (242, 236, 224), "curb": (214, 202, 186), "joint": (190, 178, 162),
            "line": (114, 96, 80), "carbon": (30, 24, 20), "rock": (144, 118, 96),
            "foliage_lo": (124, 148, 84), "foliage_hi": (166, 186, 110), "water": (56, 178, 168),
            "water_foam": (186, 238, 232), "survey": (186, 158, 122),
            "gate_stone": (222, 212, 198), "gate_trim": (86, 70, 58), "portal_core": (250, 212, 126),
        },
        "dark": {
            "land_lo": (40, 32, 26), "land_hi": (78, 62, 50),
            "lip_lo": (84, 66, 54), "lip_hi": (122, 98, 82),
            "riser": (52, 40, 32), "cliff": (36, 28, 22), "ledge": (30, 24, 20),
            "road": (116, 108, 98), "curb": (164, 154, 140), "joint": (82, 72, 64),
            "line": (96, 84, 74), "carbon": (22, 18, 16), "rock": (98, 82, 70),
            "foliage_lo": (56, 74, 48), "foliage_hi": (84, 108, 68), "water": (44, 148, 138),
            "water_foam": (124, 218, 208), "survey": (64, 52, 44),
            "gate_stone": (118, 108, 98), "gate_trim": (54, 44, 38), "portal_core": (244, 188, 86),
        },
    },
    "snow": {
        "day": {
            "land_lo": (184, 204, 224), "land_hi": (228, 238, 248),
            "lip_lo": (158, 184, 210), "lip_hi": (208, 224, 240),
            "riser": (78, 94, 114), "cliff": (60, 74, 92), "ledge": (146, 172, 198),
            "road": (237, 242, 247), "curb": (200, 212, 226), "joint": (176, 190, 206),
            "line": (92, 108, 128), "carbon": (20, 26, 34), "rock": (120, 138, 158),
            "foliage_lo": (70, 128, 136), "foliage_hi": (120, 178, 186), "water": (68, 198, 212),
            "water_foam": (206, 248, 255), "survey": (164, 186, 210),
            "gate_stone": (214, 226, 238), "gate_trim": (64, 80, 98), "portal_core": (162, 242, 255),
        },
        "dark": {
            "land_lo": (26, 34, 46), "land_hi": (56, 70, 90),
            "lip_lo": (62, 78, 100), "lip_hi": (98, 118, 144),
            "riser": (34, 44, 58), "cliff": (24, 32, 44), "ledge": (20, 26, 36),
            "road": (106, 120, 138), "curb": (156, 172, 192), "joint": (72, 86, 104),
            "line": (80, 96, 114), "carbon": (18, 22, 30), "rock": (82, 98, 118),
            "foliage_lo": (34, 68, 84), "foliage_hi": (56, 104, 124), "water": (52, 168, 186),
            "water_foam": (148, 236, 248), "survey": (48, 60, 76),
            "gate_stone": (108, 124, 144), "gate_trim": (42, 54, 70), "portal_core": (138, 234, 252),
        },
    },
}


def lerp_rgb(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def linear(value):
    s = value / 255.0
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


def xyz(x, y, z):
    return (x, -y, z)


def build_palette(biome, theme):
    spec = BIOME_SPECS[biome][theme]
    colors = {
        "carbon": spec["carbon"],
        "slate": PALETTE["slate"],
        "line": spec["line"],
        "silver": PALETTE["silver"],
        "amber": PALETTE["amber"],
        "teal": PALETTE["teal"],
        "cliff": spec["cliff"],
        "curb": spec["curb"],
        "road": spec["road"],
        "joint": spec["joint"],
        "pad": lerp_rgb(spec["line"], PALETTE["silver"], 0.42) if theme == "day" else lerp_rgb(PALETTE["slate"], PALETTE["line"], 0.57),
        "active_pad": lerp_rgb(PALETTE["amber"], (255, 255, 255), 0.78),
        "rock": spec["rock"],
        "survey": spec["survey"],
        "riser": spec["riser"],
        "ledge_shadow": spec["ledge"],
        "water": spec["water"],
        "water_foam": spec["water_foam"],
        "gate_stone": spec["gate_stone"],
        "gate_trim": spec["gate_trim"],
        "portal_core": spec["portal_core"],
        "foliage_lo": spec["foliage_lo"],
        "foliage_hi": spec["foliage_hi"],
    }
    n = max(1, len(TREADS) - 1)
    for i in range(len(TREADS)):
        t = i / n
        colors[f"land{i}"] = lerp_rgb(spec["land_lo"], spec["land_hi"], t)
        colors[f"lip{i}"] = lerp_rgb(spec["lip_lo"], spec["lip_hi"], t)
    return colors


def shade_rgb(rgb, band):
    return (*[linear(min(255, round(v * band))) for v in rgb], 1.0)


def make_materials(colors):
    materials = {}
    bands = (0.78, 0.90, 1.00, 1.10)
    amber_bands = (0.64, 0.80, 0.94, 1.05)
    soft_bands = (0.86, 0.94, 1.00, 1.06)

    for name, rgb in colors.items():
        mat = bpy.data.materials.new(f"R6V2 · {name}")
        mat.diffuse_color = shade_rgb(rgb, 1.0)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        if name in ("portal_core", "teal", "amber", "active_pad"):
            emit = nodes.new("ShaderNodeEmission")
            boost = 1.24 if name == "portal_core" else 1.05
            emit.inputs["Color"].default_value = shade_rgb(rgb, boost)
            emit.inputs["Strength"].default_value = 1.15 if name == "portal_core" else 1.0
            links.new(emit.outputs["Emission"], nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
            materials[name] = mat
            continue

        dot = nodes.new("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        dot.inputs[1].default_value = LIGHT_DIR
        links.new(nodes.new("ShaderNodeNewGeometry").outputs["Normal"], dot.inputs[0])

        ao = nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.45
        ao_map = nodes.new("ShaderNodeMath")
        ao_map.operation = "MULTIPLY_ADD"
        ao_map.inputs[1].default_value = 0.72
        ao_map.inputs[2].default_value = -0.72
        links.new(ao.outputs["AO"], ao_map.inputs[0])

        # 절차 미세 결(±4%): V1 플라스틱 단색을 회화적 석재·초원 질감으로 격상
        tex_coord = nodes.new("ShaderNodeTexCoord")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 26.0 if name.startswith("land") or name == "road" else 34.0
        noise.inputs["Detail"].default_value = 4.0
        noise.inputs["Roughness"].default_value = 0.55
        links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])

        noise_bias = nodes.new("ShaderNodeMath")
        noise_bias.operation = "MULTIPLY_ADD"
        noise_bias.inputs[1].default_value = 0.08
        noise_bias.inputs[2].default_value = -0.04
        links.new(noise.outputs["Fac"], noise_bias.inputs[0])

        light_sum = nodes.new("ShaderNodeMath")
        light_sum.operation = "ADD"
        links.new(dot.outputs["Value"], light_sum.inputs[0])
        links.new(ao_map.outputs[0], light_sum.inputs[1])

        light_textured = nodes.new("ShaderNodeMath")
        light_textured.operation = "ADD"
        links.new(light_sum.outputs[0], light_textured.inputs[0])
        links.new(noise_bias.outputs[0], light_textured.inputs[1])

        ramp_node = nodes.new("ShaderNodeValToRGB")
        ramp = ramp_node.color_ramp
        ramp.interpolation = "B_SPLINE" if (name.startswith("land") or name == "road") else "CONSTANT"
        ramp.elements.remove(ramp.elements[1])
        use_bands = amber_bands if name == "amber" else soft_bands if (name.startswith("land") or name == "road") else bands
        ramp.elements[0].color = shade_rgb(rgb, use_bands[0])
        for thr, b in zip((0.13, 0.49, 0.79), use_bands[1:]):
            ramp.elements.new(thr).color = shade_rgb(rgb, b)
        links.new(light_textured.outputs[0], ramp_node.inputs["Fac"])

        emit = nodes.new("ShaderNodeEmission")
        links.new(ramp_node.outputs["Color"], emit.inputs["Color"])
        links.new(emit.outputs["Emission"], nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
        materials[name] = mat
    return materials


def update_materials(materials, colors):
    bands = (0.78, 0.90, 1.00, 1.10)
    amber_bands = (0.64, 0.80, 0.94, 1.05)
    soft_bands = (0.86, 0.94, 1.00, 1.06)
    for name, rgb in colors.items():
        mat = materials[name]
        mat.diffuse_color = shade_rgb(rgb, 1.0)
        nodes = mat.node_tree.nodes
        if name in ("portal_core", "teal", "amber", "active_pad"):
            for n in nodes:
                if n.type == "EMISSION":
                    n.inputs["Color"].default_value = shade_rgb(rgb, 1.24 if name == "portal_core" else 1.05)
            continue
        use_bands = amber_bands if name == "amber" else soft_bands if (name.startswith("land") or name == "road") else bands
        for n in nodes:
            if n.type == "VALTORGB":
                for elem, b in zip(n.color_ramp.elements, use_bands):
                    elem.color = shade_rgb(rgb, b)


def build_materials_no_noise_road():
    pass


def setup_scene(res_x, res_y, logical_w, logical_h, target, pivot, frame_center=None, transparent=False, freestyle=True, line_scale=1.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 16
    sc.render.film_transparent = transparent
    sc.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    sc.render.resolution_x = res_x
    sc.render.resolution_y = res_y
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    if freestyle:
        sc.render.use_freestyle = True
        vl = sc.view_layers[0]
        vl.freestyle_settings.crease_angle = math.radians(65)
        ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new("R6V2 윤곽")
        ls.select_silhouette = True
        ls.select_crease = True
        ls.select_border = False
        ls.linestyle = bpy.data.linestyles.new("R6V2 카본")
        ls.linestyle.color = (0.008, 0.012, 0.016)
        ls.linestyle.thickness = 0.72 * line_scale

    cam_data = bpy.data.cameras.new("R6V2 카메라")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(logical_w, logical_h) / PPC
    cam = bpy.data.objects.new("R6V2 카메라", cam_data)
    sc.collection.objects.link(cam)
    cam.rotation_euler = (-CAMERA_RAY).to_track_quat("-Z", "Y").to_euler()
    axes = cam.rotation_euler.to_matrix()
    vc_x, vc_y = frame_center if frame_center else (logical_w / 2.0, logical_h / 2.0)
    cam.location = Vector(target) + CAMERA_RAY * 36.0
    cam.location -= axes @ Vector(((pivot[0] - vc_x) / PPC, (vc_y - pivot[1]) / PPC, 0.0))
    sc.camera = cam
    return sc


class Mesh:
    def __init__(self, materials):
        self.materials = materials
        self.vertices, self.faces, self.colors = [], [], []

    def face(self, coords, material):
        if len(coords) < 3 or not material:
            return
        self.faces.append(tuple(range(len(self.vertices), len(self.vertices) + len(coords))))
        self.vertices.extend(coords)
        self.colors.append(material)

    def finish(self, name, collection=None):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        target_col = collection or bpy.context.scene.collection
        target_col.objects.link(obj)
        indices = {}
        for poly, color in zip(mesh.polygons, self.colors):
            if color not in indices:
                indices[color] = len(indices)
                mesh.materials.append(self.materials[color])
            poly.material_index = indices[color]
        return obj


def clip(poly, level, above):
    points = []
    for a, b in zip(poly, (*poly[1:], poly[0])):
        inside = (a[2] >= level) == above
        if inside:
            points.append(a)
        if inside != ((b[2] >= level) == above):
            t = (level - a[2]) / (b[2] - a[2])
            points.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, level))
    return points


def height(x, y):
    ridge = sum(a * math.exp(-((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2) for cx, cy, rx, ry, a in RIDGES)
    return 20 + ridge + 3.8 * math.sin(1.1 * x - 0.66 * y) + 2.5 * math.cos(0.79 * y + 0.38 * x)


def build_terrain(materials):
    mesh = Mesh(materials)
    samples = {(i, j): (i * STEP, j * STEP, height(i * STEP, j * STEP)) for i in range(-44, 105) for j in range(-56, 93)}
    bounds = (-1e9, *LEVELS, 1e9)
    for i in range(-44, 104):
        for j in range(-56, 92):
            a, b, c, d = (samples[k] for k in ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)))
            for tri in ((a, b, c), (a, c, d)):
                lower = min(p[2] for p in tri)
                upper = max(p[2] for p in tri)
                for level, (lo, hi) in enumerate(zip(bounds, bounds[1:])):
                    if upper < lo or lower >= hi:
                        continue
                    section = clip(clip(tri, lo, True), hi, False)
                    if len(section) < 3:
                        continue
                    mesh.face([xyz(x, y, TREADS[level]) for x, y, _ in section], f"land{level}")
                    if level < len(LEVELS) and upper >= hi - SHADOW_BAND:
                        shadow = clip(section, hi - SHADOW_BAND, True)
                        mesh.face([xyz(x, y, TREADS[level] + 0.002) for x, y, _ in shadow], "ledge_shadow")
                    if level == 0:
                        continue
                    for p, q in zip(section, (*section[1:], section[0])):
                        if p[2] != lo or q[2] != lo:
                            continue
                        x, y = p[:2]
                        u, v = q[:2]
                        z = TREADS[level]
                        mesh.face([xyz(u, v, z), xyz(x, y, z), xyz(x, y, z - 0.035), xyz(u, v, z - 0.035)], f"lip{level}")
                        mesh.face([xyz(u, v, z - 0.035), xyz(x, y, z - 0.035), xyz(x, y, TREADS[level - 1]), xyz(u, v, TREADS[level - 1])], "riser")
    return mesh.finish("V2 초원 고원 지형")


def route():
    cells = PLATEAU["pathCells"]
    points = [Vector((x + 0.5, y + 0.5)) for x, y in cells]
    # 입구(-0.35, 1.50)에서 성문 내부(15.05, 7.50)까지 끊김 없이 연장 + 코너 r=0.45칸(포장 반폭 0.34 대비 0.318 < 0.34 이탈 0px, 내측 폴드 0)
    ends = [points[0] - (points[1] - points[0]) * 0.85, points[-1] + (points[-1] - points[-2]) * 0.55]
    nodes = [ends[0]]
    for a, b, c in zip(points, points[1:], points[2:]):
        if b - a == c - b:
            continue
        start, end = b - (b - a) * 0.45, b + (c - b) * 0.45
        for i in range(9):
            t = i / 8.0
            nodes.append((1 - t) ** 2 * start + 2 * t * (1 - t) * b + t ** 2 * end)
    return [*nodes, ends[1]]


def road_edges(nodes, offset):
    widths = []
    for i, point in enumerate(nodes):
        prev = nodes[max(0, i - 1)]
        nxt = nodes[min(len(nodes) - 1, i + 1)]
        tangent = (nxt - prev).normalized()
        normal = Vector((-tangent.y, tangent.x))
        widths.append(point + offset * normal)
    # 코너 내측 자기교차(bow-tie) 완전 제거: 중심선 방향과 역전된 인접 구간을 단조 접합점으로 수렴
    for _pass in range(4):
        changed = False
        for i in range(1, len(widths) - 1):
            center_dir = nodes[i + 1] - nodes[i - 1]
            if center_dir.length < 1e-6:
                continue
            d1 = (widths[i] - widths[i - 1]).dot(center_dir)
            d2 = (widths[i + 1] - widths[i]).dot(center_dir)
            if d1 < 0 or d2 < 0:
                mid = (widths[i - 1] + widths[i + 1]) * 0.5
                widths[i] = mid
                changed = True
        if not changed:
            break
    # 연속 9점 코너 그룹에서 역전된 삼각 팬이 남지 않도록 후방/전방 단조 투영 보정
    out = list(widths)
    for i in range(1, len(out) - 1):
        seg = nodes[i + 1] - nodes[i - 1]
        if seg.length < 1e-6:
            continue
        seg_n = seg.normalized()
        if (out[i] - out[i - 1]).dot(seg_n) < 0:
            out[i] = out[i - 1] + seg_n * 0.002
    return out


def ribbon(mesh, nodes, rings):
    edges = [road_edges(nodes, offset) for offset, _, _ in rings]
    for j, (a, b) in enumerate(zip(edges, edges[1:])):
        _, z0, _ = rings[j]
        _, z1, ink = rings[j + 1]
        for p, q, r, s in zip(a, a[1:], b[1:], b):
            mesh.face([xyz(*q, z0), xyz(*p, z0), xyz(*s, z1), xyz(*r, z1)], ink)


def ring(mesh, points, layers, cap):
    for (z0, s0, _), (z1, s1, ink) in zip(layers, layers[1:]):
        for p, q in zip(points, (*points[1:], points[0])):
            mesh.face([(*[v * s0 for v in p], z0), (*[v * s0 for v in q], z0), (*[v * s1 for v in q], z1), (*[v * s1 for v in p], z1)], ink)
    z, s, _ = layers[-1]
    mesh.face([(*[v * s for v in p], z) for p in points], cap)


def bevel_box(mesh, x, y, w, h, bottom, top, cap, side="line", top_rim="cliff", cut=0.09):
    a, b = w / 2, h / 2
    k = min(a * 0.65, b * 0.65, cut)
    outline = [(-a + k, -b), (a - k, -b), (a, -b + k), (a, b - k), (a - k, b), (-a + k, b), (-a, b - k), (-a, -b + k)]
    layers = [(bottom, 1.0, ""), (top - min(0.045, (top - bottom) / 3), 1.0, side), (top, 0.90, top_rim)]
    first = len(mesh.vertices)
    ring(mesh, outline, layers, cap)
    mesh.vertices[first:] = [(px + x, py - y, pz) for px, py, pz in mesh.vertices[first:]]


def build_road_and_entry(materials):
    mesh = Mesh(materials)
    nodes = route()
    # V2: 0.34칸 넓은 포장면 + 2단 슬레이트/세라믹 연석 (동일 z=0.0 유지 + 완만 베벨로 코너 방사선 완전 제거)
    cross_section = [
        (-0.46, TREADS[0], ""),
        (-0.46, -0.20, "carbon"),
        (-0.435, -0.10, "cliff"),
        (-0.405, -0.09, "line"),
        (-0.385, 0.022, "curb"),
        (-0.35, 0.022, "line"),
        (-0.34, 0.0, "curb"),
        (0.34, 0.0, "road"),
        (0.35, 0.022, "curb"),
        (0.385, 0.022, "line"),
        (0.405, -0.09, "curb"),
        (0.435, -0.10, "line"),
        (0.46, -0.20, "cliff"),
        (0.46, TREADS[0], "carbon"),
    ]
    ribbon(mesh, nodes, cross_section)

    # 석판 타일 줄눈 (연석 안쪽까지 섬세한 0.5칸 격자 분할)
    for a, b, c in zip(PLATEAU["pathCells"], PLATEAU["pathCells"][1:], PLATEAU["pathCells"][2:]):
        if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]):
            continue
        dx, dy = c[0] - b[0], c[1] - b[1]
        across = Vector((-dy, dx))
        for step_off in (0.35, 0.85):
            px, py = b[0] + step_off * dx + 0.5, b[1] + step_off * dy + 0.5
            p = Vector((px, py)) - across * 0.32
            q = Vector((px, py)) + across * 0.32
            ribbon(mesh, [p, q], [(-0.008, 0.002, ""), (0.008, 0.002, "joint")])

    # 입구 (0.04, 1.50): 앰버 룬 아치 + 바닥 3연속 화살표
    ex, ey = 0.04, 1.50
    for sign in (-1, 1):
        side = ey + 0.49 * sign
        bevel_box(mesh, ex, side, 0.48, 0.22, -0.67, 0.075, "gate_trim", "cliff")
        bevel_box(mesh, ex, side, 0.26, 0.20, 0.075, 0.49, "gate_stone", "line")
        bevel_box(mesh, ex + 0.06, side, 0.13, 0.12, 0.34, 0.505, "amber", "joint")
    bevel_box(mesh, ex, ey, 0.18, 1.18, 0.42, 0.56, "gate_stone", "gate_trim")
    for i in range(3):
        p = ex + 0.22 + i * 0.20
        pts = [(p, ey - 0.115), (p + 0.13, ey), (p, ey + 0.115), (p + 0.075, ey + 0.115), (p + 0.205, ey), (p + 0.075, ey - 0.115)]
        mesh.face([xyz(u, v, 0.006) for u, v in pts], "amber")
    obj = mesh.finish("도로 및 입구 아치")
    # 도로 상판 내부 삼각 분할선 Freestyle 억제 (smooth + auto smooth 효과를 위해 폴리곤 flat/smooth 정돈)
    return obj


def build_diorama_props(mesh):
    # 바위 군락
    for i, (x, y) in enumerate(CLUSTERS):
        for j, (dx, dy, size) in enumerate(((-0.19, -0.13, 0.24), (0.055, -0.02, 0.34), (0.22, 0.16, 0.18), (-0.14, 0.22, 0.14))):
            px, py = x + dx, y + dy
            points = [(math.cos(j * 0.96 + k * math.tau / 6) * size * 0.71, math.sin(j * 0.96 + k * math.tau / 6) * size * 0.54) for k in range(6)]
            z = TREADS[sum(height(px, py) >= level for level in LEVELS)]
            first = len(mesh.vertices)
            ring(mesh, points, [(z - 0.07, 1.2, ""), (z + size * 0.27, 1.0, "cliff"), (z + size * (0.61 + 0.10 * (i % 2)), 0.67, "land5")], "rock")
            mesh.vertices[first:] = [(a + px, b - py, c) for a, b, c in mesh.vertices[first:]]

    # S++ 층상 소나무 군락 (외곽 삼각 여백)
    for px, py, r in TREE_SPOTS:
        z = TREADS[sum(height(px, py) >= level for level in LEVELS)]
        bevel_box(mesh, px, py, r * 0.26, r * 0.26, z - 0.04, z + 0.22, "cliff", "carbon", cut=0.02)
        for tier, (dz, scale_k, ink) in enumerate(((0.18, 1.0, "foliage_lo"), (0.36, 0.78, "foliage_hi"), (0.52, 0.52, "foliage_hi"))):
            pts = [(math.cos(k * math.tau / 7 + tier * 0.4) * r * scale_k, math.sin(k * math.tau / 7 + tier * 0.4) * r * scale_k) for k in range(7)]
            first = len(mesh.vertices)
            ring(mesh, pts, [(z + dz, 1.0, ""), (z + dz + 0.14, 0.70, ink)], ink)
            mesh.vertices[first:] = [(a + px, b - py, c) for a, b, c in mesh.vertices[first:]]

    # 좌하단 터쿼이즈 폭포·수로·아치교 (자연스러운 단차 낙수 + 바위 마감)
    stream_nodes = [Vector((4.60, 9.75)), Vector((5.60, 10.15)), Vector((6.55, 10.45)), Vector((7.55, 10.72))]
    ribbon(mesh, stream_nodes, [(-0.46, -0.58, ""), (-0.42, -0.42, "cliff"), (-0.34, -0.40, "water"), (0.34, -0.40, "water"), (0.42, -0.42, "cliff"), (0.46, -0.58, "carbon")])
    ribbon(mesh, stream_nodes[1:3], [(-0.18, -0.39, ""), (0.18, -0.39, "water_foam")])
    # 상류·하류 폭포 바위 마개 & 물보라
    for wx, wy in ((4.55, 9.72), (7.62, 10.75)):
        bevel_box(mesh, wx, wy, 0.42, 0.86, -0.62, -0.34, "rock", "cliff", cut=0.14)
        bevel_box(mesh, wx + 0.08, wy, 0.18, 0.52, -0.44, -0.32, "water_foam", "water", cut=0.06)
    # 돌 아치교 (ov 16%, 77%)
    bx, by = 6.32, 10.42
    bevel_box(mesh, bx, by - 0.44, 0.44, 0.18, -0.56, -0.24, "curb", "cliff")
    bevel_box(mesh, bx, by + 0.44, 0.44, 0.18, -0.56, -0.24, "curb", "cliff")
    bevel_box(mesh, bx, by, 0.40, 0.96, -0.26, -0.17, "road", "curb")

    # 좌하단 '가' 한글 모놀리스 (ov 26%, 82%) — 선명한 청록 한글 부조
    mx, my = 8.05, 10.35
    mz = TREADS[sum(height(mx, my) >= level for level in LEVELS)]
    bevel_box(mesh, mx, my, 0.72, 0.58, mz - 0.08, mz + 0.12, "gate_trim", "cliff")
    bevel_box(mesh, mx, my, 0.52, 0.38, mz + 0.12, mz + 0.70, "slate", "line")
    bevel_box(mesh, mx, my, 0.38, 0.28, mz + 0.70, mz + 0.79, "carbon", "gate_stone")
    gx, gy, gz = mx, my, mz + 0.805
    mesh.face([xyz(gx - 0.11, gy - 0.08, gz), xyz(gx + 0.02, gy - 0.08, gz), xyz(gx + 0.02, gy - 0.04, gz), xyz(gx - 0.11, gy - 0.04, gz)], "portal_core")
    mesh.face([xyz(gx - 0.02, gy - 0.08, gz), xyz(gx + 0.02, gy - 0.08, gz), xyz(gx + 0.02, gy + 0.08, gz), xyz(gx - 0.02, gy + 0.08, gz)], "portal_core")
    mesh.face([xyz(gx + 0.05, gy - 0.09, gz), xyz(gx + 0.09, gy - 0.09, gz), xyz(gx + 0.09, gy + 0.09, gz), xyz(gx + 0.05, gy + 0.09, gz)], "portal_core")
    mesh.face([xyz(gx + 0.09, gy - 0.02, gz), xyz(gx + 0.14, gy - 0.02, gz), xyz(gx + 0.14, gy + 0.02, gz), xyz(gx + 0.09, gy + 0.02, gz)], "portal_core")

    # 측량 표식 & 받침 지주
    blocked = {tuple(p) for p in PLATEAU["pathCells"]} | {(s["x"], s["y"]) for s in PLATEAU["slots"]}
    for x in range(-2, 18):
        for y in range(-4, 13):
            if (x, y) in blocked or (x + y) % 2:
                continue
            px, py = x + 0.5, y + 0.5
            band = sum(height(px, py) >= level for level in LEVELS)
            z = TREADS[band] + 0.004
            for orient in (0, 1):
                a, b = ((0.068, 0.009) if orient else (0.009, 0.068))
                mesh.face([xyz(px - a, py + b, z), xyz(px - a, py - b, z), xyz(px + a, py - b, z), xyz(px + a, py + b, z)], "survey")
    for slot in PLATEAU["slots"]:
        bevel_box(mesh, slot["x"] + 0.5, slot["y"] + 0.5, 0.44, 0.44, TREADS[0], -0.18, "carbon", "cliff")


def build_gate_layers(materials):
    # 우측 성문 (14.62, 7.50) — overview(127,37,746,467) 내부 0px 비잘림 안전 여유 + 앞/뒤 깊이 분할
    gx, gy = 14.62, 7.50
    col_back = bpy.data.collections.new("gate_back")
    col_front = bpy.data.collections.new("gate_front")
    bpy.context.scene.collection.children.link(col_back)
    bpy.context.scene.collection.children.link(col_front)

    back = Mesh(materials)
    # 성문 진입 화살표 3연속 + 문턱 룬 밴드
    for i in range(3):
        p = gx - 0.72 + i * 0.19
        pts = [(p, gy - 0.115), (p + 0.13, gy), (p, gy + 0.115), (p + 0.075, gy + 0.115), (p + 0.205, gy), (p + 0.075, gy - 0.115)]
        back.face([xyz(u, v, 0.007) for u, v in pts], "teal")
    # 뒤쪽 지지 암반·단 (성문 위쪽/뒤쪽에 배치해 하단 잘림 0px)
    for x, y, w, h, z in ((14.62, 6.72, 0.80, 0.54, 0.34), (15.05, 6.74, 0.48, 0.42, 0.54)):
        bevel_box(back, x, y, w, h, -0.78, 0.03, "gate_trim", "cliff")
        bevel_box(back, x, y, w * 0.86, h * 0.82, 0.03, z, "gate_stone", "gate_trim")
        bevel_box(back, x - 0.08, y, 0.07, h * 0.55, z, z + 0.02, "teal", "gate_trim")
    # 뒤쪽(-Y = 화면 위쪽) 기둥
    side_back = gy - 0.48
    bevel_box(back, gx, side_back, 0.52, 0.24, -0.66, 0.08, "gate_trim", "cliff")
    bevel_box(back, gx, side_back, 0.28, 0.22, 0.08, 0.68, "gate_stone", "gate_trim")
    bevel_box(back, gx + 0.06, side_back, 0.15, 0.14, 0.46, 0.70, "teal", "portal_core")
    # 청록 에너지 포털 막 (기둥 사이 공중 패널)
    back.face([xyz(gx + 0.04, gy - 0.37, 0.04), xyz(gx + 0.04, gy + 0.37, 0.04), xyz(gx + 0.04, gy + 0.37, 0.57), xyz(gx + 0.04, gy - 0.37, 0.57)], "portal_core")
    back_obj = back.finish("성문 · 뒤 기둥 및 에너지 포털", col_back)

    front = Mesh(materials)
    # 앞쪽(+Y = 화면 아래쪽) 기둥 + 상단 가로 아치 상인방 (적이 그 뒤를 통과하며 가려짐)
    side_front = gy + 0.48
    bevel_box(front, gx, side_front, 0.52, 0.24, -0.66, 0.08, "gate_trim", "cliff")
    bevel_box(front, gx, side_front, 0.28, 0.22, 0.08, 0.68, "gate_stone", "gate_trim")
    bevel_box(front, gx + 0.06, side_front, 0.15, 0.14, 0.46, 0.70, "teal", "portal_core")
    bevel_box(front, gx, gy, 0.22, 1.18, 0.57, 0.74, "gate_stone", "gate_trim")
    bevel_box(front, gx - 0.02, gy, 0.12, 0.42, 0.74, 0.80, "portal_core", "teal")
    front_obj = front.finish("성문 · 앞 기둥 및 상인방", col_front)
    return back_obj, front_obj


def pad_mesh(materials, selected):
    mesh = Mesh(materials)
    points = [tuple((RIGHT * math.cos(a) - BACK * math.sin(a))[:2]) for i in range(6) for a in (i * math.tau / 6,)]
    radius = SPEC["padRadius"]
    layers = [
        (-0.24, radius * 1.05, ""),
        (-0.19, radius * 1.08, "carbon"),
        (-0.14, radius, "cliff"),
        (-0.052, radius, "line"),
        (-0.024, radius * 0.96, "active_pad" if selected else "curb"),
        (-0.004, radius * 0.83, "amber" if selected else "joint"),
        (0.0, radius * 0.75, "carbon"),
    ]
    ring(mesh, points, layers, "active_pad" if selected else "pad")
    for direction in (RIGHT, BACK):
        across = Vector((-direction.y, direction.x, 0))
        mesh.face([tuple(direction * u + across * v + Vector((0, 0, 0.002))) for u, v in ((-0.078, -0.013), (0.078, -0.013), (0.078, 0.013), (-0.078, 0.013))], "amber" if selected else "line")
    return mesh.finish("설치대 · 선택" if selected else "설치대")


def render(out):
    assert (CAMERA_RAY - Vector(SPEC["cameraRay"]).normalized()).length < 1e-6
    ov = SPEC["overview"]
    ov_center = (ov["x"] + ov["width"] / 2.0, ov["y"] + ov["height"] / 2.0)

    # 1) 고밀도 지형 + 성문 2패스 (2090×1308, overview 정확 대응)
    sc = setup_scene(*HIGH_SIZE, ov["width"], ov["height"], (7.5, -4.5, 0), SPEC["center"], frame_center=ov_center, transparent=False, freestyle=True, line_scale=2.2)
    base_colors = build_palette("meadow", "day")
    materials = make_materials(base_colors)

    terrain_obj = build_terrain(materials)
    road_obj = build_road_and_entry(materials)
    static_mesh = Mesh(materials)
    build_diorama_props(static_mesh)
    static_obj = static_mesh.finish("디오라마 소품")
    back_obj, front_obj = build_gate_layers(materials)

    # 지형 8종 (4바이옴 × 주간/다크) — 성문 숨김 (런타임 gateBack/gateFront 별도 깊이 합성과 중복 방지)
    back_obj.hide_render = True
    front_obj.hide_render = True
    for biome in ("meadow", "river", "ochre", "snow"):
        for theme in ("day", "dark"):
            update_materials(materials, build_palette(biome, theme))
            sc.render.filepath = str(out / f"{biome}-{theme}-2x.png")
            bpy.ops.render.render(write_still=True)

    # 2) 투명 RGBA 성문 앞/뒤 패스 (meadow-day 기준 석재·청록 에너지 포털)
    update_materials(materials, build_palette("meadow", "day"))
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = "RGBA"
    terrain_obj.hide_render = True
    road_obj.hide_render = True
    static_obj.hide_render = True

    back_obj.hide_render = False
    front_obj.hide_render = True
    sc.render.filepath = str(out / "gate-back-2x.png")
    bpy.ops.render.render(write_still=True)

    back_obj.hide_render = True
    front_obj.hide_render = False
    sc.render.filepath = str(out / "gate-front-2x.png")
    bpy.ops.render.render(write_still=True)

    # 3) 홈 미리보기 + fallback 겸용 960×576 (성문 포함, 기존 test_pack.py 100% 호환)
    sc_full = setup_scene(*WORLD, *WORLD, (7.5, -4.5, 0), SPEC["center"], transparent=False, freestyle=True, line_scale=1.0)
    full_colors = build_palette("meadow", "day")
    full_mats = make_materials(full_colors)
    build_terrain(full_mats)
    build_road_and_entry(full_mats)
    full_static = Mesh(full_mats)
    build_diorama_props(full_static)
    full_static.finish("전체 · 소품")
    build_gate_layers(full_mats)
    sc_full.render.filepath = str(out / "meadow-plateau.png")
    bpy.ops.render.render(write_still=True)

    # 4) 설치대 1× (64×48) & 2× (128×96) 투명 RGBA
    pad_colors = build_palette("meadow", "day")
    for suffix, mult in (("", 1), ("-2x", 2)):
        w, h = SPEC["padSize"][0] * mult, SPEC["padSize"][1] * mult
        for selected in (False, True):
            frame = setup_scene(w, h, SPEC["padSize"][0], SPEC["padSize"][1], (0, 0, 0), SPEC["padPivot"], transparent=True, freestyle=True, line_scale=mult)
            pad_mesh(make_materials(pad_colors), selected)
            name = ("pad-selected" if selected else "pad") + suffix + ".png"
            frame.render.filepath = str(out / name)
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    args.out.mkdir(parents=True, exist_ok=True)
    render(args.out.resolve())
