"""레일 포탑과 냉각 중계탑의 편집용 부품 컬렉션을 만든다."""

import math

from mortar_kit import Kit


TITLES = {"rail": "레일 포탑", "cryo": "냉각 중계탑"}
RAIL_HEIGHTS = (1.46, 1.55, 1.72, 1.92)
CRYO_HEIGHT = 1.57
RAIL_PITCH = (16, 23, 35, 51)
RAIL_PORTS = (
    ((0, 1.98, .13),),
    ((-.29, 2.10, .13), (.29, 2.10, .13)),
    ((-.43, 2.21, .04), (.43, 2.21, .04), (0, 2.39, .49)),
    ((-.48, 2.42, -.16), (.48, 2.42, -.16), (-.48, 2.68, .47), (.48, 2.68, .47)),
)
CRYO_BANKS = (
    ((.39, .64), (1.10, .69), (1.86, .65)),
    ((.35, .88), (.94, .85), (1.54, .82), (2.16, .77)),
    ((.25, .90), (.77, .97), (1.91, .93), (2.54, .87)),
    ((.40, 1.05), (1.04, 1.10), (1.67, 1.15), (2.29, 1.12), (2.92, 1.08)),
)


def rail_base(kit):
    with kit.part("base", "chamfered-deck") as p:
        p.plates("팔각 기단", (0, 0, 0), [(0, 1.86, 1.78, .32), (.10, 2.04, 1.91, .40),
                 (.22, 2.04, 1.91, .40), (.31, 1.89, 1.75, .34)], "slate", .025)
        p.plate("갑판 테두리", (0, 0, .219), (2.04, 1.91, .05), "line", .40)
        p.plate("갑판 윗판", (0, 0, .305), (1.75, 1.59, .06), "line", .33)
    with kit.part("base", "clamp-feet") as p:
        for x in (-.90, .90):
            p.plates("기단 잠금 날개", (x, .02, 0), [(.08, .91, .79, .14),
                     (.29, .93, .78, .14), (.51, .59, .62, .10)], "line", .023)
            p.plate("잠금 날개 밝은 이음새", (x * 1.31, .03, .22), (.33, .73, .079), "silver", .06)
    with kit.part("base", "outriggers") as p:
        for x in (-1, 1):
            p.plate("유압 고정발", (x * 1.28, -.35, .14), (.94, .69, .25), "slate", .13)
            p.plate("발판 보강 테", (x * 1.30, -.35, .26), (.89, .60, .10), "silver", .11)
            p.rod("고정발 실린더", (x * .67, -.35, .79), (x * 1.41, -.35, .27), .13, "line")
    with kit.part("base", "rear-deck") as p:
        p.plates("확장 갑판", (0, .54, 0), [(.06, 1.69, 2.62, .29),
                 (.21, 1.96, 2.80, .38), (.32, 1.81, 2.62, .31)], "slate", .027)
        p.plate("확장 갑판 조임대", (0, 1.69, .36), (1.53, .45, .26), "line", .10)
        p.plate("조임대 윗 테", (0, 1.72, .50), (1.39, .35, .06), "silver", .09)
    with kit.part("base", "gilded-rails") as p:
        for sign in (-1, 1):
            p.plates("기단 외곽 경사 레일", (sign * .87, -.04, 0), [(.03, .88, 1.59, .20),
                     (.23, .90, 1.77, .22), (.51, .59, 1.03, .13)], "line", .036)
            p.plate("경사 레일 테", (sign * 1.24, -.01, .21), (.19, 1.41, .09), "amber", .05)
    for index, (name, top, w, d) in enumerate(zip(
        ("steel-neck", "alloy-neck", "ceramic-mast", "tapered-spire"), RAIL_HEIGHTS,
        (.74, .84, 1.10, 1.28), (.69, .84, .99, .90),
    )):
        with kit.part("body", name) as p:
            p.plates("포두 받침 기둥", (0, 0, 0), [(.32, w, d, .14), (.52, w * .97, d, .15),
                     (top - .17, w * .68, d * .77, .12), (top, w * .74, d * .80, .12)], "surface", .04)
            p.plate("기둥 아랫단", (0, 0, .48), (w + .16, d + .15, .17), "slate", .19)
            p.lathe("회전판 아래 그늘", (0, 0, top - .08), [(0, w * .44), (.09, w * .44)], "carbon")
            for sign in (-1, 1):
                panel = p.plates("기둥 세로 이음판", (sign * w * .43, -.11, 0),
                                 [(.45, .19, d * .71, .047), (.78, .22, d * .58, .055),
                                  (top - .20, .13, d * .38, .037)], "line" if index == 2 else "slate", .012)
                panel.rotation_euler.y = -sign * (.04 + index * .05)
            if index == 3:
                for sign in (-1, 1):
                    p.plate("기둥 밑단 금테", (sign * .56, -.36, .53), (.33, .18, .31), "amber", .048)


