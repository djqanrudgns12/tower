"""곡사 포대의 편집 가능한 부품 컬렉션을 만든다."""

import math
from contextlib import contextmanager

import bpy
from mathutils import Vector


SLOTS = ("base", "body", "armor", "head", "weapon", "detail", "marking")
YAW_HEIGHTS = {"steel": 1.52, "alloy": 1.52, "ceramic": 1.83, "gold-trim": 1.93}


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
        self.lathe("포구 테", (x, y + depth - .045, z),
                   [(0, radius * .998), (.051, radius * .95), (.064, radius * .77),
                    (.053, radius * .69), (0, radius * .69)],
                   rim, steps=sides, closed=True, forward=True)
        self.lathe("포구 안쪽", (x, y + .050, z), [(0, radius * .735), (.03, radius * .735)],
                   "carbon", steps=sides, forward=True)


def deck(kit):
    with kit.part("base", "platform") as p:
        p.plates("사각 포상", (0, 0, 0), [(0, 3.58, 3.34, .45), (.07, 3.72, 3.48, .46),
                 (.21, 3.72, 3.48, .46), (.29, 3.58, 3.34, .43)], "slate", .022)
        p.plates("갑판 테두리", (0, 0, 0), [(.13, 3.74, 3.50, .46), (.18, 3.74, 3.50, .46)],
                 "line", .008)
        p.plate("갑판 이음선", (0, 0, .305), (3.28, 3.04, .05), "carbon", .36)
        p.plate("갑판 윗판", (0, 0, .345), (3.20, 2.96, .07), "line", .35)
    with kit.part("base", "corner-anchors") as p:
        for x in (-1.79, 1.79):
            for y in (-1.59, 1.59):
                p.plate("앵커 발판", (x, y, .25), (.83, .74, .30), "slate", .15)
                p.plates("앵커 덮개", (x, y, 0), [(.365, .72, .61, .12), (.79, .46, .39, .09)],
                         "line", .02)
                p.plate("앵커 체결판", (x, y, .81), (.34, .24, .05), "silver", .045)
    with kit.part("base", "anchor-feet") as p:
        for index in range(4):
            angle = math.pi / 4 + index * math.pi / 2
            along = Vector((math.cos(angle), math.sin(angle), 0))
            center = along * 2.48
            p.plate("외곽 고정발", (*center.xy, .15), (1.06, .80, .24), "slate", .16).rotation_euler.z = angle
            p.plate("고정발 상판", (*center.xy, .28), (.98, .72, .09), "line", .16).rotation_euler.z = angle
            joint = along * 2.15
            brace = p.plates("고정발 쐐기", (*joint.xy, 0),
                             [(.29, 1.19, .66, .12), (.96, .53, .56, .09)], "surface", .026)
            brace.rotation_euler.z = angle
            brace = p.rod("고정발 체결 핀", (*center.xy, .28), (*center.xy, .34), .11, "silver", steps=6)
            brace.rotation_euler.z = angle


