"""곡사 포대의 편집 가능한 부품 컬렉션을 만든다."""

import math
from contextlib import contextmanager

import bpy
from mathutils import Vector


SLOTS = ("base", "body", "armor", "head", "weapon", "detail", "marking")


class Kit:
    def __init__(self):
        self.scene = bpy.data.scenes.new("곡사 포대 · 부품")
        self.groups = {}
        for slot in SLOTS:
            group = bpy.data.collections.new(slot)
            self.scene.collection.children.link(group)
            self.groups[slot] = group

    @contextmanager
    def part(self, slot, name, mount="ground"):
        part = bpy.data.collections.new(f"mortar/{name}")
        part["mount"] = mount
        self.groups[slot].children.link(part)
        yield Part(part)


def corners(width, depth, cut):
    x, y = width / 2, depth / 2
    return [(-x + cut, -y), (x - cut, -y), (x, -y + cut), (x, y - cut),
            (x - cut, y), (-x + cut, y), (-x, y - cut), (-x, -y + cut)]


class Part:
    def __init__(self, collection):
        self.collection = collection

    def mesh(self, name, rings, color, center=(0, 0, 0), bevel=0, closed=False):
        sides = len(rings[0])
        vertices = [vertex for ring in rings for vertex in ring]
        faces = []
        band_count = len(rings) if closed else len(rings) - 1
        for band in range(band_count):
            bottom, top = band * sides, ((band + 1) % len(rings)) * sides
            for i in range(sides):
                j = (i + 1) % sides
                faces.append((bottom + i, bottom + j, top + j, top + i))
        if not closed:
            faces.extend((tuple(reversed(range(sides))), tuple(range(len(vertices) - sides, len(vertices)))))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        self.collection.objects.link(obj)
        obj.location = center
        obj["color"] = color
        if bevel:
            modifier = obj.modifiers.new("모서리 면", "BEVEL")
            modifier.width = bevel
            modifier.segments = 1
        return obj

    def plates(self, name, center, sections, color, bevel=0):
        rings = [[(x, y, z) for x, y in corners(w, d, cut)] for z, w, d, cut in sections]
        if bevel:
            narrowest_corner = min(cut for _, _, _, cut in sections)
            shortest_band = min(top[0] - bottom[0] for bottom, top in zip(sections, sections[1:]))
            bevel = min(bevel, narrowest_corner * .28, shortest_band * .24)
        return self.mesh(name, rings, color, center, bevel)

    def plate(self, name, center, size, color, cut=0.07, bevel=0.02):
        w, d, h = size
        cut = min(cut, w * .30, d * .30)
        return self.plates(name, center, [(-h / 2, w, d, cut), (h / 2, w, d, cut)], color, bevel)

    def lathe(self, name, center, profile, color, *, steps=12, closed=False, forward=False):
        rings = [[(r * math.cos(i * math.tau / steps), r * math.sin(i * math.tau / steps), h)
                  for i in range(steps)] for h, r in profile]
        obj = self.mesh(name, rings, color, center, closed=closed)
        if forward:
            obj.rotation_euler.x = -math.pi / 2
        return obj

    def rod(self, name, a, b, radius, color, *, steps=10):
        axis = Vector(b) - Vector(a)
        obj = self.lathe(name, a, [(0, radius * .84), (min(.055, axis.length / 4), radius),
                                   (axis.length - min(.055, axis.length / 4), radius),
                                   (axis.length, radius * .84)], color, steps=steps)
        obj.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
        return obj

    def muzzle(self, center, radius, metal, rim, depth=.24, sides=12):
        outer = [(0, radius * .94), (.06, radius), (depth - .04, radius),
                 (depth, radius * .90), (depth, radius * .72), (.075, radius * .72)]
        self.lathe("포구 외벽", center, outer, metal, steps=sides, closed=True, forward=True)
        x, y, z = center
        self.lathe("포구 테", (x, y + depth - .035, z),
                   [(0, radius * .985), (.040, radius * .94), (.047, radius * .82),
                    (.041, radius * .73), (0, radius * .73)],
                   rim, steps=sides, closed=True, forward=True)
        self.lathe("포구 안쪽", (x, y + .050, z), [(0, radius * .735), (.03, radius * .735)],
                   "carbon", steps=sides, forward=True)


