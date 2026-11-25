"""레일·냉각 키트에서 비교 렌더와 192·384px 시트용 원본을 만든다."""

from functools import partial
import json
import math

import bpy
from mathutils import Matrix, Vector

from mortar_kit import Part, SLOTS
from mortar_render import CAMERA_RAY, CENTER_HEIGHT, DIRECTIONS, SURFACES, TILE, VIEW, configure, space_parts, toon_materials
from tower_kit import CRYO_BANKS, CRYO_HEIGHT, RAIL_HEIGHTS, RAIL_PITCH, RAIL_PORTS, TITLES, build_kit


HEAD_HEIGHT = .62
RAIL_CENTER_HEIGHT = 2.88
CRYO_CENTER_HEIGHT = 2.46
HEAD_CENTERS = {"rail": CENTER_HEIGHT, "cryo": 2.29}
RAIL_MAST_SHIFT = .79
PROPORTIONS = {"rail": (1.0, .91), "cryo": (.89, .94)}
CAMERA_RIGHT = Vector((0, 0, 1)).cross(CAMERA_RAY).normalized()
REVIEW_DIRECTIONS = {"rail": 6, "cryo": 8}
RAIL_KICK = (
    (0, .25, 1, .78, .54, .32, .13, 0),
    (0, .25, .95, .45, 1, .59, .21, 0),
    (0, .22, .83, .52, .96, .64, 1, 0),
    (0, .25, 1, .78, .54, .32, .13, 0),
)
RAIL_FLASHES = ({1: 0, 2: 0}, {1: 0, 2: 0, 3: 1, 4: 1},
                {1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2}, {1: 1, 2: 1})
RAIL_DIP = (0, 11, 8, 5, 3, 1, 0, 0)
CRYO_SPIN = (0, .15, .44, .96, 1.59, 2.10, 2.46, 0)
CRYO_COMPRESSION = (0, .13, .29, .40, -.10, -.18, -.08, 0)


def mount_height(tower, stage):
    return RAIL_HEIGHTS[stage["weaponStage"] - 1] if tower == "rail" else CRYO_HEIGHT


def rail_action(stage, frame, head):
    tier = stage["weaponStage"] - 1
    idle = RAIL_PITCH[tier] + (6 if stage["level"] == 20 else 0)
    pitch = math.radians(idle - RAIL_DIP[frame])
    bearing = head @ Matrix.Translation((0, .24, .45)) @ Matrix.Rotation(pitch, 4, "X")
    return bearing @ Matrix.Translation((0, -stage["attack"]["recoil"] * RAIL_KICK[tier][frame], 0))


def cryo_action(stage, frame, head):
    rings = CRYO_BANKS[stage["weaponStage"] - 1]
    center = (rings[0][0] + rings[-1][0]) / 2
    mounts = {}
    for index, (z, _) in enumerate(rings):
        compression = CRYO_COMPRESSION[frame]
        squeeze = Matrix.Translation((0, 0, (center - z) * compression))
        spin = Matrix.Rotation(CRYO_SPIN[frame] * (-1 if index % 2 else 1), 4, "Z")
        diameter = {10: 1.085, 20: 1.15}.get(stage["level"], 1)
        scale = diameter * (1 - .47 * compression)
        mounts[index] = head @ squeeze @ spin @ Matrix.Diagonal((scale, scale, 1, 1))
    return mounts


def rail_effect(group, materials, stage, recoil, frame):
    tier = stage["weaponStage"] - 1
    flash = RAIL_FLASHES[tier].get(frame)
    if flash is None:
        return
    x, tip, z = RAIL_PORTS[tier][flash]
    p = Part(group)
    flare = .24 if frame % 2 else .15
    for dx, dz, color in ((flare, 0, "teal"), (0, flare, "silver")):
        obj = p.rod("포구 십자 섬광", (x - dx, tip + .078, z - dz), (x + dx, tip + .078, z + dz),
                    .046, color, steps=4)
        obj.data.materials.append(materials[color])
        obj.matrix_world = recoil @ obj.matrix_basis