def core(kit):
    with kit.part("body", "steel-core") as p:
        p.plates("포상 코어", (0, 0, 0), [(.35, 2.49, 2.22, .29), (.52, 2.55, 2.27, .30),
                 (.67, 2.29, 2.05, .28), (1.39, 1.72, 1.68, .28), (1.52, 1.94, 1.79, .25)],
                 "surface", .04)
        p.plates("회전 레일 아래 이음선", (0, 0, 0),
                 [(1.39, 1.79, 1.75, .24), (1.48, 1.93, 1.83, .24)], "slate", .015)
        for sign in (-1, 1):
            p.plate("구동부 패널 홈", (sign * 1.02, 0, .91), (.25, 1.10, .33), "carbon")
            p.plate("구동부 패널", (sign * 1.16, 0, .91), (.11, .98, .23), "slate", .05)
    with kit.part("body", "hydraulic-legs") as p:
        for sx in (-1, 1):
            for sy in (-1, 1):
                a = Vector((sx * 1.24, sy * 1.18, .49))
                b = Vector((sx * .80, sy * .65, 1.60))
                p.plate("유압발", (a.x, a.y, .40), (.62, .58, .18), "slate", .13, .025)
                p.plate("유압발 상판", (a.x, a.y, .497), (.54, .48, .10), "line", .105, .022)
                p.rod("실린더 하우징", a, a.lerp(b, .59), .163, "slate")
                p.rod("피스톤", a.lerp(b, .53), b, .101, "silver")
                p.rod("고정 핀", b + Vector((-.12, 0, 0)), b + Vector((.12, 0, 0)), .145, "line")
    with kit.part("body", "rear-dampers") as p:
        p.plate("완충기 받침 가로대", (0, 2.00, .46), (3.22, .62, .39), "slate", .19)
        for x in (-1.42, 1.42):
            a, b = Vector((x * 1.11, 2.06, .47)), Vector((x * 1.32, 2.36, 2.64))
            p.rod("후방 완충기 하우징", a, a.lerp(b, .73), .34, "line")
            p.rod("후방 완충기 피스톤", a.lerp(b, .71), b, .19, "silver")
            p.rod("완충기 상단 마개", b + Vector((0, 0, -.17)), b + Vector((0, 0, .13)), .30, "slate")
            p.plate("후방 완충기 체결판", (a.x, a.y, .49), (.74, .71, .24), "line")
            p.rod("완충기 연결대", (x, 1.04, .96), (a.x, a.y, .63), .16, "slate")

    for name, material, width, depth, trim in (
        ("ceramic-core", "ceramic", 3.17, 2.96, "line"),
        ("fortress-core", "gold-trim", 3.32, 3.09, "amber"),
    ):
        with kit.part("body", name) as p:
            top = YAW_HEIGHTS[material]
            p.plates("장갑 하우징", (0, 0, 0), [(.29, width - .13, depth - .12, .31),
                     (.50, width, depth, .32), (1.30, width - .22, depth - .18, .31),
                     (top - .19, width - .59, depth - .55, .26),
                     (top, width - .62, depth - .59, .24)], "surface", .044)
            p.plates("하단 장갑 테두리", (0, 0, 0), [(.41, width + .02, depth + .02, .32),
                     (.52, width + .035, depth + .03, .32)], trim, .02)
            p.plates("상단 장갑 테두리", (0, 0, 0),
                     [(top - .24, width - .48, depth - .44, .26),
                      (top - .13, width - .49, depth - .45, .26)], trim, .019)
            p.plates("회전판 아래 그늘", (0, 0, 0),
                     [(top - .051, 2.42, 2.27, .23), (top + .028, 2.42, 2.27, .23)], "carbon", .014)

    with kit.part("body", "bunker-core") as p:
        top = YAW_HEIGHTS["gold-trim"]
        p.plates("벙커 장갑 하우징", (0, 0, 0), [(.25, 3.18, 2.99, .37), (.46, 3.19, 3.00, .37),
                 (1.44, 2.93, 2.78, .34), (top, 2.60, 2.51, .30)], "line", .04)
        p.plates("벙커 밑단 이음선", (0, 0, 0), [(.35, 3.23, 3.04, .38),
                 (.47, 3.23, 3.04, .38)], "slate", .02)
        p.plates("벙커 회전판 아래 그늘", (0, 0, 0), [(top - .06, 2.63, 2.54, .30),
                 (top + .02, 2.57, 2.48, .29)], "carbon", .014)