def deck(kit):
    with kit.part("base", "platform") as p:
        p.plates("사각 포상", (0, 0, 0), [(0, 4.3, 3.98, .49), (.09, 4.48, 4.16, .49),
                 (.28, 4.48, 4.16, .49), (.39, 4.28, 3.95, .43)], "slate", .024)
        p.plates("갑판 테두리", (0, 0, 0), [(.13, 4.50, 4.18, .49), (.19, 4.50, 4.18, .49)],
                 "line", .008)
        p.plate("갑판 이음선", (0, 0, .402), (3.99, 3.66, .04), "carbon", .41)
        p.plate("갑판 윗판", (0, 0, .434), (3.91, 3.58, .07), "line", .39)
        for x in (-1.92, 1.92):
            for y in (-1.72, 1.72):
                p.plate("모서리 접지판", (x, y, .43), (.43, .37, .085), "slate")
    with kit.part("base", "corner-anchors") as p:
        for x in (-1.92, 1.92):
            for y in (-1.72, 1.72):
                p.plate("앵커 덮개", (x, y, .50), (.41, .34, .16), "silver", .095, .023)
                p.plate("앵커 홈", (x, y, .585), (.15, .07, .027), "carbon", .02)
    with kit.part("base", "anchor-feet") as p:
        for index in range(4):
            angle = math.pi / 4 + index * math.pi / 2
            along = Vector((math.cos(angle), math.sin(angle), 0))
            center = along * 2.91
            p.plate("외곽 고정발", (*center.xy, .12), (.79, .88, .23), "slate", .16).rotation_euler.z = angle
            p.plate("고정발 상판", (*center.xy, .25), (.71, .81, .09), "line", .16).rotation_euler.z = angle
            # 포상과 발 사이 쐐기 각이 48px에서도 읽힌다.
            joint = along * 2.57
            brace = p.plates("고정발 쐐기", (*joint.xy, 0),
                             [(.25, .90, .53, .12), (.77, .31, .49, .09)], "surface", .026)
            brace.rotation_euler.z = angle
            brace = p.rod("고정발 체결 핀", (*center.xy, .28), (*center.xy, .34), .11, "silver", steps=6)
            brace.rotation_euler.z = angle


def core(kit):
    for name, width, heights in (("steel-core", 2.30, (.45, .58, 1.14, 1.26)),
                                 ("ceramic-core", 2.74, (.45, .63, 1.11, 1.26)),
                                 ("fortress-core", 3.07, (.45, .56, 1.09, 1.26))):
        with kit.part("body", name) as p:
            p.plates("포상 코어", (0, 0, 0),
                     [(z, width * scale, width * scale * .87, .28)
                      for z, scale in zip(heights, (1, 1, .84, .81))], "surface", .047)
            p.plates("상부 회전 레일", (0, 0, 0), [(1.20, 2.04, 1.89, .25),
                     (1.29, 2.04, 1.89, .25)], "slate", .026)
            for sign in (-1, 1):
                p.plate("구동부 패널 홈", (sign * width * .46, 0, .80), (.12, 1.20, .34), "carbon")
                p.plate("구동부 패널", (sign * width * .48, 0, .80), (.11, 1.06, .26), "slate", .05)
                for y in (-.28, 0, .28):
                    p.plate("환기 구멍", (sign * width * .505, y, .82), (.06, .08, .13), "line", .02)
    with kit.part("body", "hydraulic-legs") as p:
        for sx in (-1, 1):
            for sy in (-1, 1):
                a = Vector((sx * 1.50, sy * 1.42, .61))
                b = Vector((sx * .88, sy * .71, 1.32))
                p.plate("유압발", (a.x, a.y, .54), (.62, .58, .18), "slate", .13, .025)
                p.plate("유압발 상판", (a.x, a.y, .637), (.54, .48, .10), "line", .105, .022)
                p.rod("실린더 하우징", a, a.lerp(b, .59), .163, "slate")
                p.rod("피스톤", a.lerp(b, .53), b, .101, "silver")
                p.rod("고정 핀", b + Vector((-.12, 0, 0)), b + Vector((.12, 0, 0)), .145, "line")
    with kit.part("body", "rear-dampers") as p:
        for x in (-.62, .62):
            a, b = Vector((x * 1.36, 1.53, .53)), Vector((x, 1.19, 1.27))
            p.rod("후방 완충기 받침", a, a.lerp(b, .69), .134, "slate")
            p.rod("후방 완충기 피스톤", a.lerp(b, .62), b, .075, "silver")
            p.plate("후방 완충기 체결판", (a.x, a.y, .53), (.34, .33, .14), "line")


