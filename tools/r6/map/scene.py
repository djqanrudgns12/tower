"""Blender에서 R04 지형과 설치대 시트를 만드는 장면."""

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
from mortar_render import CAMERA_RAY, toon_materials

SPEC = json.loads((ROOT / "src/game/r6/mapProjection.json").read_text())
MAPS = json.loads((ROOT / "docs/contracts/maps.candidate.v0.4.json").read_text())["maps"]
PLATEAU = next(m for m in MAPS if m["id"] == "garden_u")
PALETTE = {"carbon": (18, 22, 27), "slate": (29, 36, 44), "line": (74, 85, 99),
           "silver": (184, 192, 200), "amber": (230, 159, 36), "teal": (47, 181, 163)}
RIDGES = ((1.1, 1.9, 3.9, 2.3, 44), (10.7, 3.5, 4.6, 3.3, 61),
          (5.2, 7.5, 6.1, 3.4, 52), (6.0, 3.5, 2.4, 2.6, -41),
          (-5.2, 7.0, 5.1, 8.3, 41), (14.9, -1.4, 5.3, 3.9, 48),
          (1.0, -5.6, 7.4, 3.9, 76), (10.7, -4.7, 7.2, 3.7, 64),
          (5.7, 11.2, 4.4, 4.3, 31), (20.8, 7.4, 5.4, 5.7, 43))
CLUSTERS = ((5.45, .25), (14.35, 5.5), (4.25, 8.75), (.3, 6.4))
STEP = .25
LEVELS = (12, 22, 32, 42, 52, 62, 72, 82)
TREADS = (-.91, -.85, -.77, -.66, -.56, -.45, -.34, -.24, -.11)
WORLD = (960, 576)
PPC = SPEC["pixelsPerCell"]
RIGHT = Vector((0, 0, 1)).cross(CAMERA_RAY).normalized()
BACK = Vector((CAMERA_RAY.x, CAMERA_RAY.y, 0)).normalized()


def blend(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(PALETTE[a], PALETTE[b]))


def linear(value):
    s = value / 255
    return s / 12.92 if s <= .04045 else ((s + .055) / 1.055) ** 2.4


def xyz(x, y, z):
    return (x, -y, z)


def scene(width, height, target, pivot, transparent=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    result = bpy.context.scene
    result.render.engine = "BLENDER_EEVEE"
    result.eevee.taa_render_samples = 16
    result.render.film_transparent = transparent
    result.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    result.render.resolution_x, result.render.resolution_y = width, height
    result.view_settings.view_transform = "Standard"
    result.view_settings.look = "None"
    camera = bpy.data.objects.new("R04 카메라", bpy.data.cameras.new("R04 카메라"))
    result.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(width, height) / PPC
    camera.rotation_euler = (-CAMERA_RAY).to_track_quat("-Z", "Y").to_euler()
    axes = camera.rotation_euler.to_matrix()
    camera.location = Vector(target) + CAMERA_RAY * 36
    camera.location -= axes @ Vector(((pivot[0] - width / 2) / PPC, (height / 2 - pivot[1]) / PPC, 0))
    result.camera = camera
    return result


class Mesh:
    def __init__(self, materials):
        self.materials = materials
        self.vertices, self.faces, self.colors = [], [], []

    def face(self, coords, material):
        if len(coords) < 3:
            return
        self.faces.append(tuple(range(len(self.vertices), len(self.vertices) + len(coords))))
        self.vertices.extend(coords)
        self.colors.append(material)

    def finish(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        indices = {}
        for poly, color in zip(mesh.polygons, self.colors):
            if color not in indices:
                indices[color] = len(indices)
                mesh.materials.append(self.materials[color])
            poly.material_index = indices[color]


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
    ridge = sum(a * math.exp(-((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2)
                for cx, cy, rx, ry, a in RIDGES)
    return 20 + ridge + 3.8 * math.sin(1.1 * x - .66 * y) + 2.5 * math.cos(.79 * y + .38 * x)


def terrain(mesh):
    # 화면 밖까지 이어지는 고도 격자. 각 삼각형의 등고선을 잘라 수평 단과 수직 벽을 잇는다.
    samples = {(i, j): (i * STEP, j * STEP, height(i * STEP, j * STEP))
               for i in range(-44, 105) for j in range(-56, 93)}
    bounds = (-1e9, *LEVELS, 1e9)
    for i in range(-44, 104):
        for j in range(-56, 92):
            a, b, c, d = (samples[key] for key in ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)))
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
                    if level == 0:
                        continue
                    for p, q in zip(section, (*section[1:], section[0])):
                        if p[2] != lo or q[2] != lo:
                            continue
                        x, y = p[:2]
                        u, v = q[:2]
                        z = TREADS[level]
                        mesh.face([xyz(u, v, z), xyz(x, y, z), xyz(x, y, z - .025), xyz(u, v, z - .025)], f"lip{level}")
                        mesh.face([xyz(u, v, z - .025), xyz(x, y, z - .025), xyz(x, y, TREADS[level - 1]),
                                   xyz(u, v, TREADS[level - 1])], "cliff")
    mesh.finish("초원 고원 · 등고선 층계")


def route():
    cells = PLATEAU["pathCells"]
    points = [Vector((x + .5, y + .5)) for x, y in cells]
    ends = [points[0] - (points[1] - points[0]) * .75, points[-1] + (points[-1] - points[-2]) * .75]
    nodes = [ends[0]]
    for a, b, c in zip(points, points[1:], points[2:]):
        if b - a == c - b:
            continue
        start, end = b - (b - a) * .66, b + (c - b) * .66
        for i in range(9):
            t = i / 8
            nodes.append((1 - t)**2 * start + 2 * t * (1 - t) * b + t**2 * end)
    return [*nodes, ends[1]]


def road_edges(nodes, offset):
    # 중심선의 접선을 기준으로 차폭과 돌턱의 간격을 유지한다.
    widths = []
    for i, point in enumerate(nodes):
        prev = nodes[max(0, i - 1)]
        nxt = nodes[min(len(nodes) - 1, i + 1)]
        tangent = (nxt - prev).normalized()
        normal = Vector((-tangent.y, tangent.x))
        widths.append(point + offset * normal)
    return widths


def ribbon(mesh, nodes, rings):
    edges = [road_edges(nodes, offset) for offset, _, _ in rings]
    for j, (a, b) in enumerate(zip(edges, edges[1:])):
        _, z0, _ = rings[j]
        _, z1, ink = rings[j + 1]
        for p, q, r, s in zip(a, a[1:], b[1:], b):
            mesh.face([xyz(*q, z0), xyz(*p, z0), xyz(*s, z1), xyz(*r, z1)], ink)


def road(mesh):
    nodes = route()
    cross_section = [(-.46, -.81, ""), (-.46, -.20, "carbon"), (-.431, -.10, "cliff"),
                     (-.399, -.10, "line"), (-.366, .026, "curb"), (-.315, .026, "line"),
                     (-.29, 0, "curb"), (.29, 0, "road"), (.315, .026, "curb"),
                     (.366, .026, "line"), (.399, -.10, "curb"), (.431, -.10, "line"),
                     (.46, -.20, "cliff"), (.46, -.81, "carbon")]
    ribbon(mesh, nodes, cross_section)
    for a, b, c in zip(PLATEAU["pathCells"], PLATEAU["pathCells"][1:], PLATEAU["pathCells"][2:]):
        if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]) or sum(b) % 3:
            continue
        x, y = b[0] + .86 * (c[0] - b[0]) + .5, b[1] + .86 * (c[1] - b[1]) + .5
        dx, dy = c[0] - b[0], c[1] - b[1]
        across = Vector((-dy, dx))
        for sign in (-1, 1):
            p = Vector((x, y)) + sign * across * .29
            q = Vector((x, y)) + sign * across * .23
            ribbon(mesh, [p, q], [(-.012, .003, ""), (.012, .003, "joint")])