def rail_head(kit):
    with kit.part("head", "yaw-bearing", "yaw") as p:
        p.lathe("회전 받침", (0, 0, 0), [(0, .45), (.08, .52), (.19, .49), (.25, .40)], "slate")
        p.lathe("회전 받침 테", (0, 0, .11), [(0, .53), (.07, .51)], "silver")
        for sign in (-1, 1):
            p.plate("회전축 덮개", (sign * .34, -.05, .32), (.31, .52, .33), "surface", .09)
    names = ("single-rail", "twin-rails", "triple-rails", "quad-accelerator")
    for i, (ports, name) in enumerate(zip(RAIL_PORTS, names)):
        with kit.part("weapon", name, "recoil") as p:
            width = (.71, 1.02, 1.42, 1.53)[i]
            color = ("line", "line", "silver", "line")[i]
            p.plates("포미 하우징", (0, -.40, 0), [(-.28, width * .78, 1.22, .15),
                     (-.11, width, 1.42, .21), (.41, width, 1.37, .23),
                     (.57 if i < 2 else .71, width * .76, 1.17, .19)], color, .047)
            p.plate("포미 하부의 그늘", (0, -.19, -.20), (width * .85, 1.21, .11), "carbon", .12)
            for sign in (-1, 1):
                p.plate("포미 옆판", (sign * width * .49, -.51, .10), (.10, 1.11, .40), "slate", .04)
                p.plate("측면 조준 표시", (sign * width * .55, -.22, .19), (.037, .44, .14),
                        "amber" if i == 3 else "teal", .012)
            for x, tip, z in ports:
                p.plate("포신 밑동", (x, .28, z), (.43, .69, .39), "slate", .095)
                p.rod("노출 레일 축", (x, .46, z), (x, tip - .12, z), .133, "line")
                pair_y = (.50 + tip) / 2
                for sign in (-1, 1):
                    p.plate("평행 안내 레일", (x + .126 * sign, pair_y, z + .020),
                            (.096, tip - .43, .20), "silver" if sign > 0 or i > 1 else "line", .024)
                p.plate("레일 홈 표시", (x, pair_y, z + .129), (.053, tip - .67, .025), "teal", .015)
                p.muzzle((x, tip - .18, z), .179 if i != 3 else .202, "slate", "silver", depth=.19, sides=8)
            if i == 1:
                p.rod("회전판 조준기 목", (0, -.48, .54), (0, -.48, .90), .079, "slate")
                p.muzzle((0, -.54, .93), .18, "line", "silver", depth=.16, sides=8)
            if i == 3:
                for y in (.45, 1.10, 1.80):
                    acceleration_ring(p, y, "amber")


def acceleration_ring(p, y, accent, radius=1.01):
    # 세로로 타원형인 안쪽 구멍을 남겨 네 포신을 밖에서 감싼다.
    ring = p.lathe("가속 고리 몸통", (0, y, .13),
                   [(0, radius * .965), (.065, radius), (.15, radius),
                    (.20, radius * .96), (.20, radius * .87), (0, radius * .87)],
                   "slate", steps=12, closed=True, forward=True)
    ring.scale.y = .66
    trim = p.lathe("가속 고리 바깥 테", (0, y + .12, .13),
                   [(0, radius * 1.009), (.025, radius * 1.02), (.063, radius * .985),
                    (.064, radius * .939), (0, radius * .939)],
                   accent, steps=12, closed=True, forward=True)
    trim.scale.y = .66
    for sign in (-1, 1):
        p.plate("가속 고리 체결쇠", (sign * radius * .82, y + .09, .39),
                (.32, .26, .17), "silver", .056)


