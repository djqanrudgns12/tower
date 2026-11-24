"""레시피의 11형태를 고정 직교 카메라에서 투명 그리드 한 장으로 렌더한다."""

import argparse
import itertools
import json
import math
from pathlib import Path
import sys
import time

import bpy
from mathutils import Matrix, Vector


PIXELS = 64
VIEW = 5.8
UP_OFFSET = 1.65
COLUMNS = 11
DIRECTIONS = 16
PIVOT_Z = 2.85
CAMERA_RAY = Vector((6, -8, 6)).normalized()
LIGHT_RAY = Vector((-0.45, -0.65, 0.75)).normalized()
PALETTE = {
    "carbon": (18, 22, 27), "slate": (29, 36, 44), "line": (74, 85, 99),
    "silver": (184, 192, 200), "amber": (230, 159, 36), "teal": (47, 181, 163),
}
SURFACES = {"steel": "line", "alloy": "line", "ceramic": "silver", "gold-trim": "silver"}

# 중심, 치수, 색. 포두 쪽 좌표는 회전축 기준이며 +Y 방향으로 향한다.
KIT = {
    "plinth": [((0, 0, 0.20), (1.70, 1.60, 0.40), "slate")],
    "column": [((0, 0, 1.45), (0.75, 0.67, 2.45), "surface")],
    "cheeks": [((x, 0, 0.76), (0.24, 0.70, 0.64), "slate") for x in (-0.43, 0.43)],
    "stripe": [((0, -0.35, 1.66), (0.42, 0.10, 0.12), "teal")],
    "ribs": [((x, 0, 1.17), (0.14, 0.86, 0.15), "silver") for x in (-0.40, 0.40)],
    "aerial": [((-0.51, 0.22, 3.0), (0.09, 0.11, 0.72), "line")],
    "hinges": [((x, -0.38, 0.71), (0.14, 0.11, 0.21), "silver") for x in (-0.47, 0.47)],
    "shoulders": [((x, 0, 2.15), (0.27, 0.55, 0.33), "slate") for x in (-0.49, 0.49)],
    "trim": [((0, -0.72, 0.26), (1.30, 0.10, 0.10), "amber")],
    "collar": [((0, 0, 0.02), (0.79, 0.65, 0.31), "surface")],
    "single": [((0, 0.63, 0.12), (0.29, 1.35, 0.31), "slate")],
    "twin": [((x, 0.63, 0.12), (0.20, 1.45, 0.26), "slate") for x in (-0.22, 0.22)],
    "triple": [((x, 0.66, z), (0.18, 1.55, 0.23), "line")
               for x, z in ((-0.22, 0.10), (0.22, 0.10), (0, 0.31))],
    "accelerator": [
        ((0, 0.74, 0.12), (0.30, 1.65, 0.29), "line"),
        *[((x, y, 0.12), (0.12, 0.17, 0.49), "amber")
          for x, y in itertools.product((-0.26, 0.26), (0.37, 0.82, 1.27))],
        *[((0, y, 0.35), (0.64, 0.17, 0.10), "amber") for y in (0.37, 0.82, 1.27)],
    ],
}


def linear(channel):
    value = channel / 255
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def make_materials():
    materials = {}
    for name, color in PALETTE.items():
        for band in (0.74, 0.88, 1.0, 1.12):
            material = bpy.data.materials.new(f"{name}-{band}")
            material.use_nodes = True
            nodes = material.node_tree.nodes
            nodes.clear()
            emission = nodes.new("ShaderNodeEmission")
            emission.inputs["Color"].default_value = (*[linear(round(v * band)) for v in color], 1)
            output = nodes.new("ShaderNodeOutputMaterial")
            material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
            materials[name, band] = material
    return materials