def armor(kit):
    with kit.part("armor", "earth-shield") as p:
        p.plates("경사 흙받이 방패", (0, -1.57, 0), [(.28, 1.89, .63, .13),
                 (.57, 2.36, .57, .15), (1.67, 2.69, .25, .09)], "surface", .038)
        p.plate("방패 아래 가로대", (0, -1.815, .44), (1.93, .13, .12), "slate", .05)
        p.plates("방패 중앙 보강판", (0, -1.78, 0), [(.36, .86, .22, .065),
                 (.92, .61, .15, .042)], "silver", .014)
        for x, angle in ((-1.26, -.30), (1.26, .30)):
            flank = p.plates("방패 경사 날개", (x, -1.56, 0), [(.40, .49, .61, .085),
                             (.71, .65, .56, .09), (1.92, .49, .24, .073)], "line", .025)
            flank.rotation_euler.z = angle
            p.plate("방패 이음쇠", (x * .83, -1.76, .95), (.11, .19, .56), "slate", .02)
    with kit.part("armor", "side-skirt") as p:
        for i in range(4):
            angle = i * math.pi / 2
            for name, sections, color in (
                ("스커트 강판", [(.26, 2.62, .77, .15), (.44, 2.84, .71, .15), (.98, 2.39, .42, .10)], "surface"),
                ("스커트 밑단", [(.19, 2.69, .80, .15), (.29, 2.69, .80, .15)], "slate"),
            ):
                panel = p.plates(name, (2.04 * math.sin(angle), -2.04 * math.cos(angle), 0),
                                 sections, color, .027)
                panel.rotation_euler.z = angle
    with kit.part("armor", "turret-cover", "recoil") as p:
        p.plates("포두 장갑 덮개", (0, -.74, 0), [(.56, 2.31, 1.09, .16),
                 (.74, 2.62, 1.25, .16), (1.03, 2.30, 1.01, .21), (1.09, 1.86, .80, .17)],
                 "silver", .028)
        p.plate("덮개 아래 이음선", (0, -.89, .74), (2.64, .90, .068), "slate", .14, .015)
        p.plate("덮개 잠금판", (0, -.76, 1.095), (.68, .53, .07), "slate", .09, .015)
    with kit.part("armor", "housing-braces") as p:
        for index in range(4):
            angle = index * math.pi / 2
            center = (1.55 * math.sin(angle), -1.55 * math.cos(angle), 0)
            brace = p.plates("세라믹 하우징 받침턱", center, [(.31, .66, .62, .11),
                             (.53, .68, .61, .10), (1.15, .52, .43, .10)], "silver", .024)
            brace.rotation_euler.z = angle
            inset = p.plate("받침턱 아래 이음선", (*center[:2], .38), (.70, .65, .09), "slate", .10)
            inset.rotation_euler.z = angle
    with kit.part("armor", "bunker-lips") as p:
        for index in range(4):
            angle = index * math.pi / 2
            outward = Vector((math.sin(angle), -math.cos(angle), 0))
            toe = outward * 2.09
            foot = p.plate("벙커 스커트 발판", (*toe.xy, .14), (1.35, 1.21, .26), "slate", .19)
            foot.rotation_euler.z = angle
            rings = [[(x, y - offset, z) for x, y in corners(w, d, cut)]
                     for z, w, d, cut, offset in ((.25, 1.26, 1.28, .16, 2.02),
                     (.43, 1.20, 1.24, .15, 1.93), (1.32, .85, .65, .13, 1.46))]
            skirt = p.mesh("벙커 스커트 경사 장갑", rings, "line", bevel=.034)
            skirt.rotation_euler.z = angle
            tread = p.plate("스커트 밑단 테두리", (*toe.xy, .30), (1.25, 1.12, .08), "line", .16)
            tread.rotation_euler.z = angle
            seam = outward * 1.61
            join = p.plate("스커트 상단 이음선", (*seam.xy, 1.30), (.91, .52, .12), "slate", .09)
            join.rotation_euler.z = angle


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
        p.lathe("단포신", (0, 0, 0), [(-.93, .41), (-.76, .55), (-.20, .55), (.25, .46),
                (1.07, .43), (1.19, .49)], "line", forward=True, steps=10)
        p.lathe("포미 장착판", (0, -.64, 0), [(0, .48), (.12, .51), (.20, .47)],
                "slate", forward=True, steps=10)
        p.muzzle((0, 1.13, 0), .61, "line", "silver", .29, 10)
    with kit.part("weapon", "steel-band", "recoil") as p:
        p.lathe("강철 보강 띠", (0, .62, 0), [(0, .46), (.07, .67), (.28, .67), (.36, .46)],
                "silver", forward=True, steps=10)
    with kit.part("weapon", "heavy-barrel", "recoil") as p:
        p.lathe("중장갑 단포신", (0, 0, 0), [(-1.12, .41), (-.96, .70), (-.30, .72),
                (-.07, .61), (.62, .59), (1.17, .58), (1.45, .62)], "slate", forward=True)
        for y, radius in ((-.65, .765), (.43, .67)):
            p.lathe("포신 장갑 고리", (0, y, 0), [(0, radius * .93), (.09, radius),
                    (.19, radius), (.23, radius * .93)], "line", forward=True)
        for x in (-.65, .65):
            p.rod("두꺼운 유압 완충기", (x, -.90, -.19), (x, .23, -.19), .169, "slate")
            p.rod("유압 완충기 피스톤", (x, .19, -.19), (x, .62, -.19), .095, "silver")
            p.plate("유압 완충기 안장", (x, -.28, -.13), (.43, .34, .41), "line", .06, .027)
        p.muzzle((0, 1.39, 0), .83, "line", "silver", .32)
    with kit.part("weapon", "twin-barrels", "recoil") as p:
        for x in (-.66, .66):
            p.plates("세라믹 포신 하우징", (x, -.26, 0), [(-.66, 1.06, 1.58, .20),
                     (-.47, 1.23, 2.02, .14), (.37, 1.21, 1.93, .16), (.79, .92, 1.39, .19)],
                     "silver", .038)
            p.plate("세라믹 이음선", (x, -.35, .775), (.47, .98, .045), "slate", .085, .012)
            p.plate("틸 포신 표식", (x, -.35, .801), (.33, .85, .032), "teal", .075, .008)
            side = x + math.copysign(.595, x)
            p.plates("하우징 측면 이음선", (side, -.36, 0), [(-.45, .055, 1.12, .012),
                     (.10, .069, 1.29, .015), (.18, .051, .91, .012)], "line", .01)
            p.plates("틸 측면 장갑 표식", (side, -.45, 0), [(-.31, .075, .99, .016),
                     (.12, .077, 1.09, .016), (.18, .059, .80, .014)], "teal", .01)
            p.lathe("쌍포신", (x, .56, .02), [(0, .345), (.13, .36), (.57, .28), (.72, .29)],
                    "line", forward=True)
            p.muzzle((x, 1.20, .02), .35, "line", "silver", .27)
    with kit.part("weapon", "quad-box", "recoil") as p:
        for x in (-.71, .71):
            p.plates("다연장 박스 장갑", (x, -.24, 0), [(-.84, 1.08, 1.93, .15),
                     (-.64, 1.34, 2.24, .15), (.74, 1.34, 2.24, .16), (.94, 1.04, 2.01, .17)],
                     "line", .043)
            for y in (-1.20, .75):
                frame = p.plate("박스 금테 모따기", (x, y, .035), (1.38, 1.76, .25),
                                "amber", .19, .045)
                frame.rotation_euler.x = -math.pi / 2
            inset = p.plate("박스 포구판", (x, .884, .035), (1.115, 1.48, .10), "slate", .156, .025)
            inset.rotation_euler.x = -math.pi / 2
            p.plate("박스 냉각 패널", (x, -.30, .951), (.71, 1.13, .063), "slate", .11, .015)
            p.plate("박스 냉각 패널 안쪽", (x, -.30, .980), (.55, .94, .039), "line", .08, .010)
            side = x + math.copysign(.665, x)
            p.plates("박스 측면 접합부", (side, -.53, 0), [(-.53, .066, .53, .021),
                     (-.36, .086, .67, .023), (.35, .086, .68, .023)], "slate", .01)
            p.plates("박스 측면 금테 패널", (side, -.51, 0), [(-.40, .102, .45, .019),
                     (.24, .104, .47, .018)], "amber", .01)
            for z in (-.38, .45):
                p.muzzle((x, .92, z), .36, "line", "silver", .34)
    with kit.part("weapon", "gilded-muzzles", "recoil") as p:
        for x in (-.71, .71):
            for z in (-.38, .45):
                p.lathe("금테 포구 마감", (x, 1.17, z), [(0, .364), (.064, .364), (.093, .347),
                        (.087, .285), (0, .285)], "amber", closed=True, forward=True)


