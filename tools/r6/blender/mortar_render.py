"""곡사 포대 키트를 조립해 몸체·포두·발사 동작을 고정 카메라에서 렌더한다."""

import json
import math
import time

import bpy
from mathutils import Matrix, Vector

from mortar_kit import Part, SLOTS, YAW_HEIGHTS, build_kit


TILE = 384
VIEW = 6.75
CENTER_HEIGHT = 1.67
CAMERA_RAY = Vector((6.1, -8.2, 6.05)).normalized()
DIRECTIONS = 16
REVIEW_DIRECTION = 8
DIR_ANGLE = math.tau / DIRECTIONS
IDLE_PITCHES = (31, 43, 11, 8)
FIRE_PITCH = (0, .29, .71, 1, .76, .41, .12, 0)
ELEVATION_HEIGHTS = (.66, .66, .90, 1.03)
KICK = (0, 0, 0, 1.0, .65, .36, .12, 0)
SURFACES = {"steel": "line", "alloy": "line", "ceramic": "silver", "gold-trim": "line"}
MUZZLES = (((0, 1.44, 0),), ((0, 1.73, 0),), ((-.66, 1.49, .02), (.66, 1.49, .02)),
           tuple((x, 1.28, z) for x in (-.71, .71) for z in (-.38, .45)))


