"""프리즘·격납고·방벽 키트를 조립하고 공통 카메라로 렌더한다."""

from functools import partial
import json
import math

import bpy
from mathutils import Matrix, Vector

import bastion_kit
import hangar_kit
import prism_kit
from mortar_kit import Part, SLOTS
from mortar_render import CAMERA_RAY, CENTER_HEIGHT, DIRECTIONS, SURFACES, TILE, VIEW, batch, configure, space_parts, toon_materials
from support_mesh import arc


KITS = {
    "prism": (prism_kit.build_kit, "프리즘 탑", 9, 2.20),
    "hangar": (hangar_kit.build_kit, "드론 격납고", 8, 1.54),
    "bastion": (bastion_kit.build_kit, "방벽 기지", 8, 1.67),
}
PRISM_HEIGHTS = (1.69, 1.87, 2.00, 2.30)
CHARGE = (0, .18, .37, .43, .34, .25, .10, 0)
WALL_STROKE = (0, -.14, .34, .50, .31, .16, .07, 0)
LAUNCH_HEIGHT = (0, .27, .53, .7, .62, .46, .31, 0)


def mounts_for(tower, tier, frame, yaw, layer):
    down = Matrix.Translation((0, 0, CENTER_HEIGHT - KITS[tower][3] if layer == "head" else 0))
    mounts = {"ground": [Matrix.Identity(4)]}
    if tower == "prism":
        z = PRISM_HEIGHTS[tier - 1]
        point = prism_kit.mount_point(z)
        if layer == "head":
            down = Matrix.Translation(Vector((0, 0, CENTER_HEIGHT)) - point)
        mount = down @ Matrix.Translation(point) @ yaw
        charge = Matrix.Translation((0, 0, CHARGE[frame])) @ Matrix.Rotation(CHARGE[frame] * 1.65, 4, "Z")
        mounts.update(yaw=[mount], charge=[mount @ charge])
    elif tower == "hangar":
        aerial_height = (1.03, 1.31, 1.90, 2.50)[tier - 1]
        mounts["mast-yaw"] = [down @ Matrix.Translation((*hangar_kit.MAST, aerial_height + frame * .022))
                              @ yaw @ Matrix.Rotation(math.sin(frame * math.pi / 7) * .40, 4, "X")]
        spots = hangar_kit.POSITIONS[tier - 1]
        height = .62 + .067 * tier
        mounts["fleet"] = [down @ Matrix.Translation((*spots[0], height + LAUNCH_HEIGHT[frame])) @ yaw]
        if layer == "head" and frame in range(2, 7):
            mounts["fleet"] = []
        mounts["wingman"] = [down @ Matrix.Translation((x, y, height + index * .095)) @ yaw
                             for index, (x, y) in enumerate(spots[1:])]
    else:
        x, y = bastion_kit.BOOM_XY
        apex = bastion_kit.BOOM_HEIGHTS[tier - 1]
        mounts["dish"] = [down @ Matrix.Translation((x - .40, y - .12, apex)) @ yaw
                          @ Matrix.Rotation(CHARGE[frame] * 1.22, 4, "Z")]
        push = WALL_STROKE[frame]
        mounts["wall"] = [down @ Matrix.Translation((0, -push * .24, 0))
                          @ Matrix.Diagonal((1 + push * .24, 1 + push * .24, 1, 1))]
    return mounts, down


def copy_part(part, group, materials, finish, world, transforms):
    for transform in transforms:
        for source in part.objects:
            if source.type != "MESH":
                continue
            obj = source.copy()
            obj.parent = None
            group.objects.link(obj)
            obj.matrix_world = world @ transform @ source.matrix_basis
            obj.material_slots[0].link = "OBJECT"
            color = source["color"]
            obj.material_slots[0].material = materials[finish if color == "surface" else color]


def effects(tower, tier, frame, yaw, world, group, materials):
    p = Part(group)
    objects = []
    if tower == "prism" and frame in (2, 3, 4):
        z = PRISM_HEIGHTS[tier - 1] + CHARGE[frame]
        end = .97 + .11 * tier + .14 * (frame - 2)
        objects.append(p.rod("앰버 집속 광선", (0, .35, z), (0, end, z), .033, "amber", steps=5))
        if tier >= 2 and frame >= 3:
            objects.append(p.rod("두 번째 굴절 선", (0, end, z), (.41, end + .26, z - .11),
                                 .025, "amber", steps=5))
        shift = prism_kit.mount_point(PRISM_HEIGHTS[tier - 1]) - Vector((0, 0, PRISM_HEIGHTS[tier - 1]))
        world = world @ Matrix.Translation(shift) @ yaw
    elif tower == "bastion":
        if frame in (2, 3):
            r = (1.39, 1.65, 1.88, 2.04)[tier - 1] + frame * .21
            objects.append(arc(p, "전면 밀치기 선", (0, 0, 0), bastion_kit.START, bastion_kit.TURN,
                               [(.19, r), (.22, r), (.22, r - .05), (.19, r - .05)], "amber"))
        if 3 <= frame <= 6:
            r = .77 + (.45 + tier * .011) * (frame - 2)
            objects.append(p.lathe("주변 타워 강화 고리", (0, 0, .24),
                                    [(0, r), (.026, r), (.026, r - .046), (0, r - .046)],
                                    "teal", steps=36, closed=True))
    for obj in objects:
        obj.data.materials.append(materials[obj["color"]])
        obj.matrix_world = world @ obj.matrix_basis