def armor(kit):
    with kit.part("armor", "earth-shield") as p:
        p.plates("경사 흙받이 방패", (0, -1.62, 0), [(.38, 1.95, .53, .13),
                 (.60, 2.16, .49, .15), (1.10, 2.27, .22, .07)], "surface", .038)
        p.plate("방패 아래 가로대", (0, -1.885, .57), (1.92, .13, .12), "slate", .05)
        p.plates("방패 중앙 보강판", (0, -1.87, 0), [(.43, .73, .18, .065),
                 (.84, .57, .11, .042)], "silver", .014)
        for x, angle in ((-1.02, -.30), (1.02, .30)):
            flank = p.plates("방패 경사 날개", (x, -1.69, 0), [(.53, .41, .35, .065),
                             (.66, .48, .33, .065), (1.15, .39, .17, .050)], "line", .025)
            flank.rotation_euler.z = angle
            p.plate("방패 이음쇠", (x * .80, -1.81, .81), (.095, .19, .34), "slate", .02)
    with kit.part("armor", "side-skirt") as p:
        for i in range(4):
            angle = i * math.pi / 2
            for name, sections, color in (
                ("스커트 강판", [(.28, 2.63, .49, .14), (.40, 2.80, .48, .14), (.74, 2.51, .25, .09)], "surface"),
                ("스커트 밑단", [(.25, 2.67, .50, .14), (.31, 2.67, .50, .14)], "slate"),
            ):
                panel = p.plates(name, (1.91 * math.sin(angle), -1.91 * math.cos(angle), 0),
                                 sections, color, .027)
                panel.rotation_euler.z = angle
    with kit.part("armor", "turret-cover", "elevation") as p:
        p.plates("포두 장갑 덮개", (0, -.54, 0), [(.59, 2.07, 1.16, .16),
                 (.76, 2.24, 1.21, .18), (.90, 1.80, 1.06, .20)], "silver", .025)
        p.plate("덮개 잠금판", (0, -.57, .903), (.59, .52, .05), "slate", .095, .016)
        p.plate("덮개 잠금턱", (0, -.39, .933), (.39, .12, .05), "line", .034, .011)
    with kit.part("armor", "bunker-lips") as p:
        for index in range(2):
            p.plates("이중 벙커 립", (0, -2.13 + index * .26, index * .23),
                     [(.18, 2.80, .39, .16), (.34, 2.93, .40, .17), (.44, 2.51, .29, .11)],
                     "surface", .034)
        p.plate("벙커 립 중앙판", (0, -2.31, .36), (.80, .13, .29), "slate", .09, .023)


def supports(kit):
    for name, radius, metal in (("steel-turntable", .91, "line"),
                                 ("alloy-turntable", 1.04, "silver"),
                                 ("fortress-turntable", 1.15, "amber")):
        with kit.part("head", name, "yaw") as p:
            p.lathe("하부 회전판", (0, 0, .012), [(0, radius - .06), (.07, radius), (.14, radius)],
                    "slate", steps=16)
            p.lathe("회전판 테", (0, 0, .135), [(0, radius), (.07, radius), (.12, radius - .08)],
                    metal, steps=16)
            p.lathe("회전판 상부", (0, 0, .245), [(0, radius - .08), (.08, radius - .15)],
                    "slate", steps=16)
    for name, offset, width in (("field-yoke", .63, .31), ("heavy-yoke", .79, .37),
                                ("twin-yoke", .91, .34), ("quad-yoke", 1.11, .35)):
        with kit.part("head", name, "yaw") as p:
            for x in (-offset, offset):
                p.plates("포신 체결 가대", (x, -.08, 0), [(.16, width + .14, 1.27, .09),
                         (.35, width + .09, 1.05, .13), (.80, width, .62, .13)], "surface", .042)
                sign = 1 if x > 0 else -1
                p.rod("가대 회전축", (x, 0, .66), (x + sign * .27, 0, .66), .246, "slate")
                p.rod("가대 회전축 마개", (x + sign * .24, 0, .66), (x + sign * .32, 0, .66),
                      .177, "line", steps=8)