def assemble(tower, kit, materials, stage, group, tile, direction=0, layer="form", frame=0):
    width, vertical = PROPORTIONS[tower]
    sizing = Matrix.Diagonal((width, width, vertical, 1))
    if layer == "head":
        pivot = Matrix.Translation((0, 0, HEAD_HEIGHT))
        sizing = pivot @ sizing @ pivot.inverted()
    world = Matrix.Translation(tile) @ sizing
    height = HEAD_HEIGHT if layer == "head" else mount_height(tower, stage)
    shift = CAMERA_RIGHT * RAIL_MAST_SHIFT if tower == "rail" and layer != "head" else Vector()
    mast = Matrix.Translation(shift)
    yaw = Matrix.Rotation(direction * math.tau / DIRECTIONS, 4, "Z")
    head = mast @ Matrix.Translation((0, 0, height)) @ yaw
    mounts = {"ground": Matrix.Identity(4), "yaw": head}
    rotor_mounts = None
    if tower == "rail":
        mounts["recoil"] = rail_action(stage, frame, head)
    else:
        rotor_mounts = cryo_action(stage, frame, head)

    for slot in SLOTS:
        for name in stage["slots"].get(slot, []):
            part = kit.collection.children[slot].children[f"{tower}/{name}"]
            mount = part["mount"]
            if layer != "form" and (mount == "ground") != (layer == "body"):
                continue
            for source in part.objects:
                if source.type != "MESH":
                    continue
                transform = rotor_mounts[source["ring"]] if mount == "rotors" else mounts[mount]
                if tower == "rail" and slot == "body":
                    transform = mast @ transform
                obj = source.copy()
                obj.parent = None
                group.objects.link(obj)
                obj.matrix_world = world @ transform @ source.matrix_basis
                obj.material_slots[0].link = "OBJECT"
                color = source["color"]
                obj.material_slots[0].material = materials[SURFACES[stage["materialStage"]] if color == "surface" else color]
    if tower == "rail":
        rail_effect(group, materials, stage, world @ mounts["recoil"], frame)



def save_kit(tower, stage, path, palette, linear):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit = build_kit(tower)
    materials = toon_materials(palette, linear)
    space_parts(kit, materials)
    scene = bpy.context.scene
    scene.name = f"{TITLES[tower]} · Lv20 조립"
    configure(scene)
    ground_center = RAIL_CENTER_HEIGHT if tower == "rail" else CRYO_CENTER_HEIGHT
    scene.camera.location.z += ground_center - CENTER_HEIGHT
    assemble(tower, kit, materials, stage, scene.collection, Vector(), REVIEW_DIRECTIONS[tower])
    scene["recipe"] = f"{tower}.json"
    for area in (bpy.context.screen.areas if bpy.context.screen else ()):
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.shading.color_type = "MATERIAL"
    bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)


def validate_parts(tower, kit, stages):
    for stage in stages:
        if stage["attack"]["frames"] != 8:
            raise ValueError("레일·냉각 공격 동작에는 8프레임이 필요합니다.")
        for slot, names in stage["slots"].items():
            for name in names:
                part = kit.collection.children[slot].children.get(f"{tower}/{name}")
                if not part or not any(obj.type == "MESH" for obj in part.objects):
                    raise ValueError(f'Lv{stage["level"]} {slot}에 {name} 부품이 없습니다.')


def render(tower, stages, out, kit_file, palette, linear, forms_only=False):
    from mortar_render import batch

    out.mkdir(parents=True, exist_ok=False)
    if not kit_file:
        kit_file = out / f"{tower}-kit.blend"
        save_kit(tower, stages[-1], kit_file, palette, linear)
    bpy.ops.wm.open_mainfile(filepath=str(kit_file))
    kit = bpy.data.scenes[f"{TITLES[tower]} · 부품"]
    materials = {name: bpy.data.materials[f"R04 · {name}"] for name in palette}
    validate_parts(tower, kit, stages)
    review = REVIEW_DIRECTIONS[tower]

    def project(z, center, offset=0):
        up_z = math.sqrt(1 - CAMERA_RAY.z ** 2)
        return [round(TILE * (.5 + offset / VIEW)), round(TILE * (.5 - (z - center) * up_z / VIEW))]

    ground_center = RAIL_CENTER_HEIGHT if tower == "rail" else CRYO_CENTER_HEIGHT
    head_center = HEAD_CENTERS[tower]
    width, vertical = PROPORTIONS[tower]
    mount_offset = RAIL_MAST_SHIFT * width if tower == "rail" else 0
    tiers = [stage for stage in stages if stage["level"] in (1, 6, 12, 18)]
    head_groups = {"heads": stages[:6], "heads-armored": stages[6:]}
    specs = {"forms": ([(stage, review, "form", 0) for stage in stages], 6)}
    if not forms_only:
        specs.update({
            "bodies": ([(stage, 0, "body", 0) for stage in stages], 6),
            **{name: ([(stage, direction, "head", 0) for stage in group for direction in range(DIRECTIONS)], 10)
               for name, group in head_groups.items()},
            "attack": ([(stage, review, "form", frame)
                        for stage in tiers for frame in range(stage["attack"]["frames"])], 8),
        })
    layout = {
        "towerId": tower, "tile": TILE, "levels": [stage["level"] for stage in stages],
        "bodyPivot": project(0, ground_center), "headPivot": project(HEAD_HEIGHT, head_center),
        "headAnchors": [project(vertical * mount_height(tower, stage), ground_center, mount_offset) for stage in stages],
        "headSheets": {name: [stage["level"] for stage in group] for name, group in head_groups.items()},
        "directions": DIRECTIONS, "reviewDirection": review,
        "weapons": [{"stage": stage["weaponStage"], "level": stage["level"], "attack": stage["attack"]}
                    for stage in tiers],
        "grids": {name: batch(kit, materials, out / f"{name}.png", cells, cols, partial(assemble, tower),
                              head_center if name in head_groups else ground_center)
                  for name, (cells, cols) in specs.items()},
    }
    (out / "layout.json").write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n")
