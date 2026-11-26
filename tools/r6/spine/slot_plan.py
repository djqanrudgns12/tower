"""일부 스킨의 겹침 순서와 장비 부착을 저작용 슬롯과 연결한다."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AttachmentSlot:
    name: str
    part: str
    bone: str


def draw_plan(slots, view):
    """공용 뼈대에서 두 순서를 함께 정의하고 스킨별로 필요한 슬롯만 채운다."""
    normal = [AttachmentSlot(slot.name, slot.name, slot.bone) for slot in slots]
    head_front = view.get("headFront", False)
    gear_bone = view.get("gearBone")
    if head_front:
        normal = [slot for slot in normal if slot.name != "head"]
    if view.get("rearGear"):
        normal.insert(len(normal) - 1, AttachmentSlot("gear-rear", "gear-rear", "arm-hand-near"))
    if gear_bone:
        normal[-1] = AttachmentSlot(f"gear-on-{gear_bone}", "gear", gear_bone)
    if head_front:
        normal.append(AttachmentSlot("head-front", "head", "head"))
    return normal