def armament(kit):
    with kit.part("weapon", "single-barrel", "recoil") as p:
        p.lathe("단포신", (0, 0, 0), [(-.84, .36), (-.69, .47), (-.23, .49), (.22, .43),
                (1.07, .39), (1.19, .43)], "line", forward=True, steps=10)
        p.lathe("포미 장착판", (0, -.64, 0), [(0, .48), (.12, .51), (.20, .47)],
                "slate", forward=True, steps=10)
        p.muzzle((0, 1.13, 0), .56, "line", "silver", .29, 10)
    with kit.part("weapon", "steel-band", "recoil") as p:
        p.lathe("강철 보강 띠", (0, .68, 0), [(0, .414), (.06, .49), (.21, .49), (.27, .41)],
                "silver", forward=True, steps=10)
    with kit.part("weapon", "heavy-barrel", "recoil") as p:
        p.lathe("중장갑 단포신", (0, 0, 0), [(-1.00, .39), (-.88, .58), (-.33, .62),
                (-.19, .54), (.56, .51), (.86, .46), (1.20, .50)], "slate", forward=True)
        for y, radius in ((-.56, .65), (.49, .57)):
            p.lathe("포신 장갑 고리", (0, y, 0), [(0, radius * .93), (.09, radius),
                    (.19, radius), (.23, radius * .93)], "line", forward=True)
        for x in (-.65, .65):
            p.rod("두꺼운 유압 완충기", (x, -.90, -.19), (x, .23, -.19), .169, "slate")
            p.rod("유압 완충기 피스톤", (x, .19, -.19), (x, .62, -.19), .095, "silver")
            p.plate("유압 완충기 안장", (x, -.28, -.13), (.43, .34, .41), "line", .06, .027)
        p.muzzle((0, 1.16, 0), .65, "slate", "line", .29)
    with kit.part("weapon", "twin-barrels", "recoil") as p:
        for x in (-.57, .57):
            p.plates("세라믹 포신 하우징", (x, -.29, 0), [(-.51, 1.03, 1.66, .17),
                     (-.34, 1.12, 1.81, .14), (.32, 1.04, 1.66, .15), (.60, .79, 1.32, .16)],
                     "silver", .041)
            p.plate("세라믹 이음선", (x, -.36, .605), (.38, .96, .045), "slate", .085, .012)
            p.plate("틸 포신 표식", (x, -.36, .631), (.24, .78, .024), "teal", .075, .008)
            p.lathe("쌍포신", (x, .26, -.045), [(0, .345), (.13, .36), (.58, .27), (.87, .274)],
                    "line", forward=True)
            p.muzzle((x, 1.09, -.045), .329, "line", "silver", .24)
    with kit.part("weapon", "quad-box", "recoil") as p:
        for x in (-.64, .64):
            p.plates("다연장 박스 장갑", (x, -.28, 0), [(-.84, 1.10, 1.94, .13),
                     (-.66, 1.23, 2.26, .15), (.62, 1.23, 2.22, .16), (.80, 1.01, 2.01, .17)],
                     "line", .042)
            for y in (-1.15, .67):
                frame = p.plate("박스 금테 모따기", (x, y, 0), (1.25, 1.59, .135), "amber", .18, .035)
                frame.rotation_euler.x = -math.pi / 2
            inset = p.plate("박스 포구판", (x, .755, 0), (1.07, 1.41, .13), "slate", .165, .028)
            inset.rotation_euler.x = -math.pi / 2
            p.plate("박스 냉각 패널", (x, -.36, .807), (.64, 1.13, .054), "slate", .11, .015)
            p.plate("박스 냉각 패널 안쪽", (x, -.36, .834), (.47, .93, .029), "line", .08, .010)
            for z in (-.399, .399):
                p.muzzle((x, .79, z), .32, "line", "silver", .33)
    with kit.part("weapon", "gilded-muzzles", "recoil") as p:
        for x in (-.64, .64):
            for z in (-.399, .399):
                p.lathe("금테 포구 마감", (x, 1.09, z), [(0, .323), (.055, .317), (.07, .27),
                        (.055, .247), (0, .247)], "amber", closed=True, forward=True)