def rail_upgrades(kit):
    with kit.part("weapon", "recoil-slider", "recoil") as p:
        p.plate("하부 반동 슬라이더", (0, .50, -.22), (.52, 1.90, .30), "slate", .088)
        p.plate("측면 슬라이더 안내선", (.25, .54, -.23), (.062, 1.67, .083), "silver", .022)
    with kit.part("armor", "steel-bolsters", "recoil") as p:
        for sign in (-1, 1):
            p.plates("포미 측면 볼스터", (sign * .40, -.39, 0), [(-.30, .37, 1.43, .13),
                     (-.17, .53, 1.67, .14), (.32, .41, 1.50, .13)], "line", .025)
        p.plate("후방 균형추", (0, -1.17, .18), (.78, .83, .48), "slate", .14)
    with kit.part("armor", "twin-brace", "recoil") as p:
        p.plate("쌍포신 지지대", (0, .83, -.055), (1.04, .29, .34), "slate", .09)
        p.plate("지지대 체결판", (0, .82, -.205), (.75, .36, .12), "silver", .079)
    with kit.part("detail", "exhaust-blades", "recoil") as p:
        p.plate("후방 방열판 연결대", (0, -1.29, .35), (.80, .84, .42), "slate", .13)
        for y, z in ((-1.27, .68), (-1.66, .60)):
            p.plate("포두 뒤 방열판", (0, y, z), (1.66, .29, .49), "line", .072)
            p.plate("방열판 윗 테", (0, y, z + .25), (1.51, .22, .066), "silver", .064)
        p.plate("틸 계급선", (.74, -1.47, .72), (.136, .65, .17), "teal", .04)
    with kit.part("detail", "ceramic-inductor", "recoil") as p:
        acceleration_ring(p, 1.13, "teal", radius=.83)
    with kit.part("armor", "ceramic-cheeks", "recoil") as p:
        for sign in (-1, 1):
            p.plates("세라믹 옆 장갑", (sign * .81, -.60, 0), [(-.72, .34, 1.45, .12),
                     (-.42, .80, 1.62, .17), (.32, .59, 1.26, .16)], "silver", .038)
            p.plate("장갑 뒷면 맞물림 판", (sign * .84, -1.38, -.15), (.54, .64, .37), "slate", .090)
        p.plates("포두 후방 보강 가대", (0, -1.57, 0), [(-.44, 1.21, .84, .15),
                 (-.22, 1.49, .95, .19), (.28, 1.49, .84, .16), (.51, 1.16, .75, .15)], "line", .04)
        p.plate("가대 뒤 은회 마감", (0, -1.98, .04), (1.22, .18, .53), "silver", .08)
    with kit.part("detail", "tracking-aerial", "yaw") as p:
        p.plate("추적기 후방 거치대", (.36, -.67, .22), (.43, 1.16, .32), "slate", .099)
        p.plates("곧게 선 추적기 마스트", (.36, -1.13, 0), [(.30, .32, .39, .07),
                 (.99, .23, .29, .052), (2.19, .18, .21, .044)], "line", .023)
        p.plates("추적기 표지판", (.36, -1.22, 0), [(1.24, .26, .28, .065),
                 (1.53, .48, .59, .097), (2.20, .35, .52, .080), (2.29, .21, .29, .061)], "silver", .031)
        p.plate("추적기 틸 표식", (.36, -1.49, 1.95), (.21, .09, .35), "teal", .031)
    with kit.part("marking", "crown-inductor", "recoil") as p:
        acceleration_ring(p, 2.31, "amber", radius=.83)
        p.rod("표적 지시등 받침", (.59, -.67, .48), (.59, -.67, .94), .081, "slate")
        p.plate("표적 지시등", (.59, -.67, .95), (.26, .28, .22), "teal", .08)


