"""R6 적 뼈대와 슬롯의 기준 좌표. 원점은 발밑, 위쪽은 양수다."""

from dataclasses import dataclass

from pilot import rotate, rotate_curved, scale_curved, translate, translate_curved


VARIANTS = {
    "infantry": ("biped",),
    "runner": ("quadruped",),
    "armored": ("biped", "quadruped"),
    "special": ("flying", "swarm", "wheeled", "crystal"),
    "boss": ("biped", "quadruped"),
}

# 종족별 보행 주기·탄력·기울기·팔로우스루 성격(성능 예산: 본 수·키 수 유지)
SPECIES_STYLE = {
    "elf": {"durationK": 0.94, "rise": 1.45, "lean": -3.5, "squash": 0.018, "delay": 0.07, "ease": (0.28, 0.05, 0.25, 1.0)},
    "human": {"durationK": 1.00, "rise": 1.25, "lean": -2.0, "squash": 0.015, "delay": 0.05, "ease": (0.30, 0.0, 0.20, 1.0)},
    "machine": {"durationK": 0.98, "rise": 0.95, "lean": -1.5, "squash": 0.010, "delay": 0.02, "ease": (0.48, 0.0, 0.14, 1.0)},
    "insect": {"durationK": 0.84, "rise": 1.20, "lean": -4.5, "squash": 0.020, "delay": 0.04, "ease": (0.22, 0.05, 0.22, 1.0)},
    "stone": {"durationK": 1.14, "rise": 1.55, "lean": -1.0, "squash": 0.022, "delay": 0.09, "ease": (0.38, 0.0, 0.30, 1.0)},
}
DEFAULT_STYLE = SPECIES_STYLE["human"]
EASE_IN_OUT = (0.42, 0.0, 0.58, 1.0)
EASE_SNAP = (0.18, 0.0, 0.22, 1.0)


@dataclass(frozen=True)
class Slot:
    name: str
    bone: str
    required: bool = True


def stride_px(family, variant, body_y, species=None):
    """보행 1주기 동안 지면 접지 다리 각도 변화에서 이상 이동 보폭(px)을 산출한다."""
    if variant == "wheeled":
        return 62.0
    if variant == "flying":
        return 54.0
    if variant == "crystal":
        return 48.0
    if variant == "swarm":
        return 44.0
    deg = 22.0 if family == "runner" else 15.0 if family == "infantry" else 13.0 if family == "armored" else 14.0
    if species == "stone":
        deg *= 0.9
    elif species == "insect":
        deg *= 1.15
    rad = deg * 3.14159265 / 180.0
    # 앞뒤 각도 합 × 다리 길이 근사 + 종족 보폭 계수
    return round(max(24.0, 2.0 * max(12.0, body_y * 0.72) * rad * 1.45), 2)


def layout(family, profile, *, species=None):
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
    return variant, bones, slots, animation_set(family, variant, body_y, movers, species=species)


def _eval_loop(samples, duration, offset, points):
    """닫힌 주기 함수를 위상 이동(offset 초)하여 주어진 시각 목록(0..duration)에서 선형 보간한다."""
    n = len(points) - 1
    out = []
    for t in samples:
        u = ((t - offset) % duration) / duration
        pos = u * n
        i = int(pos) % n
        frac = pos - int(pos)
        v0, v1 = points[i], points[i + 1]
        out.append(round(v0 + (v1 - v0) * frac, 4))
    return out


