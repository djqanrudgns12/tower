"""세 지원 타워 키트에 쓰는 다각형 바닥과 얇은 곡면 부품."""

import math

import bpy
from mathutils import Vector


def radial(radius, angle, z=0):
    return Vector((radius * math.cos(angle), radius * math.sin(angle), z))


def polygon(p, name, xy, sections, color, bevel=0):
    rings = [[(x * scale, y * scale, z) for x, y in xy] for z, scale in sections]
    return p.mesh(name, rings, color, bevel=bevel)


def regular(radius, corners, start):
    return [tuple(radial(radius, start + index * math.tau / corners).xy) for index in range(corners)]


def beam(p, name, a, b, width, depth, color):
    a, b = Vector(a), Vector(b)
    axis = b - a
    obj = p.plate(name, (a + b) / 2, (width, depth, axis.length), color, bevel=.024)
    obj.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
    return obj


def arc(p, name, center, start, end, profile, color, segments=18):
    """(높이, 반지름) 폐단면을 열린 호로 밀어 끝면이 있는 판을 만든다."""
    rings = [[tuple(radial(r, start + (end - start) * i / segments, z)) for z, r in reversed(profile)]
             for i in range(segments + 1)]
    return p.mesh(name, rings, color, center)


def octahedron(p, name, center, radius, height, color, phase=0):
    points = [(*radial(radius, phase + i * math.pi / 2).xy, 0) for i in range(4)]
    points.extend(((0, 0, -height / 2), (0, 0, height / 2)))
    faces = [(i, (i + 1) % 4, 5) for i in range(4)]
    faces += [((i + 1) % 4, i, 4) for i in range(4)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    p.collection.objects.link(obj)
    obj.location = center
    obj["color"] = color