def make_meshes():
    # 모따기한 평면을 여러 배치에서 공유한다.
    meshes = {}
    bpy.ops.mesh.primitive_cube_add(size=1)
    cube = bpy.context.object
    for size in {size for parts in KIT.values() for _, size, _ in parts}:
        cube.data = bpy.data.meshes.new("box")
        vertices = list(itertools.product(*[(-edge / 2, edge / 2) for edge in size]))
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                 (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        cube.data.from_pydata(vertices, [], faces)
        modifier = cube.modifiers.new("모따기", "BEVEL")
        modifier.width = min(0.065, min(size) / 4)
        modifier.segments = 1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        meshes[size] = cube.data.copy()
    bpy.data.objects.remove(cube, do_unlink=True)
    return meshes


def add_group(stage, slots, tile, meshes, materials, angle=0.0, recoil=0.0):
    head = slots == ("head", "weapon")
    turn = Matrix.Rotation(angle, 3, "Z")
    for slot in slots:
        for part in stage["slots"].get(slot, []):
            for center, size, color in KIT[part]:
                mesh = meshes[size].copy()
                obj = bpy.data.objects.new(part, mesh)
                bpy.context.collection.objects.link(obj)
                x, y, z = center
                offset = Vector((x, y - recoil if slot == "weapon" else y, z))
                if head:
                    offset = turn @ offset + Vector((0, 0, PIVOT_Z))
                obj.location = tile + offset
                obj.rotation_euler.z = angle
                name = SURFACES[stage["materialStage"]] if color == "surface" else color
                lit_band = 1.12 if color == "surface" and stage["materialStage"] == "alloy" else 1.0
                for band in (0.74, 0.88, lit_band):
                    mesh.materials.append(materials[name, band])
                for face in mesh.polygons:
                    dot = (turn @ face.normal).dot(LIGHT_RAY)
                    face.material_index = 2 if dot >= 0.55 else 1 if dot >= 0.10 else 0


def render(recipe, out):
    started = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 8
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    stages = recipe["stages"]
    attack = stages[-1]["attack"]
    rows = DIRECTIONS + 2
    scene.render.resolution_x = COLUMNS * PIXELS
    scene.render.resolution_y = rows * PIXELS
    scene.render.resolution_percentage = 100

    camera_data = bpy.data.cameras.new("고정 직교 카메라")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(rows, COLUMNS) * VIEW
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.rotation_euler = (-CAMERA_RAY).to_track_quat("-Z", "Y").to_euler()
    axes = camera.rotation_euler.to_matrix()
    right, up = axes @ Vector((1, 0, 0)), axes @ Vector((0, 1, 0))
    camera.location = CAMERA_RAY * 52 + up * UP_OFFSET

    def tile(column, row):
        return right * ((column - (COLUMNS - 1) / 2) * VIEW) + up * (((rows - 1) / 2 - row) * VIEW)

    materials = make_materials()
    meshes = make_meshes()
    for column, stage in enumerate(stages):
        add_group(stage, ("base", "body", "armor", "detail", "marking"), tile(column, 0), meshes, materials)
        for direction in range(DIRECTIONS):
            add_group(stage, ("head", "weapon"), tile(column, direction + 1), meshes, materials,
                      angle=direction * math.tau / DIRECTIONS)

    for frame in range(attack["frames"]):
        # 첫 두 표본에서 빠르게 후퇴하고 끝까지 천천히 제자리로 돌아온다.
        fraction = 0 if frame == 0 else ((attack["frames"] - 1 - frame) / (attack["frames"] - 2)) ** 2
        add_group(stages[-1], ("head", "weapon"), tile(frame, rows - 1), meshes, materials,
                  recoil=attack["recoil"] * fraction)

    out.mkdir(parents=True, exist_ok=False)
    scene.render.filepath = str(out / "tower-grid.png")
    bpy.ops.render.render(write_still=True)
    def projected(z):
        return [PIXELS // 2, round(PIXELS / 2 - (up.z * z - UP_OFFSET) * PIXELS / VIEW)]

    metadata = {
        "levels": [stage["level"] for stage in stages], "tile": PIXELS, "directions": DIRECTIONS,
        "bodyPivot": projected(0), "headPivot": projected(PIVOT_Z),
        "attack": {"frames": attack["frames"], "fps": attack["fps"], "level": stages[-1]["level"]},
        "blenderSeconds": round(time.monotonic() - started, 3),
    }
    (out / "layout.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print(f"렌더 완료 · {len(stages)}형태 · 포두 {DIRECTIONS}방향 · 공격 {attack['frames']}프레임")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe", type=Path)
    parser.add_argument("out", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    render(json.loads(args.recipe.read_text()), args.out.resolve())