def accessories(kit):
    with kit.part("detail", "ammo-crate") as p:
        p.plate("후면 적재 상자", (.30, 1.51, 1.02), (1.78, .84, 1.29), "slate", .11, .038)
        p.plate("적재 상자 뚜껑", (.30, 1.51, 1.69), (1.87, .91, .19), "line", .12, .03)
        for x in (-.26, .86):
            p.plate("상자 체결띠", (x, 1.51, 1.79), (.17, .80, .05), "silver", .028, .011)
    with kit.part("detail", "feed-chutes") as p:
        for sign in (-1, 1):
            x = sign * 1.79
            p.plates("탄약 공급 슈트", (x, .15, 0), [(.51, .89, 1.24, .11), (.92, .98, 1.40, .13),
                     (1.78, .54, 1.16, .11)], "line", .035)
            p.plate("공급 슈트 개구", (x, .15, 1.786), (.38, .86, .046), "carbon", .07, .012)
            for y in (.22, .43, .64):
                p.plate("탄약 트레이 가로대", (x, y - .31, 1.813), (.35, .077, .06), "silver", .017, .01)
    with kit.part("detail", "loader-arm") as p:
        a, b, c = (1.51, 1.49, 1.19), (2.06, 1.82, 2.50), (1.98, 1.70, 3.02)
        p.plate("자동 장전 암 받침", (1.62, 1.49, 1.23), (.84, .65, .52), "line", .11, .031)
        p.rod("자동 장전 암 하부", a, b, .34, "line", steps=8)
        p.rod("자동 장전 암 상부", b, c, .23, "silver", steps=8)
        p.rod("장전 암 관절", (1.82, 1.82, 2.50), (2.38, 1.82, 2.50), .29, "slate")
        p.plate("장전 암 집게", (1.98, 1.69, 3.05), (.81, .56, .30), "slate", .09, .02)
        p.plate("장전 암 상판", (1.98, 1.69, 3.204), (.66, .47, .07), "silver", .07)
    with kit.part("detail", "ballistics-dome", "yaw") as p:
        p.plates("탄도 돔 받침 하우징", (0, -1.13, 0), [(.27, 2.38, 1.39, .24),
                 (1.31, 2.36, 1.50, .20), (1.77, 2.31, 1.46, .22),
                 (1.98, 2.09, 1.34, .22)], "line", .043)
        p.lathe("돔 아래 테두리", (-.15, -1.28, 1.96), [(0, .78), (.07, .79), (.17, .72)],
                "silver", steps=16)
        p.lathe("돔 사이 이음선", (-.15, -1.28, 2.126), [(0, .72), (.049, .715)],
                "carbon", steps=16)
        p.lathe("탄도 연산 돔", (-.15, -1.28, 2.175), [(0, .69), (.18, .66), (.38, .53),
                 (.53, .34), (.59, .10)], "line", steps=16)
        p.plate("돔 센서", (-.40, -.68, 2.36), (.23, .09, .15), "silver", .027)
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
            p.plate("틸 포상 표식", (sign * 1.55, -.59, .78), (.09, .46, .10), "teal", .027, .012)
    with kit.part("marking", "pressure-gauge") as p:
        for sign in (-1, 1):
            x = sign * 1.51
            p.rod("압력 게이지 베젤", (x, -.47, .90), (sign * 1.65, -.47, .90), .166, "slate")
            p.rod("압력 게이지 색판", (sign * 1.63, -.47, .90), (sign * 1.67, -.47, .90), .117, "teal")
            p.plate("압력 게이지 바늘", (sign * 1.677, -.45, .92), (.022, .10, .024),
                    "amber", .009, .006).rotation_euler.x = .55
    with kit.part("marking", "fortress-trim") as p:
        for index in range(4):
            angle = index * math.pi / 2
            center = (1.56 * math.sin(angle), -1.56 * math.cos(angle), 0)
            panel = p.plates("요새 하우징 장갑 덧댐", center, [(.37, .67, .59, .12),
                             (.52, .65, .60, .12), (1.24, .49, .34, .093)], "line", .025)
            panel.rotation_euler.z = angle
            face = (1.81 * math.sin(angle), -1.81 * math.cos(angle), 0)
            tab = p.plates("장갑 덧댐 금테", face, [(.69, .55, .14, .05), (1.13, .43, .11, .035)],
                          "amber", .011)
            tab.rotation_euler.z = angle


def build_kit():
    kit = Kit()
    for build in (deck, core, armor, supports, armament, accessories):
        build(kit)
    return kit.scene