def accessories(kit):
    with kit.part("detail", "ammo-crate") as p:
        p.plate("후면 적재 상자", (-.05, 1.58, .73), (1.35, .69, .67), "slate", .11, .038)
        p.plate("적재 상자 뚜껑", (-.05, 1.58, 1.085), (1.42, .74, .13), "line", .12, .03)
        for x in (-.45, .35):
            p.plate("상자 체결띠", (x, 1.58, 1.158), (.14, .65, .05), "silver", .028, .011)
    with kit.part("detail", "feed-chutes") as p:
        for sign in (-1, 1):
            x = sign * 1.51
            p.plates("탄약 공급 슈트", (x, .48, 0), [(.54, .49, .94, .09), (.80, .57, 1.08, .12),
                     (1.11, .42, .81, .11)], "line", .035)
            p.plate("공급 슈트 개구", (x, .47, 1.116), (.28, .60, .046), "carbon", .07, .012)
            for y in (.22, .43, .64):
                p.plate("탄약 트레이 가로대", (x, y, 1.155), (.29, .07, .06), "silver", .017, .01)
    with kit.part("detail", "loader-arm") as p:
        a, b, c = (1.16, 1.44, 1.00), (1.27, 1.66, 1.78), (.94, 1.23, 2.03)
        p.plate("자동 장전 암 받침", (1.16, 1.44, 1.06), (.54, .42, .26), "slate", .10, .027)
        p.rod("자동 장전 암 하부", a, b, .155, "line", steps=8)
        p.rod("자동 장전 암 상부", b, c, .122, "silver", steps=8)
        p.rod("장전 암 관절", (1.10, 1.66, 1.78), (1.44, 1.66, 1.78), .184, "slate")
        for x in (.85, 1.03):
            p.rod("장전 암 집게", (x, 1.23, 2.03), (x, .99, 1.86), .058, "line", steps=6)
    with kit.part("detail", "ballistics-dome", "yaw") as p:
        p.plates("탄도 돔 받침 하우징", (.06, -.92, 0), [(.31, 1.62, 1.15, .16),
                 (.89, 1.46, 1.13, .14), (1.31, 1.21, 1.02, .14)], "slate", .043)
        p.lathe("돔 아래 테두리", (.06, -.94, 1.23), [(0, .60), (.09, .60), (.17, .55)],
                "line", steps=16)
        p.lathe("돔 사이 이음선", (.06, -.94, 1.40), [(0, .55), (.035, .545)],
                "carbon", steps=16)
        p.lathe("탄도 연산 돔", (.06, -.94, 1.435), [(0, .52), (.12, .505), (.29, .40),
                 (.41, .26), (.46, .09)], "line", steps=16)
        p.plate("돔 센서", (.40, -1.31, 1.54), (.23, .10, .082), "silver", .027).rotation_euler.z = .44
    with kit.part("marking", "hazard-band", "recoil") as p:
        p.lathe("앰버 포구 경고 띠", (0, .96, 0), [(0, .494), (.04, .515), (.135, .515), (.16, .499)],
                "amber", forward=True)
        for i in range(6):
            angle = i * math.tau / 6 + math.pi / 12
            tick = p.plate("경고 띠 검은 사선", (.514 * math.cos(angle), 1.039, .514 * math.sin(angle)),
                           (.06, .14, .049), "carbon", .012, .005)
            tick.rotation_euler.y = -angle + .31
    with kit.part("marking", "ceramic-stripes") as p:
        for sign in (-1, 1):
            p.plate("틸 포상 표식", (sign * 1.344, -.65, .79), (.07, .36, .12), "teal", .033, .012)
    with kit.part("marking", "pressure-gauge") as p:
        for sign in (-1, 1):
            x = sign * 1.51
            p.rod("압력 게이지 베젤", (x, -.47, .90), (sign * 1.65, -.47, .90), .166, "slate")
            p.rod("압력 게이지 색판", (sign * 1.63, -.47, .90), (sign * 1.67, -.47, .90), .117, "teal")
            p.plate("압력 게이지 바늘", (sign * 1.677, -.45, .92), (.022, .10, .024),
                    "amber", .009, .006).rotation_euler.x = .55
    with kit.part("marking", "fortress-trim") as p:
        p.plates("요새 포상 금테", (0, 0, 0), [(.57, 3.10, 2.72, .28),
                 (.69, 3.09, 2.71, .28)], "amber", .017)
        p.plates("요새 포상 위 모따기", (0, 0, 0), [(1.09, 2.67, 2.34, .27),
                 (1.17, 2.58, 2.27, .27)], "amber", .016)
        for x in (-1.21, 1.21):
            p.plates("요새 하우징 앞 접합부", (x, -1.55, 0), [(.58, .52, .36, .06),
                     (1.04, .36, .27, .064)], "amber", .021)
            p.plates("접합부 안쪽 강판", (x, -1.72, 0), [(.63, .34, .13, .036),
                     (.96, .24, .11, .040)], "line", .014)


def build_kit():
    kit = Kit()
    for build in (deck, core, armor, supports, armament, accessories):
        build(kit)
    return kit.scene