def ring(mesh, points, layers, cap):
    for (z0, s0, _), (z1, s1, ink) in zip(layers, layers[1:]):
        for p, q in zip(points, (*points[1:], points[0])):
            mesh.face([(*[v * s0 for v in p], z0), (*[v * s0 for v in q], z0),
                       (*[v * s1 for v in q], z1), (*[v * s1 for v in p], z1)], ink)
    z, s, _ = layers[-1]
    mesh.face([(*[v * s for v in p], z) for p in points], cap)


def bevel_box(mesh, x, y, w, h, bottom, top, cap, side="line", cut=.10):
    a, b = w / 2, h / 2
    k = min(a * .65, b * .65, cut)
    outline = [(-a + k, -b), (a - k, -b), (a, -b + k), (a, b - k),
               (a - k, b), (-a + k, b), (-a, b - k), (-a, -b + k)]
    layers = [(bottom, 1, ""), (top - min(.045, (top - bottom) / 3), 1, side), (top, .89, "cliff")]
    first = len(mesh.vertices)
    ring(mesh, outline, layers, cap)
    mesh.vertices[first:] = [(px + x, py - y, pz) for px, py, pz in mesh.vertices[first:]]


def landmarks(mesh):
    for x, y, accent, gate in ((.065, 1.5, "amber", False), (14.93, 7.5, "teal", True)):
        for sign in (-1, 1):
            side = y + .49 * sign
            bevel_box(mesh, x, side, .52, .23, -.67, .075, "line")
            bevel_box(mesh, x, side, .26, .21, .075, .64 if gate else .48, "curb")
            bevel_box(mesh, x + .06, side, .14, .13, .45 if gate else .33, .65 if gate else .50, accent, "joint")
        # 빔은 차선 위를 가로지르고, 화살표는 길 좌표의 진행 방향을 따른다.
        bevel_box(mesh, x, y, .19, 1.20, .57 if gate else .41, .71 if gate else .54, "curb", "line")
        for i in range(3):
            p = x - .75 + i * .20 if gate else x + .19 + i * .20
            pts = [(p, y - .115), (p + .13, y), (p, y + .115),
                   (p + .075, y + .115), (p + .205, y), (p + .075, y - .115)]
            mesh.face([xyz(u, v, .006) for u, v in pts], accent)
    for x, y, w, h, z in ((14.72, 6.74, .84, .60, .33), (15.09, 6.69, .49, .43, .57),
                           (14.67, 8.14, .59, .22, .22), (15.22, 8.11, .48, .34, .35)):
        bevel_box(mesh, x, y, w, h, -.79, .03, "line", "cliff")
        bevel_box(mesh, x, y, w * .88, h * .84, .03, z, "joint", "line")
        bevel_box(mesh, x - .11, y, .07, h * .59, z, z + .015, "teal", "line")


