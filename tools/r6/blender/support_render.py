"""프리즘·격납고·방벽 키트를 조립하고 공통 카메라로 렌더한다."""

from functools import partial
import json
import math

import bpy
from mathutils import Matrix, Vector

import bastion_kit
import hangar_kit
import prism_kit
from mortar_kit import SLOTS
from mortar_render import CAMERA_RAY, CENTER_HEIGHT, DIRECTIONS, SURFACES, TILE, VIEW, batch, configure, space_parts, toon_materials


KITS = {
    "prism": (prism_kit.build_kit, "프리즘 탑", 9, 2.20),
    "hangar": (hangar_kit.build_kit, "드론 격납고", 8, 1.54),
    "bastion": (bastion_kit.build_kit, "방벽 기지", 8, 1.67),
}
PRISM_HEIGHTS = (1.69, 1.87, 2.00, 2.30)
CHARGE = (0, .04, .15, .25, .21, .14, .06, 0)
ORBIT = (0, .21, .61, 1.13, 1.76, 2.28, 2.62, 0)
WALL_STROKE = (0, -.48, .32, .83, .60, .31, .13, 0)
LAUNCH_HEIGHT = (0, .36, 0, 0, 0, 0, 0, 0)


def mounts_for(tower, tier, frame, yaw, layer):
    down = Matrix.Translation((0, 0, CENTER_HEIGHT - KITS[tower][3] if layer == "head" else 0))
    mounts = {"ground": [Matrix.Identity(4)]}
    if tower == "prism":
        z = PRISM_HEIGHTS[tier - 1]
        point = prism_kit.mount_point(z)
        if layer == "head":
            down = Matrix.Translation(Vector((0, 0, CENTER_HEIGHT)) - point)
        mount = down @ Matrix.Translation(point) @ yaw
        stretch = 1 + CHARGE[frame]
        charge = Matrix.Diagonal((stretch, stretch, stretch, 1))
        mounts.update(yaw=[mount], charge=[mount @ charge],
                      orbit=[mount @ Matrix.Rotation(ORBIT[frame], 4, "Z")])
    elif tower == "hangar":
        aerial_height = hangar_kit.MAST_TOPS[tier - 1] + .16
        mounts["mast-yaw"] = [down @ Matrix.Translation((*hangar_kit.MAST, aerial_height))
                              @ yaw @ Matrix.Rotation(math.sin(frame * math.pi / 7) * .40, 4, "X")]
        spots = hangar_kit.POSITIONS[tier - 1]
        height = hangar_kit.DECK_HEIGHTS[tier - 1] + hangar_kit.FLEET_HEIGHTS[tier - 1]
        drone_scale = Matrix.Scale(hangar_kit.DRONE_SCALE, 4)
        mounts["fleet"] = [down @ Matrix.Translation((*spots[0], height + LAUNCH_HEIGHT[frame]))
                           @ yaw @ drone_scale]
        if 2 <= frame <= 6:
            mounts["fleet"] = []
        mounts["wingman"] = [down @ Matrix.Translation((x, y, height + index * .095)) @ yaw @ drone_scale
                             for index, (x, y) in enumerate(spots[1:])]
        mounts["guide"] = [down]
    else:
        apex = bastion_kit.BOOM_HEIGHTS[tier - 1]
        mounts["dish"] = [down @ Matrix.Translation((*bastion_kit.DISH_XY, apex)) @ yaw
                          @ Matrix.Rotation(math.sin(frame * math.pi / 7) * .52, 4, "Z")]
        push = WALL_STROKE[frame]
        mounts["wall"] = [down @ Matrix.Translation((0, -push * .24, 0))
                          @ Matrix.Diagonal((1 + push * .21, 1 + push * .21, 1 - push * .07, 1))]
    return mounts


def copy_part(part, group, materials, finish, world, transforms, accent=None):
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
            material = accent or (finish if color == "surface" else color)
            obj.material_slots[0].material = materials[material]


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
    mounts = mounts_for(tower, tier, frame, yaw, layer)
    for slot in SLOTS:
        for name in stage["slots"].get(slot, []):
            part = kit.collection.children[slot].children[f"{tower}/{name}"]
            mount = part["mount"]
            if layer == "form" or (mount == "ground") == (layer == "body"):
                accent = None
                if mount == "guide":
                    accent = ("teal", "silver", "line", "silver", "teal", "silver", "line", "teal")[frame]
                elif mount == "charge" and frame in (2, 3, 4):
                    accent = "amber-charge"
                copy_part(part, group, materials, finish, world, mounts[mount], accent)


def save_kit(tower, stage, path, palette, linear):
    build, title, review, center = KITS[tower]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit = build()
    materials = toon_materials(palette, linear)
    if tower == "prism":
        charged = materials["amber"].copy()
        charged.name = "R04 · amber-charge"
        ramp = charged.node_tree.nodes.get("Color Ramp").color_ramp
        for element in list(ramp.elements)[:-1]:
            element.color = ramp.elements[-1].color
        materials["amber-charge"] = charged
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
    colors = (*palette, "amber-charge") if tower == "prism" else palette
    materials = {name: bpy.data.materials[f"R04 · {name}"] for name in colors}
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
