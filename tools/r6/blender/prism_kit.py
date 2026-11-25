"""삼각 기단과 열린 세 축 프레임 안에 결정 렌즈를 매단다."""

import math

from mathutils import Vector

from mortar_kit import Kit
from support_mesh import beam, octahedron, polygon, radial, regular


ANGLES = tuple(math.radians(a) for a in (127, 247, 7))
FRAME_LEAN = 0.0


def mount_point(height):
    return Vector((FRAME_LEAN * height, 0, height))


def frame(kit, tier, spread, height):
    triangle = regular(spread, 3, ANGLES[0])
    trim = "silver"
    with kit.part("base", f"triangle-{tier}") as p:
        polygon(p, "집속 기단 하부", regular(spread * .76, 6, ANGLES[0]),
                [(0, .94), (.13, 1.02), (.33, 1), (.51, .73)], "slate")
        for i, (a, b) in enumerate(zip(triangle, triangle[1:] + triangle[:1])):
            beam(p, "기단 연결대", (*a, .17), (*b, .17), .27 + tier * .035, .30, "slate")
            beam(p, "기단 안쪽 띠", (*a, .32), (*b, .32), .10, .085, trim if tier > 2 else "line")
            foot = radial(spread, ANGLES[i], .17)
            p.plate("삼각 기단 모서리", foot, (.48, .55, .27), "surface", .14).rotation_euler.z = ANGLES[i]
    with kit.part("body", f"frame-{tier}") as p:
        for angle in ANGLES:
            low = radial(spread - .05, angle, .30)
            high = radial(.28 + .025 * tier, angle, height)
            bend = .39 if tier == 3 else .22
            sections = [(0, spread - .05, .68), (.31, spread * .83 + bend, .61),
                        (.61, spread * .62 + bend, .54), (.83, spread * .40 + bend, .48),
                        (1, high.xy.length, .43)]
            rings = []
            for t, radius, width in sections:
                center = radial(radius, angle, low.z + t * (high.z - low.z))
                rings.append([tuple(center + radial(width * .67, corner)) for corner in
                              (angle + .60, angle + 2.40, angle + 3.75, angle + 5.50)])
            p.mesh("곡선 분할 장갑" if tier == 3 else "테이퍼 A프레임 장갑",
                   rings, "surface", bevel=.027)
            for a, b in zip(sections, sections[1:]):
                z0, z1 = (low.z + t * (high.z - low.z) for t in (a[0], b[0]))
                beam(p, "프레임 밝은 외곽 능선", radial(a[1] + .30, angle, z0),
                     radial(b[1] + .30, angle, z1), .085, .10, "line" if tier == 4 else trim)
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
        octahedron(p, "단일 앰버 주수정", (0, 0, .10), (.30 + tier * .044) * 1.65,
                   (.94 + tier * .101) * 1.35, "amber", phase=.10)
    if tier > 1:
        with kit.part("weapon", f"satellites-{tier}", "orbit") as p:
            count = (0, 2, 3, 4)[tier - 1]
            for i in range(count):
                a = i * math.tau / count + .50
                q = radial(1.43 + .102 * (tier - 1), a, -.43 if i % 2 else .27)
                octahedron(p, "외곽 위성 수정", q, .134 + tier * .022, .35 + tier * .062, "amber", phase=.24 + a)


def build_kit():
    kit = Kit("prism", "프리즘 탑")
    frames = ((1.39, 3.31), (1.60, 3.60), (1.53, 4.06), (1.81, 4.39))
    for index, (spread, height) in enumerate(frames, 1):
        frame(kit, index, spread, height)

    upgrades = (
        ("base", "corner-bolts", 1, .57, .31, "teal"),
        ("armor", "outer-braces", 1, .94, 1.05, "silver"),
        ("armor", "alloy-shoes", 2, .80, .85, "line"),
        ("marking", "triangle-circuit", 2, .83, .40, "line"),
        ("detail", "mirror-banks", 3, .58, 1.23, "silver"),
        ("armor", "apex-bracket", 3, .22, 2.42, "line"),
        ("armor", "gold-outriggers", 4, .66, 1.18, "slate"),
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
                if name == "gold-outriggers":
                    beam(p, "버팀목의 얇은 은회 가장자리", outer + Vector((0, 0, .13)),
                         inner + Vector((0, 0, .13)), .066, .068, "silver")
    for tier, (_, top) in enumerate(frames, 1):
        if tier < 2:
            continue
        with kit.part("detail", f"optical-ring-{tier}") as p:
            r = (.77, .81, .90)[tier - 2]
            p.lathe("부유 광학 고리", (0, 0, top + .34),
                    [(0, r - .03), (.05, r), (.13, r - .03), (.13, r - .13), (0, r - .13)],
                    "silver", steps=12, closed=True)
    return kit.scene