def animation_set(family, variant, body_y, movers, *, species=None):
    base_dur = {"infantry": .90, "runner": .58, "armored": 1.14, "special": .78, "boss": 1.22}[family]
    style = SPECIES_STYLE.get(species, DEFAULT_STYLE)
    duration = round(base_dur * style["durationK"], 4)
    ease = style["ease"]

    # 테스트 계약(보스 >= 일반 1.4x 높이)을 보존하기 위해 일반 개체 상하 바운스는 +1.8px 이하,
    # 보스 음의 침강은 -1.5px 이상, scaleY 변동은 ±0.025 이내로 제한한다.
    rise = 0.0 if variant == "wheeled" else 2.2 if variant == "flying" else min(1.75, style["rise"])
    sink = 0.0 if variant in ("wheeled", "flying") else (-0.55 if species == "stone" else -0.35)
    if family == "boss":
        rise = min(1.5, rise)
        sink = max(-1.2, sink)

    q = duration / 4
    body_track = {}
    if variant == "wheeled":
        body_track["translate"] = translate_curved(
            (0, 0, 0, EASE_IN_OUT),
            (q, 0.25, 0.35, EASE_IN_OUT),
            (duration / 2, 0, -0.15, EASE_IN_OUT),
            (q * 3, -0.25, 0.35, EASE_IN_OUT),
            (duration, 0, 0),
        )
        body_track["rotate"] = rotate_curved(
            (0, -1.2, EASE_IN_OUT), (duration / 2, 0.8, EASE_IN_OUT), (duration, -1.2),
        )
    elif variant == "flying":
        # 8자 부유 궤적 + 부드러운 기울기
        sway_x = 1.6 if species == "elf" else 0.9
        body_track["translate"] = translate_curved(
            (0, 0, 0, EASE_IN_OUT),
            (q, sway_x, rise, EASE_IN_OUT),
            (duration / 2, 0, -0.4, EASE_IN_OUT),
            (q * 3, -sway_x, rise, EASE_IN_OUT),
            (duration, 0, 0),
        )
        body_track["rotate"] = rotate_curved(
            (0, style["lean"], EASE_IN_OUT),
            (duration / 2, style["lean"] - 2.4, EASE_IN_OUT),
            (duration, style["lean"]),
        )
    else:
        # 2박자 착지 침강(t=0, duration/2) + 최고점 도달(t=0.28, 0.78)
        sq = min(0.02, style["squash"])
        body_track["translate"] = translate_curved(
            (0, 0, sink, ease),
            (duration * 0.25, 0, rise, EASE_IN_OUT),
            (duration * 0.50, 0, sink, ease),
            (duration * 0.75, 0, rise, EASE_IN_OUT),
            (duration, 0, sink),
        )
        lean = style["lean"]
        lean_swing = 1.6 if species in ("stone", "human") else 1.1
        body_track["rotate"] = rotate_curved(
            (0, lean - lean_swing, ease),
            (duration * 0.25, lean + lean_swing * 0.5, EASE_IN_OUT),
            (duration * 0.50, lean - lean_swing, ease),
            (duration * 0.75, lean + lean_swing * 0.5, EASE_IN_OUT),
            (duration, lean - lean_swing),
        )
        body_track["scale"] = scale_curved(
            (0, 1 + sq * 0.6, 1 - sq, ease),
            (duration * 0.25, 1 - sq * 0.4, 1 + sq * 0.6, EASE_IN_OUT),
            (duration * 0.50, 1 + sq * 0.6, 1 - sq, ease),
            (duration * 0.75, 1 - sq * 0.4, 1 + sq * 0.6, EASE_IN_OUT),
            (duration, 1 + sq * 0.6, 1 - sq),
        )

    walk = {"body": body_track}

    # 머리 팔로우스루: 본체보다 한 템포(style["delay"]) 늦게 반응
    head_times = [0, duration * 0.25, duration * 0.50, duration * 0.75, duration]
    head_angles = _eval_loop(head_times, duration, style["delay"] * duration, [2.2, -1.8, 2.2, -1.8, 2.2])
    head_angles[-1] = head_angles[0]
    walk["head"] = {
        "rotate": rotate_curved(
            *[(t, a, EASE_IN_OUT) if i < 4 else (t, a) for i, (t, a) in enumerate(zip(head_times, head_angles))]
        )
    }

    # 비대칭 접지(0~55% 뒤로 밈) + 스윙(55~100% 빠르게 앞 회수) 표준 5키 프로파일
    st_t = [0, duration * 0.275, duration * 0.55, duration * 0.775, duration]
    for name, (angle, phase, lift) in movers.items():
        sign = 1 if phase else -1
        if lift:
            walk[name] = {"translate": translate_curved(
                (0, 0, 0, EASE_IN_OUT),
                (duration / 2, 2.2 * sign, lift, EASE_IN_OUT),
                (duration, 0, 0),
            )}
        elif angle == 360:
            walk[name] = {"rotate": rotate(
                (0, 0), (duration / 4, -90), (duration / 2, -180),
                (duration * .75, -270), (duration, -360),
            )}
        elif variant == "flying" and name.startswith("wing-"):
            # 비대칭 날갯짓: 다운스트로크 빠르고 힘차게(0~40%), 업스트로크 부드럽게(40~100%)
            flap = angle * (1.15 if species == "elf" else 0.95)
            walk[name] = {"rotate": rotate_curved(
                (0, -flap * 0.75, EASE_SNAP),
                (duration * 0.40, flap * 1.05, EASE_IN_OUT),
                (duration, -flap * 0.75),
            )}
        elif "-foot-" in name:
            # 발목: 접지 구간엔 지면 평행 유지(-6°~+4°), 스윙 시 발끝 살짝 들림/밀어내기
            pts = [-angle * 0.35 * sign, 0.0, angle * 0.55 * sign, -angle * 0.85 * sign, -angle * 0.35 * sign]
            vals = _eval_loop(st_t, duration, (0.5 if phase == 0 else 0.0) * duration, pts)
            vals[-1] = vals[0]
            walk[name] = {"rotate": rotate_curved(
                *[(t, v, ease) if i < 4 else (t, v) for i, (t, v) in enumerate(zip(st_t, vals))]
            )}
        elif name.startswith("arm-"):
            # 팔·손은 다리와 반대 위상 + 부드러운 지연 팔로우스루
            arm_lag = 0.06 * duration if "-hand-" in name else 0.0
            pts = [angle * sign, 0.0, -angle * sign, 0.0, angle * sign]
            vals = _eval_loop(st_t, duration, arm_lag, pts)
            vals[-1] = vals[0]
            walk[name] = {"rotate": rotate_curved(
                *[(t, v, EASE_IN_OUT) if i < 4 else (t, v) for i, (t, v) in enumerate(zip(st_t, vals))]
            )}
        else:
            # 다리/집게: 전진 끝(+angle) → 접지 중간(0) → 후퇴 끝(-angle) → 스윙 회수
            pts = [angle * sign, 0.0, -angle * sign, angle * 0.25 * sign, angle * sign]
            vals = _eval_loop(st_t, duration, (0.5 if phase == 0 else 0.0) * duration, pts)
            vals[-1] = vals[0]
            walk[name] = {"rotate": rotate_curved(
                *[(t, v, ease) if i < 4 else (t, v) for i, (t, v) in enumerate(zip(st_t, vals))]
            )}

    # 다중 본 피격 동작(0.24s) — walk와 겹칠 때도 관절이 분리되지 않게 자식 회전은 ±5° 이내로 절제한다.
    hit_bones = {
        "body": {
            "rotate": rotate_curved((0, 0, EASE_SNAP), (.07, 11, ease), (.24, 0)),
            "translate": translate_curved((0, 0, 0, EASE_SNAP), (.07, -3.0, 0.8, ease), (.24, 0, 0)),
        },
        "head": {
            "rotate": rotate_curved((0, 0, EASE_SNAP), (.095, -1.5, ease), (.24, 0)),
        },
    }
    for name in movers:
        if name.startswith("arm-hand-"):
            hit_bones[name] = {"rotate": rotate_curved((0, 0, EASE_SNAP), (.09, 4, ease), (.24, 0))}
        elif name.startswith("arm-"):
            side_sign = -1 if name.endswith("-far") else 1
            hit_bones[name] = {"rotate": rotate_curved((0, 0, EASE_SNAP), (.075, 6 * side_sign, ease), (.24, 0))}
        elif name.startswith("wing-"):
            side_sign = -1 if name.endswith("-far") else 1
            hit_bones[name] = {"rotate": rotate_curved((0, 0, EASE_SNAP), (.08, 8 * side_sign, ease), (.24, 0))}

    # 다중 본 쓰러짐(일반 ≤0.56s, 보스 ≤0.80s) — 2D 파츠 접합 여유(≥6px)를 지키는 범위로 자식 꺾임을 조절한다.
    fall_t1, fall_t2, fall_t3 = (.28, .60, .80) if family == "boss" else (.18, .42, .54)
    fall_drop = -body_y * (0.68 if species == "stone" else 0.72)
    fall_bones = {
        "body": {
            "rotate": rotate_curved((0, 0, ease), (fall_t1, 28, EASE_SNAP), (fall_t2, 68, EASE_IN_OUT), (fall_t3, 64)),
            "translate": translate_curved(
                (0, 0, 0, ease),
                (fall_t1, -2.5, fall_drop * 0.36, EASE_SNAP),
                (fall_t2, -5.0, fall_drop, EASE_IN_OUT),
                (fall_t3, -5.0, fall_drop * 0.96),
            ),
        },
        "head": {
            "rotate": rotate_curved((0, 0, ease), (fall_t1, -1.0, ease), (fall_t2, 1.5, EASE_IN_OUT), (fall_t3, 1.0)),
        },
    }
    for name in movers:
        if name.startswith("leg-foot-"):
            fall_bones[name] = {"rotate": rotate_curved((0, 0, ease), (fall_t1, -4, ease), (fall_t3, -5))}
        elif name.startswith("leg-"):
            fall_bones[name] = {"rotate": rotate_curved((0, 0, ease), (fall_t1, 5, ease), (fall_t3, 6))}
        elif name.startswith("arm-"):
            side_sign = 1 if name.endswith("-near") else -1
            fall_bones[name] = {"rotate": rotate_curved((0, 0, ease), (fall_t2, 5 * side_sign, EASE_IN_OUT), (fall_t3, 4 * side_sign))}
        elif name.startswith("wing-"):
            fall_bones[name] = {"rotate": rotate_curved((0, 0, ease), (fall_t2, -6, EASE_IN_OUT), (fall_t3, -5))}

    animations = {
        "walk": {"bones": walk},
        "hit": {"bones": hit_bones},
        "fall": {"bones": fall_bones},
    }
    if family == "boss":
        skill_bones = {
            "body": {
                "rotate": rotate_curved((0, 0, EASE_IN_OUT), (.26, 15, EASE_SNAP), (.42, -16, ease), (.76, 0)),
                "translate": translate_curved((0, 0, 0, EASE_IN_OUT), (.26, -3, -1.8, EASE_SNAP), (.42, 7.5, 2.0, ease), (.76, 0, 0)),
                "scale": scale_curved((0, 1, 1, EASE_IN_OUT), (.26, 1.04, 0.96, EASE_SNAP), (.42, 0.97, 1.03, ease), (.76, 1, 1)),
            },
            "head": {"rotate": rotate_curved((0, 0, EASE_IN_OUT), (.26, -10, EASE_SNAP), (.42, 12, ease), (.76, 0))},
            "skill": {"translate": translate_curved((0, 0, 0, EASE_IN_OUT), (.42, 14, 0, ease), (.76, 0, 0))},
        }
        for name in movers:
            if name.startswith("arm-") and "-hand-" not in name:
                skill_bones[name] = {"rotate": rotate_curved((0, 0, EASE_IN_OUT), (.26, -22, EASE_SNAP), (.42, 26, ease), (.76, 0))}
        animations["boss-skill"] = {"bones": skill_bones}
    return animations


def world_bones(bones):
    world = {}
    for name, (parent, x, y) in bones.items():
        parent_x, parent_y = world.get(parent, (0, 0))
        world[name] = (parent_x + x, parent_y + y)
    return world
