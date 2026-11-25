"""육각 발진대와 격자 마스트, 갑판 위 드론과 별도 기체를 만든다."""

import math

from mortar_kit import Kit
from support_mesh import beam, polygon, radial, regular


MAST = (1.02, 1.48)
POSITIONS = (
    ((-.21, -.15),),
    ((-.74, -.24), (.52, .20)),
    ((-.87, -.36), (.58, -.55), (-.16, .69)),
    ((-.83, -.66), (.67, -.64), (-1.00, .65), (.38, .66)),
)


def drone(p, tier, lead):
    color = "amber" if tier == 4 and lead else "silver"
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
            p.plate("날개 끝 표식", (side * .48, -.185, .05), (.10, .08, .04), "amber")
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
        top = .30 + .055 * tier
        xy = regular(radius, 6, math.radians(8))
        with kit.part("base", f"deck-{tier}") as p:
            polygon(p, "육각 발진 갑판", xy, [(0, .87), (.075, 1), (top - .065, 1),
                    (top, .94)], "slate", .025)
            polygon(p, "갑판 단면 띠", xy, [(top - .128, 1.012), (top - .074, 1.012)],
                    "amber" if tier == 4 else "silver")
            polygon(p, "갑판 상판", xy, [(top, .92), (top + .041, .90)], "surface")
            for i, x in enumerate((-.49, .49) if tier >= 3 else (0,)):
                p.plate("발진 레일 홈", (x, -.10, top + .050), (.25, radius * 1.28, .046), "carbon")
                p.plate("발진 레일 띠", (x, -.10, top + .074), (.073, radius * 1.24, .036),
                        "amber" if i == 0 else "silver")
        with kit.part("body", f"mast-{tier}") as p:
            p.plate("마스트 자리", (*MAST, .31), (.594, .63, .37), "slate", .09)
            beam(p, "갑판과 마스트 이음쇠", (.60, .81, .18), (*MAST, .22), .43, .28, "line")
            if tier == 1:
                p.rod("짧은 갑판 마스트", (*MAST, .34), (*MAST, 1.01), .096, "silver", steps=6)
            else:
                for index in range(tier - 1):
                    bottom = .43 + index * .63
                    mast(p, bottom, bottom + .63, "silver", "line")
                p.rod("마스트 안테나", (*MAST, .43 + .63 * (tier - 1)), (*MAST, .78 + .63 * (tier - 1)),
                      .050, "amber" if tier == 4 else "silver", steps=6)
        with kit.part("head", f"antenna-{tier}", "mast-yaw") as p:
            p.plate("관제 안테나 머리", (0, .105, .0), (.33 + tier * .035, .16, .22 + tier * .041),
                    "silver", .09)
            p.plate("안테나 전면 띠", (0, .200, .04), (.25, .055, .095),
                    "amber" if tier == 4 else "teal")
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
        for x in (-.65, .45):
            beam(p, "진입 경사로", (x, -1.97, .105), (x, -1.08, .39), .48, .15, "silver")
            for i in range(3):
                p.plate("경사로 접지 띠", (x, -1.79 + i * .18, .26 + i * .06), (.35, .075, .055), "line")
    with kit.part("armor", "windbreak") as p:
        beam(p, "발진대 방풍벽", (-1.53, -.49, .45), (-1.02, 1.08, .46), .26, .70, "line")
        beam(p, "방풍벽 밝은 턱", (-1.53, -.49, .81), (-1.02, 1.08, .82), .12, .10, "silver")
    with kit.part("detail", "mast-extensions") as p:
        mast(p, 1.10, 1.69, "silver", "line")
        p.rod("격자 보조 안테나", (*MAST, 1.69), (1.40, 1.83, 1.87), .055, "teal", steps=6)
        p.plate("합금 측면 스커트", (1.62, -.78, .23), (.53, .81, .33), "surface")
    with kit.part("body", "dock") as p:
        for x in (-1.78, 1.91):
            beam(p, "충전 도크 연결대", (x * .67, .02, .20), (x, .02, .30), .32, .26, "line")
            p.plate("갑판 옆 충전 도크", (x, .12, .31), (.82, 1.02, .53), "slate", .13)
            p.plate("도크 상판", (x, .12, .64), (.70, .86, .19), "silver", .13)
            p.plate("도크 단자", (x, .12, .77), (.38, .53, .15), "amber")
    with kit.part("base", "outriggers") as p:
        for a in (.15, 1.65, 3.29, 4.79):
            p.plate("외곽 지지발", radial(1.86, a, .14), (.68, .61, .25), "slate").rotation_euler.z = a
            beam(p, "갑판 버팀목", radial(2.09, a, .21), radial(1.48, a, .52), .34, .18, "silver")
    with kit.part("detail", "extension-deck") as p:
        mast(p, 1.71, 2.20, "silver", "line")
        for a in (.1, 3.24):
            loc = radial(2.09, a, .26)
            p.plate("발진대 탄약 랙", loc, (.79, .70, .38), "line").rotation_euler.z = a
            p.plate("탄약 랙 모서리", (loc.x, loc.y, .48), (.65, .56, .11), "teal").rotation_euler.z = a
    with kit.part("marking", "hex-light") as p:
        for radius, center in ((.62, (0, .25)), (.57, (-.72, -.34)), (.57, (.72, -.34))):
            xy = [(x + center[0], y + center[1]) for x, y in regular(radius, 6, .08)]
            for a, b in zip(xy, xy[1:] + xy[:1]):
                beam(p, "갑판 앰버 육각 표시", (*a, .578), (*b, .578), .050, .031, "amber")
        mast(p, 2.31, 2.76, "silver", "line")
        for a in (-2.08, -.72, .90, 2.82):
            beam(p, "외곽 금테 방풍턱", radial(2.42, a, .27), radial(1.65, a, .70), .42, .24, "amber")
    return kit.scene