def toon_materials(palette, linear):
    right = Vector((0, 0, 1)).cross(CAMERA_RAY).normalized()
    light = (CAMERA_RAY * .27 - right * .74 + Vector((0, 0, .72))).normalized()

    def shade(rgb, band):
        return *[linear(min(255, round(value * band))) for value in rgb], 1

    materials = {}
    for name, rgb in palette.items():
        material = bpy.data.materials.new(f"R04 · {name}")
        material.diffuse_color = shade(rgb, 1.0)
        material.use_nodes = True
        nodes = material.node_tree.nodes
        links = material.node_tree.links
        nodes.clear()
        dot = nodes.new("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        dot.inputs[1].default_value = light
        links.new(nodes.new("ShaderNodeNewGeometry").outputs["Normal"], dot.inputs[0])
        occlusion = nodes.new("ShaderNodeAmbientOcclusion")
        occlusion.inputs["Distance"].default_value = .37
        exposure = nodes.new("ShaderNodeMath")
        exposure.operation = "MULTIPLY_ADD"
        exposure.inputs[1].default_value = .88
        exposure.inputs[2].default_value = -.88
        links.new(occlusion.outputs["AO"], exposure.inputs[0])
        lighting = nodes.new("ShaderNodeMath")
        lighting.operation = "ADD"
        links.new(dot.outputs["Value"], lighting.inputs[0])
        links.new(exposure.outputs[0], lighting.inputs[1])
        tone = nodes.new("ShaderNodeValToRGB")
        ramp = tone.color_ramp
        ramp.interpolation = "CONSTANT"
        ramp.elements.remove(ramp.elements[1])
        ramp.elements[0].color = shade(rgb, .74)
        for threshold, band in ((.13, .88), (.49, 1.0), (.79, 1.12)):
            ramp.elements.new(threshold).color = shade(rgb, band)
        links.new(lighting.outputs[0], tone.inputs["Fac"])
        matte = nodes.new("ShaderNodeEmission")
        links.new(tone.outputs["Color"], matte.inputs["Color"])
        links.new(matte.outputs[0], nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
        materials[name] = material
    return materials


def configure(scene, cols=1, rows=1):
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 12
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 90
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    # 전체 실루엣에는 패킹 외곽선을 쓰고, 포대의 가려지는 면 경계는 Blender 선으로 남긴다.
    scene.render.use_freestyle = True
    settings = scene.view_layers[0].freestyle_settings
    line = settings.linesets[0] if settings.linesets else settings.linesets.new("R04 윤곽")
    line.select_silhouette = True
    line.select_border = False
    line.select_crease = False
    line.linestyle = bpy.data.linestyles.new("R04 카본선")
    line.linestyle.color = (.006, .008, .011)
    line.linestyle.thickness = 1.2
    scene.render.resolution_x = TILE * cols
    scene.render.resolution_y = TILE * rows
    scene.render.resolution_percentage = 100
    camera_data = bpy.data.cameras.new("고정 직교 카메라")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(cols, rows) * VIEW
    camera = bpy.data.objects.new(camera_data.name, camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.rotation_euler = (-CAMERA_RAY).to_track_quat("-Z", "Y").to_euler()
    camera.location = CAMERA_RAY * 35 + Vector((0, 0, CENTER_HEIGHT))
    axes = camera.rotation_euler.to_matrix()
    return axes @ Vector((1, 0, 0)), axes @ Vector((0, 1, 0))


def space_parts(scene, materials):
    for slot_index, slot in enumerate(scene.collection.children):
        for i, part in enumerate(slot.children):
            offset = bpy.data.objects.new("편집용 부품 배치", None)
            part.objects.link(offset)
            offset.empty_display_size = .12
            offset.location = (6 * i, 6 * slot_index, 0)
            for mesh in (obj for obj in part.objects if obj.type == "MESH"):
                mesh.parent = offset
                mesh.data.materials.append(materials.get(mesh["color"], materials["line"]))


def lay_out_kit(stage, out, recipe, palette, linear):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit = build_kit()
    materials = toon_materials(palette, linear)
    space_parts(kit, materials)
    scene = bpy.context.scene
    scene.name = "곡사 포대 · Lv20 조립"
    configure(scene)
    assemble(kit, materials, stage, scene.collection, Vector(), REVIEW_DIRECTION)
    scene["recipe"] = recipe.name
    for area in (bpy.context.screen.areas if bpy.context.screen else ()):
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.shading.color_type = "MATERIAL"
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "mortar-kit.blend"), compress=True)


def is_in_layer(part, layer):
    return layer == "form" or (part["mount"] == "ground") == (layer == "body")


def assemble(kit, materials, stage, group, tile, direction=0, layer="form", frame=0):
    weapon = stage["weaponStage"] - 1
    idle = IDLE_PITCHES[weapon]
    kick = KICK[frame]
    raise_fraction = FIRE_PITCH[frame]
    pitch = math.radians(idle + (62 - idle) * raise_fraction)
    world_pos = Matrix.Translation(tile)
    # 포상의 지면 접점은 유지하고 상부만 발사 순간 192px 기준 4px 내린다.
    up_z = math.sqrt(1 - CAMERA_RAY.z ** 2)
    sink = -4 * VIEW / (TILE / 2 * up_z) * kick
    press = Matrix.Translation((0, 0, sink))
    yaw = Matrix.Rotation(direction * DIR_ANGLE, 4, "Z")
    mount_height = CENTER_HEIGHT if layer == "head" else YAW_HEIGHTS[stage["materialStage"]]
    head = press @ Matrix.Translation((0, 0, mount_height)) @ yaw
    lift = .40 * raise_fraction if weapon >= 2 else 0
    elevation = head @ Matrix.Translation((0, 0, ELEVATION_HEIGHTS[weapon] + lift)) @ Matrix.Rotation(pitch, 4, "X")
    recoil = elevation @ Matrix.Translation((0, -stage["attack"]["recoil"] * kick, 0))
    mounts = {"yaw": head, "elevation": elevation, "recoil": recoil}
    finish = SURFACES[stage["materialStage"]]
    for slot in SLOTS:
        for name in stage["slots"].get(slot, []):
            part = kit.collection.children[slot].children[f"mortar/{name}"]
            if not is_in_layer(part, layer):
                continue
            if slot == "base":
                transform = Matrix.Identity(4)
            elif name == "hydraulic-legs":
                # 발판을 지면에 고정하고 피스톤 윗부분만 포상과 함께 눌린다.
                foot = Matrix.Translation((0, 0, .49))
                transform = foot @ Matrix.Diagonal((1, 1, 1 + sink / 1.11, 1)) @ foot.inverted()
            else:
                transform = mounts.get(part["mount"], press)
            for source in part.objects:
                if source.type != "MESH":
                    continue
                obj = source.copy()
                obj.parent = None
                group.objects.link(obj)
                obj.matrix_world = world_pos @ transform @ source.matrix_basis
                obj.material_slots[0].link = "OBJECT"
                color = finish if source["color"] == "surface" else source["color"]
                obj.material_slots[0].material = materials[color]
    if frame in (3, 4):
        p = Part(group)
        radius = (.27 if stage["weaponStage"] > 2 else .48) + .13 * (frame - 3)
        for muzzle in MUZZLES[weapon]:
            obj = p.lathe("발사 폭압 고리", muzzle,
                          [(.08, radius), (.115, radius + .02), (.130, radius - .025),
                           (.115, radius - .047)], "amber", steps=12, closed=True, forward=True)
            obj.data.materials.append(materials["amber"])
            obj.matrix_world = world_pos @ recoil @ obj.matrix_basis


def batch(kit, materials, path, cells, cols, assemble_cell=assemble, center_height=CENTER_HEIGHT):
    started = time.monotonic()
    rows = math.ceil(len(cells) / cols)
    scene = bpy.data.scenes.new(path.stem)
    right, up = configure(scene, cols, rows)
    scene.camera.location.z += center_height - CENTER_HEIGHT
    for i, (stage, direction, layer, frame) in enumerate(cells):
        x = i % cols - (cols - 1) / 2
        y = (rows - 1) / 2 - i // cols
        tile = VIEW * (right * x + up * y)
        assemble_cell(kit, materials, stage, scene.collection, tile, direction, layer, frame)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    seconds = round(time.monotonic() - started, 3)
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(scene)
    return {"columns": cols, "rows": rows, "frames": len(cells), "seconds": seconds}


def validate_kit(kit, stages):
    for stage in stages:
        for slot, names in stage["slots"].items():
            for name in names:
                part = kit.collection.children[slot].children.get(f"mortar/{name}")
                if not part or not any(obj.type == "MESH" for obj in part.objects):
                    raise ValueError(f'Lv{stage["level"]} {slot} 슬롯에 {name} 메시가 없습니다.')
    if any(stage["attack"]["frames"] != len(FIRE_PITCH) for stage in stages):
        raise ValueError("레시피의 발사 프레임 수와 곡사 포대 키프레임 수가 다릅니다.")


def render(recipe_file, out, kit_file, palette, linear):
    stages = json.loads(recipe_file.read_text())["stages"]
    tiers = [next(stage for stage in stages if stage["weaponStage"] == tier) for tier in range(1, 5)]
    out.mkdir(parents=True, exist_ok=False)
    if kit_file:
        bpy.ops.wm.open_mainfile(filepath=str(kit_file))
    else:
        lay_out_kit(stages[-1], out, recipe_file, palette, linear)
    kit = bpy.data.scenes["곡사 포대 · 부품"]
    materials = {name: bpy.data.materials[f"R04 · {name}"] for name in palette}
    validate_kit(kit, stages)

    def project(z):
        up_z = math.sqrt(1 - CAMERA_RAY.z ** 2)
        return [TILE // 2, round(TILE * (.5 - (z - CENTER_HEIGHT) * up_z / VIEW))]

    # 384px 셀을 사용해도 시트의 가로·세로가 4096px 안에 들어간다.
    head_groups = {"heads": [stage for stage in stages if stage["weaponStage"] <= 2],
                   "heads-armored": [stage for stage in stages if stage["weaponStage"] >= 3]}
    specs = {
        "bodies": ([(stage, 0, "body", 0) for stage in stages], 6),
        **{name: ([(stage, direction, "head", 0) for stage in group for direction in range(DIRECTIONS)], 10)
           for name, group in head_groups.items()},
        "attack": ([(stage, REVIEW_DIRECTION, "form", frame)
                    for stage in tiers for frame in range(stage["attack"]["frames"])], len(FIRE_PITCH)),
        "forms": ([(stage, REVIEW_DIRECTION, "form", 0) for stage in stages], 6),
    }
    layout = {
        "towerId": "mortar",
        "tile": TILE, "levels": [stage["level"] for stage in stages],
        "bodyPivot": project(0), "headPivot": project(CENTER_HEIGHT),
        "headAnchors": [project(YAW_HEIGHTS[stage["materialStage"]]) for stage in stages],
        "headSheets": {name: [stage["level"] for stage in group] for name, group in head_groups.items()},
        "directions": DIRECTIONS, "reviewDirection": REVIEW_DIRECTION,
        "weapons": [{"stage": stage["weaponStage"], "level": stage["level"], "attack": stage["attack"]}
                    for stage in tiers],
        "grids": {name: batch(kit, materials, out / f"{name}.png", cells, cols)
                  for name, (cells, cols) in specs.items()},
    }
    (out / "layout.json").write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n")
