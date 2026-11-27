"""Spine 4.3 원화 무절단 프로시저럴 가중치 메시 빌더 및 예산 감사기 (Stage 2b, WP-C2-06)."""

import math


def _quad_grid(width, height, x, y, scale_x, scale_y, rows, cols):
    w = width * scale_x
    h = height * scale_y
    left = x - w / 2
    bottom = y - h / 2
    uvs = []
    coords = []
    for r in range(rows + 1):
        v = r / rows
        wy = bottom + (1.0 - v) * h
        for c in range(cols + 1):
            u = c / cols
            wx = left + u * w
            uvs.extend([round(u, 5), round(v, 5)])
            coords.append((round(wx, 4), round(wy, 4)))
    triangles = []
    stride = cols + 1
    for r in range(rows):
        for c in range(cols):
            i0 = r * stride + c
            i1 = i0 + 1
            i2 = i0 + stride
            i3 = i2 + 1
            triangles.extend([i0, i2, i3, i0, i3, i1])
    hull = 2 * rows + 2 * cols
    return uvs, coords, triangles, hull


def build_two_bone_limb_mesh(path, width, height, x, y, scale_x, scale_y, prox_idx, dist_idx, rows=3, cols=1):
    """다리·팔 2본 관절 굽힘용 가중치 메시(정점 ≤ 16, 본 2개 보간)를 생성한다."""
    uvs, coords, triangles, hull = _quad_grid(width, height, x, y, scale_x, scale_y, rows, cols)
    vertices = []
    stride = cols + 1
    for r in range(rows + 1):
        # 상단(r=0)은 근위 본 88%, 하단(r=rows)은 원위 본 88%
        dist_w = round(0.12 + 0.76 * (r / rows), 4)
        prox_w = round(1.0 - dist_w, 4)
        for c in range(stride):
            wx, wy = coords[r * stride + c]
            vertices.extend([2, prox_idx, wx, wy, prox_w, dist_idx, wx, wy, dist_w])
    return {
        "type": "mesh",
        "path": path,
        "uvs": uvs,
        "triangles": triangles,
        "vertices": vertices,
        "hull": hull,
        "width": width,
        "height": height,
    }


def build_soft_mesh(path, width, height, x, y, scale_x, scale_y, base_idx, tip_idx, rows=4, cols=2):
    """날개·망토·촉수 연성 슬롯용 가중치 메시(정점 ≤ 24, 본 2개 보간)를 생성한다."""
    uvs, coords, triangles, hull = _quad_grid(width, height, x, y, scale_x, scale_y, rows, cols)
    vertices = []
    stride = cols + 1
    for r in range(rows + 1):
        t = r / rows
        tip_w = round(0.1 + 0.85 * math.sin(t * math.pi / 2), 4)
        base_w = round(1.0 - tip_w, 4)
        for c in range(stride):
            wx, wy = coords[r * stride + c]
            vertices.extend([2, base_idx, wx, wy, base_w, tip_idx, wx, wy, tip_w])
    return {
        "type": "mesh",
        "path": path,
        "uvs": uvs,
        "triangles": triangles,
        "vertices": vertices,
        "hull": hull,
        "width": width,
        "height": height,
    }


def parse_weighted_vertex_stats(vertices, uv_count):
    """Spine 4.3 weighted mesh `vertices` 배열에서 영향 본 최대 수와 가중치 엔트리 총수를 계산한다."""
    n = uv_count // 2
    if len(vertices) == uv_count:
        return 1, n
    idx = 0
    max_bones = 0
    total_weights = 0
    for _ in range(n):
        if idx >= len(vertices):
            break
        count = int(vertices[idx])
        idx += 1 + count * 4
        max_bones = max(max_bones, count)
        total_weights += count
    return max_bones, total_weights


def audit_mesh_budget(rig, *, is_boss=False):
    """클로드 검수 Stage 2b 스켈레톤/메시/제약 상한을 검사해 위반 목록을 돌려준다."""
    violations = []
    bone_cap = 32 if is_boss else 24
    slot_cap = 22 if is_boss else 16
    mesh_cap = 8 if is_boss else 6
    vert_cap = 32 if is_boss else 24
    infl_cap = 3 if is_boss else 2
    weight_cap = 400 if is_boss else 200

    if len(rig.get("bones", [])) > bone_cap:
        violations.append(("bones", len(rig["bones"]), bone_cap))
    draw_slots = [s for s in rig.get("slots", []) if s.get("name") != "shadow"]
    if len(draw_slots) > slot_cap:
        violations.append(("slots", len(draw_slots), slot_cap))

    for key in ("ik", "transform", "path", "physics"):
        if rig.get(key):
            violations.append((f"constraint:{key}", len(rig[key]), 0))

    for skin in rig.get("skins", []):
        mesh_count = 0
        weight_sum = 0
        for slot_name, attachments in skin.get("attachments", {}).items():
            for att_name, att in attachments.items():
                if att.get("type") == "clipping":
                    violations.append((f"clipping:{slot_name}.{att_name}", 1, 0))
                if att.get("type") != "mesh":
                    continue
                mesh_count += 1
                uvs = att.get("uvs", [])
                verts = len(uvs) // 2
                if verts > vert_cap:
                    violations.append((f"verts:{slot_name}", verts, vert_cap))
                max_b, entries = parse_weighted_vertex_stats(att.get("vertices", []), len(uvs))
                if max_b > infl_cap:
                    violations.append((f"influences:{slot_name}", max_b, infl_cap))
                weight_sum += entries
        if mesh_count > mesh_cap:
            violations.append((f"meshes:{skin.get('name')}", mesh_count, mesh_cap))
        if weight_sum > weight_cap:
            violations.append((f"weights:{skin.get('name')}", weight_sum, weight_cap))
    return violations
