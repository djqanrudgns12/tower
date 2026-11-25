"""삼각 기단과 열린 세 축 프레임 안에 결정 렌즈를 매단다."""

import math

from mathutils import Matrix, Vector

from mortar_kit import Kit
from support_mesh import beam, polygon, radial, regular


ANGLES = tuple(math.radians(a) for a in (114, 234, 354))
FRAME_LEAN = -.25


def frame_basis():
    # Blender의 직교 카메라 축에서 A프레임의 폭과 윗부분 기울기를 정한다.
    from mortar_render import CAMERA_RAY

    right = Vector((0, 0, 1)).cross(CAMERA_RAY).normalized()
    up = CAMERA_RAY.cross(right)
    camera = Matrix((right, up, CAMERA_RAY))
    profile = Matrix(((1, FRAME_LEAN, 0), (0, 1, 0), (0, 0, 1)))
    return camera.transposed() @ profile @ camera


def mount_point(height):
    return frame_basis() @ Vector((0, 0, height))


def shape_frame(kit):
    shape = frame_basis().to_4x4()
    for groups in kit.groups.values():
        for part in groups.children:
            if part["mount"] == "ground":
                for obj in part.objects:
                    local = obj.matrix_basis
                    obj.data.transform(local.inverted() @ shape @ local)



def crystal(p, name, center, r, h, color="amber", phase=0):
    rings = [[(*radial(radius, phase + i * math.pi / 3).xy, z) for i in range(6)]
             for z, radius in ((-h / 2, .024), (-h * .13, r * .88), (h * .12, r), (h / 2, .022))]
    p.mesh(name, rings, color, center)


def frame(kit, tier, spread, height):
    triangle = regular(spread, 3, ANGLES[0])
    trim = "amber" if tier == 4 else "silver"
    with kit.part("base", f"triangle-{tier}") as p:
        for i, (a, b) in enumerate(zip(triangle, triangle[1:] + triangle[:1])):
            beam(p, "기단 연결대", (*a, .17), (*b, .17), .27 + tier * .035, .30, "slate")
            beam(p, "기단 안쪽 띠", (*a, .32), (*b, .32), .10, .085, trim if tier > 2 else "line")
            foot = radial(spread, ANGLES[i], .17)
            p.plate("삼각 기단 모서리", foot, (.48, .55, .27), "surface", .14).rotation_euler.z = ANGLES[i]
    with kit.part("body", f"frame-{tier}") as p:
        for angle in ANGLES:
            low = radial(spread - .05, angle, .30)
            high = radial(.28 + .025 * tier, angle, height)
            beam(p, "A프레임 지지대", low, high, .25 + tier * .026, .30, "surface")
            offset = radial(.11, angle)
            beam(p, "프레임 밝은 능선", low + offset, high + offset, .09, .105, trim)
            p.rod("안쪽 하중 지지대", low.lerp(high, .10), radial(.35, angle, .68), .07, "line", steps=6)
        polygon(p, "삼각 꼭짓점 결합판", regular(.47, 3, ANGLES[0]),
                [(height - .08, 1), (height + .08, .9), (height + .16, .62)], trim)
        p.lathe("하단 집속 소켓", (0, 0, .33), [(0, .35), (.14, .42), (.31, .30), (.33, .20)],
                "slate", steps=6)
    with kit.part("head", f"iris-{tier}", "yaw") as p:
        p.lathe("집속부 은회 턱", (0, .35 + tier * .031, -.13),
                [(0, .16), (.09, .16), (.12, .12), (.12, .088), (.02, .087)],
                "silver", steps=6, closed=True, forward=True)
        p.plate("비대칭 방위 표식", (-.19, .03, -.35), (.13, .32, .12), "line")
    with kit.part("weapon", f"crystal-{tier}", "charge") as p:
        count = (0, 3, 1, 4)[tier - 1]
        crystal(p, "주수정 밝은 외곽", (0, 0, .06), .30 + tier * .049, 1.04 + tier * .104, "silver")
        crystal(p, "앰버 주수정", (.018, .032, .09), .30 + tier * .044, .94 + tier * .101, phase=.10)
        for i in range(count):
            a = i * math.tau / count + .30
            q = radial(.72 + .035 * tier, a, (-.43 if i % 2 else .18) if count > 1 else -.70)
            crystal(p, "위성 수정", q, .145 + tier * .016, .35 + tier * .05, phase=.24 + a)
            p.plate("위성 홀더", q + radial(0, 0, -.26), (.22, .21, .12), "line")


def build_kit():
    kit = Kit("prism", "프리즘 탑")
    frames = ((1.39, 3.31), (1.60, 3.60), (1.53, 4.06), (1.81, 4.39))
    for index, (spread, height) in enumerate(frames, 1):
        frame(kit, index, spread, height)

    upgrades = (
        ("base", "corner-bolts", 1, .57, .31, "teal"),
        ("armor", "outer-braces", 1, .94, 1.05, "silver"),
        ("armor", "alloy-shoes", 2, .80, .85, "line"),
        ("marking", "triangle-circuit", 2, 1.03, .40, "amber"),
        ("detail", "mirror-banks", 3, .58, 1.23, "silver"),
        ("armor", "apex-bracket", 3, .22, 2.42, "line"),
        ("armor", "gold-outriggers", 4, .63, 1.18, "amber"),
    )
    for slot, name, tier, extent, z, color in upgrades:
        radius, top = frames[tier - 1]
        with kit.part(slot, name) as p:
            for angle in ANGLES:
                outer = radial(radius + extent, angle, .20)
                inner = radial(radius * (1 - z / top) + .19, angle, z)
                beam(p, "삼각 외곽 보강", outer, inner, .32 + extent * .17, .29, color)
                if z > .8:
                    p.plate("결합판", outer, (.52, .44, .24), "slate").rotation_euler.z = angle
                if name == "corner-bolts":
                    p.plate("외곽 모서리 볼트", outer, (.52, .54, .34), "slate").rotation_euler.z = angle
                    p.plate("볼트의 틸 마개", outer + radial(0, 0, .17), (.40, .42, .11), "teal").rotation_euler.z = angle
                if name == "triangle-circuit":
                    b = radial(.88, angle, top + .38)
                    p.rod("상단 회로 갈래", radial(.20, angle, top), b, .11, "amber", steps=6)
            if name in ("corner-bolts", "alloy-shoes", "triangle-circuit", "apex-bracket", "gold-outriggers"):
                height = top + {"corner-bolts": .21, "alloy-shoes": .34, "triangle-circuit": .65,
                                "apex-bracket": .67, "gold-outriggers": .63}[name]
                radii = {
                    "apex-bracket": (.53, .69),
                    "triangle-circuit": (.77,),
                }.get(name, (.50,))
                for index, r in enumerate(radii):
                    p.lathe("상단 집속 고리", (0, 0, height + index * .24),
                            [(0, r - .03), (.05, r), (.13, r - .03), (.13, r - .16), (0, r - .16)],
                            color, steps=12, closed=True)
                for angle in ANGLES:
                    a, b = radial(.24, angle, top), radial(.43, angle, height + .05)
                    p.rod("고리 지지 핀", a, b, .068, color, steps=5)
    shape_frame(kit)
    return kit.scene
