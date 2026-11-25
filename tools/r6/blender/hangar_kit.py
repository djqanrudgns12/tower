"""육각 발진대와 격자 마스트, 갑판 위 드론과 별도 기체를 만든다."""

import math

from mortar_kit import Kit
from support_mesh import beam, polygon, radial, regular


MAST = (1.02, 1.22)
DECK_HEIGHTS = (.65, .85, 1.05, 1.25)
MAST_TOPS = (1.32, 1.78, 2.32, 2.76)
FLEET_HEIGHTS = (1.12, 1.18, 1.36, 1.52)
DRONE_SCALE = 1.32
POSITIONS = (
    ((-.21, -.15),),
    ((-.74, -.24), (.52, .20)),
    ((-.87, -.36), (.58, -.55), (-.16, .69)),
    ((-.83, -.66), (.67, -.64), (-1.00, .65), (.38, .66)),
)


def drone(p, tier, lead):
    color = "silver"
    p.plates("무인기 동체", (0, 0, 0), [(-.075, .26, .55, .08), (.005, .32, .76, .13),
             (.09, .24, .61, .10)], color, .018)
    p.plate("전방 센서", (0, .31, .022), (.17, .19, .08), "carbon")
    p.plate("전방 식별 띠", (0, .403, .034), (.16, .039, .07), "teal")
    if tier <= 2:
        for side in (-1, 1):
            for y in (-.21, .18):
                p.rod("로터 팔", (side * .08, y * .56, 0), (side * .40, y, .04), .06, "line", steps=6)
                p.lathe("로터 보호 테", (side * .40, y, .05),
                        [(0, .145), (.048, .145), (.048, .095), (0, .095)],
                        "silver", steps=10, closed=True)
    else:
        for side in (-1, 1):
            wing = [(side * x, y) for x, y in ((.06, .17), (.57, -.15), (.54, -.26), (.09, -.14))]
            polygon(p, "고정익", wing if side == 1 else wing[::-1], [(-.025, 1), (.047, 1)], color)
            p.plate("추진부", (side * .21, -.29, .04), (.13, .35, .14), "line")
            p.plate("날개 끝 표식", (side * .48, -.185, .05), (.10, .08, .04), "amber" if tier == 4 and lead else "line")
    p.plate("등줄 패널", (-.085, -.05, .086), (.106, .27, .067), "slate")


def mast(p, low, high, color, trim):
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        a = (MAST[0] + sx * .19, MAST[1] + sy * .19, low)
        b = (*a[:2], high)
        p.rod("격자 기둥", a, b, .045, color, steps=6)
        end = (MAST[0] - sx * .19, a[1], (low + high) / 2)
        p.rod("격자 대각선", a, end, .035, trim, steps=5)
        p.rod("격자 대각선", end, b, .035, trim, steps=5)
        p.rod("격자 가로 연결", b, (b[0], MAST[1] - sy * .19, high), .045, color, steps=6)
    p.plate("격자 상판", (*MAST, high + .035), (.53, .53, .11), color)