def cryo_base(kit):
    with kit.part("base", "octagonal-deck") as p:
        p.lathe("팔각 기단", (0, 0, 0), [(0, .88), (.08, 1.07), (.23, 1.07), (.31, .94)], "slate", steps=8)
        p.lathe("기단 윗판", (0, 0, .245), [(0, 1.04), (.09, .93), (.115, .82)], "line", steps=8)
        p.lathe("기둥 아래 그늘", (0, 0, .328), [(0, .53), (.10, .51)], "carbon", steps=10)
    with kit.part("base", "extended-deck") as p:
        p.lathe("기단 확장판", (0, 0, .025), [(0, 1.26), (.12, 1.53), (.23, 1.51), (.33, 1.33)], "slate", steps=12)
        p.lathe("확장판 윗 테", (0, 0, .28), [(0, 1.40), (.09, 1.31), (.13, 1.24)], "line", steps=12)
    with kit.part("base", "ice-louvers") as p:
        for angle in (.42, 2.51, 4.61):
            radial_pod(p, angle, 1.04, .42, (.77, .51, .63), "line", "teal")
    with kit.part("body", "iron-stem") as p:
        p.lathe("얇은 냉각 기둥", (0, 0, .35), [(0, .34), (.16, .30), (.37, .14), (1.24, .14)], "line", steps=8)
        p.lathe("냉각 기둥 하단의 받침", (0, 0, .36), [(0, .43), (.07, .42), (.14, .33)], "slate", steps=8)
    with kit.part("body", "return-lines") as p:
        for angle in (.05, 2.14, 4.24):
            x, y = math.cos(angle), math.sin(angle)
            bend = (.67*x, .67*y, .43)
            p.rod("냉매 수직 파이프", bend, (.67*x, .67*y, 1.13), .12, "silver")
            p.rod("냉매 회수관", (.24*x, .24*y, 1.30), (.67*x, .67*y, 1.13), .105, "line")
            p.rod("냉매 파이프 결합 링", (.67*x, .67*y, .48), (.67*x, .67*y, .61), .17, "slate")
    with kit.part("body", "pressure-foot") as p:
        p.lathe("테이퍼 냉매 몸체", (0, 0, .34), [(0, .65), (.17, .64), (.49, .37), (1.25, .30)], "line", steps=12)
        for angle in (.2, 1.77, 3.34, 4.91):
            radial_pod(p, angle, .50, .58, (.47, .60, .47), "slate", "silver")
    with kit.part("armor", "radiator-fins") as p:
        for angle in (.19, 1.76, 3.33, 4.90):
            x, y = .90 * math.cos(angle), .90 * math.sin(angle)
            p.plates("하부 사방 방열판", (x, y, 0), [(.13, .92, .41, .10), (.42, .93, .34, .10),
                     (1.14, .31, .25, .061)], "silver", .029).rotation_euler.z = angle
    with kit.part("armor", "refrigerant-cans") as p:
        for angle in (.38, 1.95, 3.52, 5.09):
            x, y = .79 * math.cos(angle), .79 * math.sin(angle)
            p.lathe("세라믹 냉매 탱크", (x, y, .31), [(0, .29), (.14, .35), (.88, .35),
                    (1.06, .22), (1.15, .11)], "silver", steps=10)
            p.lathe("탱크 중간 띠", (x, y, .61), [(0, .36), (.11, .36)], "slate", steps=10)
    with kit.part("marking", "gilded-pods") as p:
        for angle in (.42, 2.51, 4.61):
            radial_pod(p, angle, .68, .45, (.55, .45, .48), "line", "amber")
        p.lathe("기단 금테 맞물림 링", (0, 0, .34), [(0, .85), (.10, .85), (.13, .78)], "amber", steps=12)
    with kit.part("base", "nozzle-deck") as p:
        p.lathe("분사대 확장판", (0, 0, .05), [(0, 1.02), (.08, 1.16), (.23, 1.14), (.30, 1.06)], "slate", steps=10)
        for angle in (.22, 2.31, 4.42):
            radial_pod(p, angle, .98, .36, (.65, .48, .31), "line", "amber")


def radial_pod(p, angle, radius, z, size, metal, accent):
    x, y = math.cos(angle), math.sin(angle)
    p.plate("바깥 장착대", (radius*x, radius*y, z), size, metal, .14).rotation_euler.z = angle
    inner = radius + size[0] * .39
    outer = radius + size[0] * .60
    p.rod("장착대 노즐 뒤 그늘", (inner*x, inner*y, z), (outer*x, outer*y, z), .15, "slate")
    p.rod("장착대 노즐 테", (outer*x, outer*y, z), ((outer+.05)*x, (outer+.05)*y, z), .101, accent)


