"""R6 적 뼈대와 슬롯의 기준 좌표. 원점은 발밑, 위쪽은 양수다."""

from dataclasses import dataclass

from pilot import rotate, translate


VARIANTS = {
    "infantry": ("biped",),
    "runner": ("quadruped",),
    "armored": ("biped", "quadruped"),
    "special": ("flying", "swarm", "wheeled", "crystal"),
    "boss": ("biped", "quadruped"),
}


@dataclass(frozen=True)
class Slot:
    name: str
    bone: str
    required: bool = True


def layout(family, profile):
    variants = VARIANTS[family]
    variant = profile.get("variant", variants[0])
    if variant not in variants:
        raise ValueError(f"{family}에 사용할 수 없는 틀 · {variant}")
    proportions = profile.get("proportions", {})
    if not isinstance(proportions, dict) or set(proportions) - {"bodyWidth", "bodyHeight", "legLength"}:
        raise ValueError("비례는 bodyWidth·bodyHeight·legLength만 지정할 수 있습니다.")
    if any(type(value) not in (int, float) or not .5 <= value <= 1.8 for value in proportions.values()):
        raise ValueError("비례 값은 0.5~1.8 사이 숫자여야 합니다.")
    width, height, length = (proportions.get(key, 1) for key in ("bodyWidth", "bodyHeight", "legLength"))
    body_y = {"infantry": 26, "runner": 17, "armored": 19, "special": 24, "boss": 31}[family]
    if variant == "wheeled":
        body_y = 14
    body_y = round(body_y * length, 3)
    bones = {"root": (None, 0, 0)}
    rear, front = [], []
    movers = {}

    def bone(name, parent, x=0, y=0):
        bones[name] = (parent, round(x * width, 3), round(y, 3))

    bone("body", "root", 0, body_y)
    bone("head", "body", 13 if variant == "quadruped" else 5, (5 if variant == "quadruped" else 10) * height)
    bone("skill", "body", 14, 3 * height)

    def limb(name, x, y, slots, motion, phase, tip=None, *, required=True):
        bone(name, "body", x, y)
        slots.append(Slot(name, name, required))
        movers[name] = (motion, phase, None)
        if tip:
            end, dx, dy = tip
            distal = name.rsplit("-", 1)[0] + "-" + end + "-" + name.rsplit("-", 1)[1]
            bone(distal, name, dx, dy)
            slots.append(Slot(distal, distal))
            movers[distal] = (-motion * .5, phase, None)

    if variant in ("biped", "quadruped"):
        stations = (("hind", -11), ("fore", 11)) if variant == "quadruped" else (("", 0),)
        for side, slots, depth in (("far", rear, 1), ("near", front, -1)):
            for index, (station, x) in enumerate(stations):
                name = f"leg-{station}-{side}" if station else f"leg-{side}"
                phase = (index + (side == "far")) % 2
                limb(name, x + 4 * depth, -(5 if variant == "quadruped" else 7) * length,
                     slots, 21 if family == "runner" else 14, phase,
                     ("foot", 1, -body_y * .57))
            if variant == "biped":
                limb(f"arm-{side}", 4 + 5 * depth, 5 * height, slots, 12, int(side == "near"),
                     ("hand", 3, -8 * height))
    elif variant == "flying":
        limb("wing-far", 1, 3 * height, rear, 31, 0)
        limb("wing-near", -3, 3 * height, front, -31, 0)
    elif variant == "wheeled":
        for index, x in enumerate((-11, 11), 1):
            limb(f"wheel-{index}", x, -8 * length, front, 360, 0)
    elif variant == "swarm":
        # 벌레 계통의 뒤 단계에서 켜는 다리. 모함 스킨과 첫 단계는 비워 둘 수 있다.
        for side, slots, depth in (("far", rear, 1), ("near", front, -1)):
            for index, x in enumerate((-8, 0, 8), 1):
                limb(f"swarm-leg-{index}-{side}", x + 2 * depth, -7 * length,
                     slots, 16, (index + (side == "far")) % 2, required=False)
        for index in range(1, 4):
            slot = f"swarm-{index}"
            bone(slot, "body", (index - 2) * 13, -10 + index % 2 * 5)
            front.append(Slot(slot, slot, required=index == 1))
            movers[slot] = (0, index % 2, 3)
    else:
        limb("crystal-far", -9, -5 * height, rear, 17, 0)
        limb("crystal-near", 9, -5 * height, front, 17, 1)

    hand = "arm-hand-near" if "arm-hand-near" in bones else "body"
    slots = [
        Slot("shadow", "root", False), *rear, Slot("body", "body"),
        Slot("head", "head", variant in ("biped", "quadruped", "flying")),
        Slot("armor", "body", False), Slot("mark", "body", False),
        *front, Slot("gear", hand, False),
    ]
    return variant, bones, slots, animation_set(family, variant, body_y, movers)


def animation_set(family, variant, body_y, movers):
    duration = {"infantry": .92, "runner": .60, "armored": 1.16, "special": .80, "boss": 1.24}[family]
    rise = 0 if variant == "wheeled" else 3 if variant == "flying" else 1.3
    walk = {"body": {"translate": translate(
        (0, 0, 0), (duration / 4, 0, rise), (duration / 2, 0, 0),
        (duration * .75, 0, rise), (duration, 0, 0))}}
    for name, (angle, phase, lift) in movers.items():
        sign = 1 if phase else -1
        if lift:
            walk[name] = {"translate": translate((0, 0, 0), (duration / 2, 2 * sign, lift), (duration, 0, 0))}
        elif angle == 360:
            walk[name] = {"rotate": rotate((0, 0), (duration / 4, -90), (duration / 2, -180),
                                           (duration * .75, -270), (duration, -360))}
        else:
            walk[name] = {"rotate": rotate((0, 0), (duration / 4, angle * sign), (duration / 2, 0),
                                           (duration * .75, -angle * sign), (duration, 0))}
    animations = {
        "walk": {"bones": walk},
        "hit": {"bones": {"body": {
            "rotate": rotate((0, 0), (.075, 11), (.24, 0)),
            "translate": translate((0, 0, 0), (.075, -3, 1), (.24, 0, 0)),
        }}},
        "fall": {"bones": {"body": {
            "rotate": rotate((0, 0), (.22, 28), (.52, 65)),
            "translate": translate((0, 0, 0), (.22, -2, -body_y * .28), (.52, -4, -body_y * .70)),
        }}},
    }
    if family == "boss":
        animations["boss-skill"] = {"bones": {
            "body": {
                "rotate": rotate((0, 0), (.26, 14), (.39, -16), (.72, 0)),
                "translate": translate((0, 0, 0), (.26, -3, -2), (.39, 7, 2), (.72, 0, 0)),
            },
            "skill": {"translate": translate((0, 0, 0), (.39, 13, 0), (.72, 0, 0))},
        }}
    return animations


def world_bones(bones):
    world = {}
    for name, (parent, x, y) in bones.items():
        parent_x, parent_y = world.get(parent, (0, 0))
        world[name] = (parent_x + x, parent_y + y)
    return world