def assemble(tower, kit, materials, stage, group, tile, direction=0, layer="form", frame=0):
    tier = stage["weaponStage"]
    world = Matrix.Translation(tile)
    yaw = Matrix.Rotation(direction * math.tau / DIRECTIONS, 4, "Z")
    finish = SURFACES[stage["materialStage"]]
    if layer == "drone":
        part = kit.collection.children["weapon"].children[f"hangar/fleet-{tier}"]
        transform = Matrix.Translation((0, 0, CENTER_HEIGHT)) @ Matrix.Diagonal((2.6, 2.6, 2.6, 1)) @ yaw
        copy_part(part, group, materials, finish, world, [transform])
        return
    mounts, down = mounts_for(tower, tier, frame, yaw, layer)
    for slot in SLOTS:
        for name in stage["slots"].get(slot, []):
            part = kit.collection.children[slot].children[f"{tower}/{name}"]
            mount = part["mount"]
            if layer == "form" or (mount == "ground") == (layer == "body"):
                copy_part(part, group, materials, finish, world, mounts[mount])
    if frame and layer != "body":
        effects(tower, tier, frame, yaw, world @ down, group, materials)


def save_kit(tower, stage, path, palette, linear):
    build, title, review, center = KITS[tower]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit = build()
    materials = toon_materials(palette, linear)
    for material in materials.values():
        material.use_fake_user = True
    space_parts(kit, materials)
    scene = bpy.context.scene
    scene.name = f"{title} · Lv20 조립"
    configure(scene)
    scene.camera.location.z += center - CENTER_HEIGHT
    assemble(tower, kit, materials, stage, scene.collection, Vector(), review)
    scene["recipe"] = f"{tower}.json"
    for area in (bpy.context.screen.areas if bpy.context.screen else ()):
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.shading.color_type = "MATERIAL"
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)


def project(point, center):
    right = Vector((0, 0, 1)).cross(CAMERA_RAY).normalized()
    up = CAMERA_RAY.cross(right)
    point = Vector(point)
    x, y = right.dot(point), up.dot(point - Vector((0, 0, center)))
    return [round(TILE * (.5 + x / VIEW)), round(TILE * (.5 - y / VIEW))]


def render(tower, stages, out, kit_file, palette, linear, forms_only=False):
    from tower_render import validate_parts

    _, title, review, center = KITS[tower]
    out.mkdir(parents=True, exist_ok=False)
    if not kit_file:
        kit_file = out / f"{tower}-kit.blend"
        save_kit(tower, stages[-1], kit_file, palette, linear)
    bpy.ops.wm.open_mainfile(filepath=str(kit_file))
    kit = bpy.data.scenes[f"{title} · 부품"]
    materials = {name: bpy.data.materials[f"R04 · {name}"] for name in palette}
    validate_parts(tower, kit, stages)

    tiers = [stage for stage in stages if stage["level"] in (1, 6, 12, 18)]
    head_groups = {"heads": stages[:6], "heads-armored": stages[6:]}
    specs = {"forms": ([(stage, review, "form", 0) for stage in stages], 6, center)}
    if not forms_only:
        specs.update({
            "bodies": ([(stage, 0, "body", 0) for stage in stages], 6, center),
            **{name: ([(stage, direction, "head", 0) for stage in group for direction in range(DIRECTIONS)],
                      10, CENTER_HEIGHT) for name, group in head_groups.items()},
            "attack": ([(stage, review, "form", frame) for stage in tiers for frame in range(8)], 8, center),
        })
        if tower == "hangar":
            specs["drone"] = ([(stage, direction, "drone", 0) for stage in tiers
                               for direction in range(0, DIRECTIONS, 2)], 8, CENTER_HEIGHT)
    pivot = [TILE // 2, TILE // 2]
    anchors = [pivot] * len(stages)
    if tower == "prism":
        anchors = [project(prism_kit.mount_point(PRISM_HEIGHTS[stage["weaponStage"] - 1]), center)
                   for stage in stages]
    layout = {
        "towerId": tower, "tile": TILE, "levels": [stage["level"] for stage in stages],
        "bodyPivot": project((0, 0, 0), center), "headPivot": pivot, "headAnchors": anchors,
        "headSheets": {name: [stage["level"] for stage in group] for name, group in head_groups.items()},
        "directions": DIRECTIONS, "reviewDirection": review,
        "weapons": [{"stage": stage["weaponStage"], "level": stage["level"], "attack": stage["attack"]}
                    for stage in tiers],
        "grids": {name: batch(kit, materials, out / f"{name}.png", cells, cols, partial(assemble, tower), z)
                  for name, (cells, cols, z) in specs.items()},
    }
    (out / "layout.json").write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n")