def cryo_head(kit):
    for index, (name, rings) in enumerate(zip(
        ("field-coils", "alloy-coils", "split-coils", "five-stage-coils"), CRYO_BANKS,
    )):
        with kit.part("head", name + "-stem", "yaw") as p:
            width = (.16, .23, .24, .31)[index]
            height = (1.76, 2.56, 2.98, 3.12)[index]
            p.lathe("냉각 코어 기둥", (0, 0, -.06), [(0, width * .80), (.24, width),
                    (height - .21, width), (height, width * .96)], "line", steps=10)
            if index > 0:
                for k in range(6):
                    angle = math.tau * k / 6
                    protrusion = 1.13 if index == 2 else 1
                    x, y = width * protrusion * math.cos(angle), width * protrusion * math.sin(angle)
                    p.plate("코어 세로 방열 핀", (x, y, height * .48), (.123, .09, height - .44),
                            "silver" if index == 2 else "teal", .018).rotation_euler.z = angle
                p.lathe("코어 은회 테", (0, 0, height - .16), [(0, width*1.15), (.11, width*1.17),
                        (.17, width*.98), (.14, width*.79), (0, width*.79)], "silver", steps=10, closed=True)
                p.lathe("테 안쪽 그늘", (0, 0, height - .13), [(0, width*.82), (.02, width*.82)], "carbon", steps=10)
        with kit.part("weapon", name, "rotors") as p:
            for n, (z, r) in enumerate(rings):
                thickness = (.14, .155, .141, .159)[index]
                for obj in (
                    p.lathe("공중 공명 고리", (0, 0, z), [(0, r*.96), (.045, r), (thickness-.038, r),
                            (thickness, r*.956), (thickness, r*.79), (0, r*.79)],
                            "teal", steps=10+2*index, closed=True),
                    p.lathe("공명 고리 안쪽 그늘", (0, 0, z), [(0, r*.805), (.086, r*.805),
                            (.086, r*.76), (0, r*.76)], "slate", steps=10+2*index, closed=True),
                ):
                    obj["ring"] = n
                for k in range(2 if index < 3 else 3):
                    angle = .22 + n * .37 + k * (1.66 if index == 0 else math.tau / 4)
                    x, y = math.cos(angle), math.sin(angle)
                    clip = p.plate("공명 고리 체결쇠", (x*r*.93, y*r*.93, z + thickness*.60),
                                   (.21, .21, thickness+.042), "silver" if k == 0 else "line", .054)
                    clip.rotation_euler.z = angle
                    clip["ring"] = n
    with kit.part("head", "steel-cap", "yaw") as p:
        p.lathe("코어 상단 보호 캡", (0, 0, 1.78), [(0, .20), (.17, .24), (.34, .23), (.42, .15)], "line", steps=8)
        p.plate("코어 캡 표식", (.14, -.09, 2.03), (.18, .21, .09), "teal", .047)
    with kit.part("head", "steel-jacket", "yaw") as p:
        p.lathe("강철 중간 클램프", (0, 0, .64), [(0, .24), (.17, .44), (.34, .42),
                (.46, .25)], "line", steps=8)
        p.plate("클램프 측면 날개", (.29, -.19, .86), (.81, .48, .30), "slate", .091)
    with kit.part("weapon", "ring-sectors", "rotors") as p:
        for n in (0, 2, 3):
            z, r = CRYO_BANKS[1][n]
            for angle in (.24 + n * .21, 2.86 + n * .21):
                x, y = math.cos(angle), math.sin(angle)
                reach = r + .27
                shoe = p.plate("고리의 틸 분할판", (x*reach, y*reach, z + .083), (.72, .45, .24), "teal", .10)
                shoe.rotation_euler.z = angle
                shoe["ring"] = n
    with kit.part("detail", "weather-nozzles", "yaw") as p:
        for angle in (.11, 2.20, 4.30):
            x, y = math.cos(angle), math.sin(angle)
            p.rod("상단 노즐 지지대", (.23*x, .23*y, 2.46), (1.22*x, 1.22*y, 2.89), .116, "slate")
            radial_pod(p, angle, 1.20, 2.93, (.63, .46, .32), "silver", "teal")
    with kit.part("weapon", "crown-nozzles", "rotors") as p:
        for n in (0, 2, 4):
            z, radius = CRYO_BANKS[3][n]
            for side in (0, 1):
                angle = .23 + n * .19 + side * math.pi
                x, y = math.cos(angle), math.sin(angle)
                reach = radius + .071
                nozzle = p.plate("최종 고리 분사 노즐", (reach*x, reach*y, z + .076), (.34, .23, .21), "amber", .070)
                nozzle.rotation_euler.z = angle
                nozzle["ring"] = n
    with kit.part("marking", "frost-crystal", "yaw") as p:
        p.lathe("부유 냉각 결정", (.07, -.07, 3.22), [(0, .014), (.25, .38),
                (.37, .38), (.59, .014)], "teal", steps=4)
        p.lathe("결정 아래 금테 받침", (0, 0, 3.03), [(0, .44), (.10, .47),
                (.14, .42), (.13, .30), (0, .30)], "amber", steps=10, closed=True)


def build_kit(tower_id):
    kit = Kit(tower_id, TITLES[tower_id])
    builders = (rail_base, rail_head, rail_upgrades) if tower_id == "rail" else (cryo_base, cryo_head)
    for build in builders:
        build(kit)
    return kit.scene