def build_kit():
    kit = Kit("hangar", "드론 격납고")
    for tier, radius in enumerate((1.48, 1.65, 1.79, 1.94), 1):
        top = DECK_HEIGHTS[tier - 1]
        mast_top = MAST_TOPS[tier - 1]
        xy = regular(radius, 6, math.radians(8))
        with kit.part("base", f"deck-{tier}") as p:
            polygon(p, "하단 격납 벙커", xy, [(0, .81), (.10, .95), (top * .60, .86)],
                    "slate", .025)
            polygon(p, "상단 육각 발진 갑판", xy, [(top * .60, .84), (top * .66, 1),
                    (top - .07, 1), (top, .94)], "silver", .025)
            polygon(p, "갑판 단면 띠", xy, [(top - .049, .989), (top - .020, .968)],
                    "amber" if tier == 4 else "line")
            polygon(p, "발진로 표면", xy, [(top, .76), (top + .039, .75)], "surface")
            if tier == 4:
                for x in (-.70, .70):
                    p.plate("은회 갑판 정비 유도로", (x, .01, top + .045), (.54, 1.65, .017),
                            "line", .12, .005)
            p.plate("전면 격납 출입문", (0, -radius * .81, top * .28),
                    (radius * .84, .17, top * .47), "carbon", .11)
            for x in (-radius * .46, radius * .46):
                p.plate("격납 입구의 경사 장갑", (x, -radius * .76, top * .31),
                        (.31, .24, top * .66), "line", .08).rotation_euler.y = x * -.22
                p.plate("격납 출입등", (x, -radius * .867, top * .42), (.15, .04, .11), "teal")
            for i, x in enumerate((-.49, .49) if tier >= 3 else (0,)):
                p.plate("발진 레일 홈", (x, -.10, top + .050), (.25, radius * 1.28, .046), "carbon")
                p.plate("발진 레일 띠", (x, -.10, top + .074), (.073, radius * 1.24, .036),
                        "amber" if i == 0 else "silver")
        with kit.part("body", f"mast-{tier}") as p:
            p.plate("마스트 자리", (*MAST, top * .66), (.56, .55, top * 1.18), "slate", .09)
            if tier == 1:
                p.rod("짧은 갑판 마스트", (*MAST, top), (*MAST, mast_top), .10, "line", steps=6)
            else:
                mast(p, top, mast_top - .15, "line", "slate")
            if tier >= 3:
                p.plate("관제실 캐빈", (*MAST, mast_top - .14), (.70, .63, .36), "silver", .13)
                p.plate("관제실 전면 창", (MAST[0], MAST[1] - .31, mast_top - .14),
                        (.55, .047, .16), "carbon")
                p.plate("관제실 지붕 마감", (*MAST, mast_top + .043), (.73, .68, .034),
                        "amber" if tier == 4 else "line", .14)
        with kit.part("head", f"antenna-{tier}", "mast-yaw") as p:
            p.plate("관제 안테나 머리", (0, .105, .0), (.33 + tier * .035, .16, .22 + tier * .041),
                    "line", .09)
            p.plate("틸 레이더 전면 띠", (0, .200, .04), (.25, .055, .095), "teal")
        with kit.part("weapon", f"fleet-{tier}", "fleet") as p:
            drone(p, tier, True)
        with kit.part("detail", f"wingman-{tier}", "wingman") as p:
            drone(p, tier, False)
    with kit.part("marking", "guide-pillars") as p:
        for a in (-2.08, -.72, .90, 2.82):
            foot = radial(1.53, a, .12)
            p.plate("유도등 지지대", foot, (.52, .41, .20), "slate").rotation_euler.z = a
            p.plate("틸 유도등", radial(1.68, a, .26), (.26, .17, .09), "teal").rotation_euler.z = a
    with kit.part("base", "ramp") as p:
        for x in (-.56, .56):
            beam(p, "격납 아치 기둥", (x, -1.86, .17), (x * .87, -1.61, .86), .30, .28, "silver")
            beam(p, "모따기 격납 아치", (x * .87, -1.61, .86), (x * .61, -1.49, 1.08),
                 .27, .24, "silver")
        beam(p, "격납 아치 윗턱", (-.37, -1.49, 1.08), (.37, -1.49, 1.08), .23, .24, "line")
        p.plate("격납 아치 전면 표식", (0, -1.61, 1.071), (.33, .06, .080), "teal")
    with kit.part("armor", "windbreak") as p:
        beam(p, "발진대 방풍벽", (-1.53, -.49, .45), (-1.02, 1.08, .46), .26, .70, "line")
        beam(p, "방풍벽 밝은 턱", (-1.53, -.49, .81), (-1.02, 1.08, .82), .12, .10, "silver")
    with kit.part("detail", "mast-extensions") as p:
        mast(p, 1.10, 1.69, "slate", "line")
        p.rod("격자 보조 안테나", (*MAST, 1.69), (1.40, 1.83, 1.87), .055, "teal", steps=6)
        p.plate("합금 측면 스커트", (1.62, -.78, .23), (.53, .81, .33), "surface")
    with kit.part("body", "dock") as p:
        for x in (-1.78, 1.91):
            beam(p, "충전 도크 연결대", (x * .67, .02, .20), (x, .02, .30), .32, .26, "line")
            p.plate("갑판 옆 충전 도크", (x, .12, .31), (.82, 1.02, .53), "slate", .13)
            p.plate("도크 상판", (x, .12, .64), (.70, .86, .19), "silver", .13)
            p.plate("도크 단자", (x, .12, .77), (.38, .53, .15), "teal")
    with kit.part("base", "outriggers") as p:
        for a in (.15, 1.65, 3.29, 4.79):
            p.plate("외곽 지지발", radial(1.86, a, .14), (.68, .61, .25), "slate").rotation_euler.z = a
            beam(p, "갑판 버팀목", radial(2.09, a, .21), radial(1.48, a, .52), .34, .18, "silver")
    with kit.part("detail", "extension-deck") as p:
        mast(p, 1.71, 2.20, "line", "slate")
        for a in (.1, 3.24):
            loc = radial(2.09, a, .26)
            p.plate("발진대 탄약 랙", loc, (.79, .70, .38), "line").rotation_euler.z = a
            p.plate("탄약 랙 모서리", (loc.x, loc.y, .48), (.65, .56, .11), "teal").rotation_euler.z = a
    with kit.part("marking", "hex-light") as p:
        for radius, center in ((.58, (0, .23)), (.49, (-.59, -.34)), (.49, (.59, -.34))):
            xy = [(x + center[0], y + center[1]) for x, y in regular(radius, 6, .08)]
            for a, b in zip(xy, xy[1:] + xy[:1]):
                beam(p, "갑판 앰버 육각 표시", (*a, 1.305), (*b, 1.305), .037, .022, "amber")
        for a in (-2.08, -.72, .90, 2.82):
            p.plate("갑판 외곽 접지 리브", radial(1.65, a, .36),
                    (.43, .19, .33), "silver", .06).rotation_euler.z = a
    for tier, top in enumerate(DECK_HEIGHTS, 1):
        with kit.part("marking", f"launch-guide-{tier}", "guide") as p:
            p.plate("발진 레일 유도등", (0, -1.06, top + .085), (.20, .37, .041), "teal")
    return kit.scene