def rocks(mesh):
    for i, (x, y) in enumerate(CLUSTERS):
        for j, (dx, dy, size) in enumerate(((-.19, -.13, .24), (.055, -.02, .34),
                                             (.22, .16, .18), (-.14, .22, .14))):
            px, py = x + dx, y + dy
            points = [(math.cos(j * .96 + k * math.tau / 6) * size * .71,
                       math.sin(j * .96 + k * math.tau / 6) * size * .54) for k in range(6)]
            z = TREADS[sum(height(px, py) >= level for level in LEVELS)]
            first = len(mesh.vertices)
            ring(mesh, points, [(z - .07, 1.2, ""), (z + size * .27, 1, "cliff"),
                                (z + size * (.61 + .10 * (i % 2)), .67, "land5")], "rock")
            mesh.vertices[first:] = [(a + px, b - py, c) for a, b, c in mesh.vertices[first:]]


def survey_marks(mesh):
    blocked = {tuple(p) for p in PLATEAU["pathCells"]} | {(s["x"], s["y"]) for s in PLATEAU["slots"]}
    for x in range(-2, 18):
        for y in range(-4, 13):
            if (x, y) in blocked or (x + y) % 2:
                continue
            px, py = x + .5, y + .5
            band = sum(height(px, py) >= level for level in LEVELS)
            z = TREADS[band] + .004
            for orient in (0, 1):
                a, b = ((.068, .009) if orient else (.009, .068))
                mesh.face([xyz(px - a, py + b, z), xyz(px - a, py - b, z),
                           xyz(px + a, py - b, z), xyz(px + a, py + b, z)], "survey")


def pad(mesh, selected):
    points = [tuple((RIGHT * math.cos(a) - BACK * math.sin(a))[:2])
              for i in range(6) for a in (i * math.tau / 6,)]
    radius = SPEC["padRadius"]
    layers = [(-.24, radius * 1.05, ""), (-.19, radius * 1.08, "carbon"),
              (-.14, radius, "cliff"), (-.052, radius, "line"), (-.024, radius * .96, "curb"),
              (-.004, radius * .83, "amber" if selected else "joint"), (0, radius * .75, "carbon")]
    ring(mesh, points, layers, "active_pad" if selected else "pad")
    for direction in (RIGHT, BACK):
        across = Vector((-direction.y, direction.x, 0))
        mesh.face([tuple(direction * u + across * v + Vector((0, 0, .002)))
                   for u, v in ((-.078, -.013), (.078, -.013), (.078, .013), (-.078, .013))],
                  "amber" if selected else "line")
    mesh.finish("설치대 · 선택" if selected else "설치대")


def render(out):
    assert (CAMERA_RAY - Vector(SPEC["cameraRay"]).normalized()).length < 1e-6
    colors = dict(PALETTE, cliff=blend("carbon", "slate", .48), curb=blend("line", "silver", .49),
                  road=blend("line", "silver", .19), joint=blend("slate", "line", .77),
                  pad=blend("slate", "line", .57), active_pad=blend("slate", "amber", .14),
                  rock=blend("slate", "line", .62), survey=blend("carbon", "line", .35))
    for i in range(len(TREADS)):
        colors[f"land{i}"] = blend("slate", "line", i * .025)
        colors[f"lip{i}"] = blend("slate", "line", .49 + i * .035)

    board = scene(*WORLD, (7.5, -4.5, 0), SPEC["center"])
    materials = toon_materials(colors, linear)
    terrain(Mesh(materials))
    art = Mesh(materials)
    road(art)
    landmarks(art)
    rocks(art)
    survey_marks(art)
    art.finish("차도 · 성문 · 바위")
    # 받침 지주는 배경에 굽고, 윗부분은 상태별 스프라이트로 놓는다.
    supports = Mesh(materials)
    for slot in PLATEAU["slots"]:
        bevel_box(supports, slot["x"] + .5, slot["y"] + .5, .42, .42, -.92, -.18, "carbon", "cliff")
    supports.finish("설치대 지주")
    board.render.filepath = str(out / "meadow-plateau.png")
    bpy.ops.render.render(write_still=True)

    for selected in (False, True):
        frame = scene(*SPEC["padSize"], (0, 0, 0), SPEC["padPivot"], transparent=True)
        pad(Mesh(toon_materials(colors, linear)), selected)
        frame.render.filepath = str(out / ("pad-selected.png" if selected else "pad.png"))
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    args.out.mkdir(parents=True, exist_ok=True)
    render(args.out.resolve())
