"""벌레 특수 개체의 등딱지와 비행 개체를 군집 보행에 맞춰 움직인다."""

from pilot import rotate


def animate_swarm(rig):
    armor = next((s for s in rig["slots"] if s["name"] == "armor"), None)
    if armor is None:
        return
    covers = [skin["attachments"]["armor"]["armor"] for skin in rig["skins"] if "armor" in skin["attachments"]]
    first = covers[0]
    # 오른쪽을 향한 딱정벌레의 등딱지 앞쪽을 경첩으로 삼는다.
    x = first["x"] + first["width"] * first["scaleX"] * .30
    y = first["y"] + first["height"] * first["scaleY"] * .20
    rig["bones"].append({"name": "wing-cover", "parent": armor["bone"], "x": x, "y": y})
    armor["bone"] = "wing-cover"
    for cover in covers:
        cover["x"] -= x
        cover["y"] -= y
    walk = rig["animations"]["walk"]["bones"]
    duration = walk["body"]["translate"][-1]["time"]
    walk["wing-cover"] = {"rotate": rotate((0, 0), (duration * .25, -7), (duration * .5, 0),
                                            (duration * .75, -7), (duration, 0))}
    # 떨어져 나는 개체는 위아래로 움직이는 기존 트랙에 가벼운 기울임을 더한다.
    walk["swarm-1"]["rotate"] = rotate((0, 0), (duration * .25, 6), (duration * .75, -6), (duration, 0))
