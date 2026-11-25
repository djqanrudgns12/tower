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
REVIEW_DIRECTIONS = {"rail": 6, "cryo": 8}
RAIL_KICK = (
    (0, .25, 1, .78, .54, .32, .13, 0),
    (0, .25, .95, .45, 1, .59, .21, 0),
    (0, .22, .83, .52, .96, .64, 1, 0),
    (0, .25, 1, .78, .54, .32, .13, 0),
)
RAIL_FLASHES = ({1: 0}, {1: 0, 3: 1}, {1: 0, 3: 1, 5: 2}, {1: 0})
RAIL_DIP = (0, 11, 8, 5, 3, 1, 0, 0)
CRYO_SPIN = (0, .15, .44, .96, 1.59, 2.10, 2.46, 0)
CRYO_COMPRESSION = (0, .06, .19, .24, .16, .08, .03, 0)
PULSE_RADII = {3: (.97, .66), 4: (1.58, 1.10), 5: (2.15, 1.66), 6: (2.78, 2.20)}


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
        diameter = 1.15 if stage["level"] == 20 else 1
        scale = diameter * (1 - .47 * compression)
        mounts[index] = head @ squeeze @ spin @ Matrix.Diagonal((scale, scale, 1, 1))
    return mounts


def rail_effect(group, materials, stage, recoil, frame):
    tier = stage["weaponStage"] - 1
    flash = RAIL_FLASHES[tier].get(frame)
    if flash is None:
        return
    ports = RAIL_PORTS[tier]
    x, tip, z = ports[flash]
    # 동시 관통 단계에서는 4개 포신의 예광을 한 줄로 모은다.
    if tier == 3:
        x, tip, z = 0, max(port[1] for port in ports), .20
    p = Part(group)
    for start, end, color in ((.05, .58, "teal"), (.56, .82, "silver")):
        obj = p.rod("가는 예광선", (x, tip + start, z), (x, tip + end, z), .023, color, steps=6)
        obj.data.materials.append(materials[color])
        obj.matrix_world = recoil @ obj.matrix_basis


def cryo_effect(group, materials, stage, world, frame):
    if frame not in PULSE_RADII:
        return
    p = Part(group)
    outer, inner = PULSE_RADII[frame]
    scale = (.86, .91, .95, 1.0)[stage["weaponStage"] - 1]
    for radius in (outer * scale, inner * scale):
        ring = p.lathe("냉기 파동 선", (0, 0, .24), [(0, radius), (.038, radius),
                       (.038, radius - .043), (0, radius - .043)],
                       "teal", steps=40, closed=True)
        ring.data.materials.append(materials["teal"])
        ring.matrix_world = world @ ring.matrix_basis
    for index in range(8):
        angle = index * math.tau / 8 + frame * .18
        x, y = math.cos(angle), math.sin(angle)
        radius = outer * scale
        shard = p.rod("서리 파편", ((radius-.18)*x, (radius-.18)*y, .24),
                      ((radius+.12)*x, (radius+.12)*y, .36), .028, "silver", steps=4)
        shard.data.materials.append(materials["silver"])
        shard.matrix_world = world @ shard.matrix_basis


def assemble(tower, kit, materials, stage, group, tile, direction=0, layer="form", frame=0):
    world = Matrix.Translation(tile)
    height = HEAD_HEIGHT if layer == "head" else mount_height(tower, stage)
    yaw = Matrix.Rotation(direction * math.tau / DIRECTIONS, 4, "Z")
    head = Matrix.Translation((0, 0, height)) @ yaw
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
                obj = source.copy()
                obj.parent = None
                group.objects.link(obj)
                obj.matrix_world = world @ transform @ source.matrix_basis
                obj.material_slots[0].link = "OBJECT"
                color = source["color"]
                obj.material_slots[0].material = materials[SURFACES[stage["materialStage"]] if color == "surface" else color]
    if tower == "rail":
        rail_effect(group, materials, stage, world @ mounts["recoil"], frame)
    else:
        cryo_effect(group, materials, stage, world, frame)


def save_kit(tower, stage, path, palette, linear):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit = build_kit(tower)
    materials = toon_materials(palette, linear)
    space_parts(kit, materials)
    scene = bpy.context.scene
    scene.name = f"{TITLES[tower]} · Lv20 조립"
    configure(scene)
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

    def project(z):
        up_z = math.sqrt(1 - CAMERA_RAY.z ** 2)
        return [TILE // 2, round(TILE * (.5 - (z - CENTER_HEIGHT) * up_z / VIEW))]

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
        "bodyPivot": project(0), "headPivot": project(HEAD_HEIGHT),
        "headAnchors": [project(mount_height(tower, stage)) for stage in stages],
        "headSheets": {name: [stage["level"] for stage in group] for name, group in head_groups.items()},
        "directions": DIRECTIONS, "reviewDirection": review,
        "weapons": [{"stage": stage["weaponStage"], "level": stage["level"], "attack": stage["attack"]}
                    for stage in tiers],
        "grids": {name: batch(kit, materials, out / f"{name}.png", cells, cols, partial(assemble, tower))
                  for name, (cells, cols) in specs.items()},
    }
    (out / "layout.json").write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n")
