"""열린 호형 기단으로 연결한 방벽과 편심 레이더 붐."""

import math

from mortar_kit import Kit
from support_mesh import arc, beam, radial


BOOM_XY = (0.0, 1.05)
BOOM_HEIGHTS = (1.68, 1.96, 2.28, 2.61)
DISH_XY = (0.0, .56)
WALL_RADII = (1.39, 1.65, 1.88, 2.04)
START, TURN, END = (math.radians(x) for x in (-196, -9, 41))


def build_kit():
    kit = Kit("bastion", "방벽 기지")
    for tier, radius in enumerate(WALL_RADII, 1):
        apex = BOOM_HEIGHTS[tier - 1]
        trim = "amber" if tier == 4 else "silver"
        top = (.55 + tier * .13) * 1.39
        with kit.part("base", f"arc-{tier}") as p:
            arc(p, "방벽과 붐이 공유하는 호형 기초", (0, 0, 0), START, END,
                [(0, radius + .22), (.09, radius + .28), (.23, radius + .26), (.27, radius + .12),
                 (.27, radius - .27), (.09, radius - .35), (0, radius - .30)], "slate", 22)
            arc(p, "호형 기초의 외곽 띠", (0, 0, 0), START, END,
                [(.15, radius + .271), (.21, radius + .271), (.21, radius + .22), (.15, radius + .22)],
                "line", 22)
            start = radial(radius - .13, END, .17)
            beam(p, "호형 기초와 붐 받침 연결부", start, (*BOOM_XY, .19), .52, .31, "line")
        with kit.part("body", f"boom-{tier}") as p:
            r = radius * .63
            p.lathe("팔각 지원 벙커", (0, 0, 0), [(.12, r * 1.10), (.25, r * 1.14),
                    (top * .72, r), (top * .90, r * .85)], "slate", steps=8)
            p.lathe("벙커 상부 장갑", (0, 0, top * .86), [(0, r * .88), (.11, r * .84),
                    (.18, r * .70)], "surface", steps=8)
            p.lathe("중앙 틸 송출 코어", (0, -.31, top * .98), [(0, r * .56), (.12, r * .62),
                    (.21, r * .51), (.23, r * .42)], "teal", steps=8)
            p.lathe("송출 코어 접합부", (0, -.31, top * .99), [(0, r * .64), (.06, r * .64),
                    (.07, r * .57), (0, r * .57)], "silver", steps=8, closed=True)
            x, y = BOOM_XY
            a = (x, y, .25)
            b = (*DISH_XY, apex)
            p.plate("붐 받침", (x, y, .22), (.63, .61, .37), "surface", .14)
            beam(p, "전력 하우징 일체형 붐", a, b, (.19 + .015 * tier) * 1.8, .44, "line")
            p.plate("붐 하단 발전 팩", (x, y + .12, .66), (.58 + .08 * tier, .66, .85), "slate", .13)
            for sign in (-1, 1):
                beam(p, "붐 은회 외곽 능선", (sign * .18, y, .55),
                     (sign * .15, b[1], b[2]), .095, .097, "silver")
            beam(p, "붐 발 지지대", (x + .23, y + .11, .24), (x - .09, y, .95), .20, .15, "silver")
            p.rod("회전 접시 받침", (b[0], b[1], apex - .15), (b[0], b[1], apex + .09),
                  .15, "silver", steps=8)
        with kit.part("armor", f"wall-{tier}", "wall") as p:
            color = "slate" if tier == 4 else "surface"
            for index in range(tier):
                outer = radius + .07 - .122 * index
                z = .25 + index * .095
                h = top - .125 * (tier - 1 - index)
                arc(p, "이어진 전면 방벽판", (0, 0, 0), START, TURN,
                    [(z, outer), (z + .08, outer + .04), (h - .12, outer + .015),
                     (h, outer - .10), (h, outer - .21), (z, outer - .23)], color)
                arc(p, "방벽의 틸 충격 슬롯", (0, 0, 0), START, TURN,
                    [(h - .152, outer + .014), (h - .067, outer + .014),
                     (h - .067, outer - .009), (h - .152, outer - .009)], "teal")
                if tier == 4 and index == 0:
                    arc(p, "외벽 은회 교체 장갑", (0, 0, 0), START + .38, TURN - .38,
                        [(z + .10, outer + .044), (z + .31, outer + .036),
                         (z + .32, outer + .019), (z + .10, outer + .025)], "silver", 14)
                rim = "amber" if tier == 4 and index == tier - 1 else "silver"
                arc(p, "방벽의 얇은 상단 마감", (0, 0, 0), START, TURN,
                    [(h - .018, outer - .067), (h + .007, outer - .097),
                     (h + .007, outer - (.178 if rim == "amber" else .264)),
                     (h - .018, outer - (.170 if rim == "amber" else .257))], rim)
            for a in tuple(START + (TURN - START) * i / (tier + 1) for i in range(1, tier + 1)):
                beam(p, "충격 분산 리브", radial(radius + .13, a, .31), radial(radius - .043, a, top - .025),
                     .146, .122, "silver")
        with kit.part("head", f"swivel-{tier}", "dish") as p:
            p.plate("안테나 편심 베어링", (0, -.085, 0), (.29, .24, .25), "slate")
        with kit.part("weapon", f"radar-{tier}", "dish") as p:
            r = (.36, .62, .85, 1.12)[tier - 1]
            pivot = (0, 0, .16 + r * .26)
            dish = p.lathe("오목 접시", pivot, [(-.24, .075), (-.19, .56 * r), (.04, r * .97), (.09, r),
                          (.102, r * .91), (-.06, r * .73), (-.138, .045)], "silver", steps=18, closed=True)
            dish.rotation_euler.x = math.radians(-62)
            rim = p.lathe("레이더 접시 밝은 테두리", pivot,
                          [(.035, r * .968), (.082, r * 1.026), (.115, r * .98), (.112, r * .952)],
                          trim, steps=18, closed=True)
            rim.rotation_euler = dish.rotation_euler
            p.rod("편심 접시의 수신기", (0, 0, pivot[2]), (-.11, .29 + r * .29, pivot[2] + .16),
                  .074 if tier > 1 else .06, "teal" if tier == 4 else "silver", steps=7)

    enhancements = (
        ("base", "wedges", 1, .66, "silver"),
        ("marking", "end-rails", 1, .92, "teal"),
        ("body", "ram-banks", 2, .76, "silver"),
        ("detail", "power-pack", 2, .96, "line"),
        ("base", "anchors", 3, .85, "silver"),
        ("armor", "sensor-guards", 3, .84, "teal"),
        ("base", "gold-steps", 4, .74, "silver"),
    )
    for slot, name, tier, extent, trim in enhancements:
        radius = WALL_RADII[tier - 1]
        with kit.part(slot, name) as p:
            for angle in (START + .18, START + .82, TURN - .27):
                foot = radial(radius + extent, angle, .15)
                p.plate("방벽 외곽 발", foot, (.48 + extent * .39, .56, .27), "slate", .10).rotation_euler.z = angle
                beam(p, "쐐기 보강 지지대", foot, radial(radius - .07, angle, .51), .28, .23, trim)
                if name in ("wedges", "ram-banks", "anchors", "gold-steps"):
                    cap = foot + radial(0, 0, .16)
                    p.plate("외곽 발 밝은 체결판", cap, (.53, .48, .085), trim).rotation_euler.z = angle
                if name == "ram-banks":
                    p.rod("외장 유압 실린더", foot + radial(0, 0, .19), radial(radius - .07, angle, .64),
                          .13, "silver", steps=7)
            if name in ("end-rails", "power-pack", "sensor-guards", "gold-steps"):
                x, y = BOOM_XY
                h = BOOM_HEIGHTS[tier - 1]
                beam(p, "붐 보조 센서 지지대", (x - .34, y - .1, h - .47), (x + .32, y + .19, h - .17),
                     .14, .18, trim)
                p.plate("붐 보조 센서", (x + .34, y + .19, h - .16), (.30, .26, .49), "silver", .12)
                if name == "sensor-guards":
                    beam(p, "붐의 바깥쪽 보강대", (x, y, .45), (x + .52, y + .33, h + .21),
                         .20, .28, "line")
                    p.plate("붐 위쪽 보호 턱", (x + .52, y + .33, h + .19), (.44, .45, .29), "silver")
    with kit.part("detail", "command-receiver", "dish") as p:
        p.lathe("이중 지휘 코어", (0, .36, .54), [(0, .13), (.069, .143), (.069, .092), (0, .092)],
                "teal", steps=12, closed=True, forward=True)
        for x in (-.67, .67):
            p.plate("접시 좌우 송출 날개", (x, -.04, .35), (.36, .26, .40), "teal", .080)
    return kit.scene
