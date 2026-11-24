import * as THREE from 'three';
import { makeEnemy, makeTower } from './models.js';
import { cameraFor, contactShadow, makeTiltShift, woodTexture } from './render.js';

const mapUrl = new URL('../../../../../../contracts/maps.candidate.v0.4.json', import.meta.url);

export async function loadMap() {
  const response = await fetch(mapUrl);
  if (!response.ok) throw new Error('맵 계약을 읽을 수 없습니다.');
  const { maps } = await response.json();
  const map = maps.find(({ id }) => id === 'garden_u');
  const measuredPath = map.waypoints.slice(1).reduce((cells, [x, z]) => {
    const [startX, startZ] = cells.at(-1);
    const stepX = Math.sign(x - startX);
    const stepZ = Math.sign(z - startZ);
    const count = Math.abs(x - startX) + Math.abs(z - startZ);
    if (stepX && stepZ) throw new Error('맵 경로는 격자의 가로와 세로 방향으로 이어져야 합니다.');
    for (let step = 1; step <= count; step++) {
      cells.push([startX + stepX * step, startZ + stepZ * step]);
    }
    return cells;
  }, [map.waypoints[0]]);
  if (measuredPath.map(String).join('|') !== map.pathCells.map(String).join('|')) {
    throw new Error('맵의 경로 칸과 경유점이 일치해야 합니다.');
  }
  return map;
}

const fixtures = [
  { id: 'archer', slot: 'garden_u-s09', turn: -0.48 },
  { id: 'cannon', slot: 'garden_u-s12', turn: 0.52 },
  { id: 'spire', slot: 'garden_u-s16', turn: 0.22 },
  { id: 'relay', slot: 'garden_u-s19', turn: 0.43 },
];

const formation = [
  ['golem', 4.4, 0.10], ['scarab', 6.9, -0.06], ['scarab', 8.16, 0.10],
  ['hound', 10.6, -0.05], ['hound', 11.85, 0.12], ['shard', 19.4, -0.10],
  ['boss', 27.8, 0], ['golem', 31.0, -0.09], ['shard', 34.1, 0.10],
];

const rimGroves = [
  [[1, 0], [2, 0]], [[4, 0], [5, 0]], [[9, 0], [10, 0]],
  [[12, 0], [13, 0], [14, 0], [14, 1]], [[14, 4], [14, 5], [14, 6]],
  [[0, 5], [0, 6], [1, 6]], [[1, 8], [2, 8], [3, 8]],
  [[6, 8], [7, 8]], [[9, 8], [10, 8], [11, 8]],
];

const curbSections = [
  [[2, 1], -1], [[5, 1], 1], [[10, 1], 1], [[7, 3], 1],
  [[3, 5], -1], [[6, 5], 1], [[8, 5], 1], [[10, 5], -1], [[13, 7], -1],
];

const pathTop = (x, z) => 0.025 + (1 + Math.sin(x * 0.69 + z * 0.52)) * 0.014;

function cliff(world, scene, width, depth) {
  const { k } = world;
  const x = width / 2;
  const z = depth / 2;
  const outline = [
    [-x, -z], [-x * 0.55, -z], [x * 0.19, -z], [x * 0.60, -z], [x, -z],
    [x, -z * 0.4], [x, z * 0.34], [x, z], [x * 0.62, z], [x * 0.21, z],
    [-x * 0.18, z], [-x * 0.55, z], [-x, z], [-x, z * 0.2], [-x, -z * 0.42],
  ];
  const middle = outline.map(([a, b], i) => [a * (1.015 + 0.016 * Math.sin(i * 2.3)), -0.42, b * (1.02 + 0.03 * Math.cos(i * 3.1))]);
  const bottom = outline.map(([a, b], i) => [
    a * (0.89 + 0.05 * Math.sin(i * 1.9)), -1.22 - 0.56 * Math.pow(Math.sin(i * 0.58), 2), b * 0.92,
  ]);
  const vertices = { earth: [], slot: [] };
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    const a = [outline[i][0], -0.08, outline[i][1]];
    const b = [outline[next][0], -0.08, outline[next][1]];
    const lowerFace = i % 3 === 1 ? vertices.slot : vertices.earth;
    vertices.earth.push(...a, ...b, ...middle[i], ...b, ...middle[next], ...middle[i]);
    lowerFace.push(...middle[i], ...middle[next], ...bottom[i], ...middle[next], ...bottom[next], ...bottom[i]);
  }
  for (const [color, points] of Object.entries(vertices)) {
    const rock = new THREE.BufferGeometry();
    rock.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    rock.computeVertexNormals();
    k.add(scene, rock, color, [0, 0, 0], { lined: false });
  }
}

function desertMesas(world, scene) {
  const { theme, k, materials } = world;
  const color = new THREE.Color(theme.sky);
  const stone = new THREE.Color(theme.ground);
  const ranges = [
    { center: [-10.1, -3.7, -12.3], size: [3.8, 2.1, 1.7], tone: 0.72, turn: 0.2 },
    { center: [-6.7, -4.4, -12.8], size: [2.8, 1.7, 1.5], tone: 0.56, turn: 0.55 },
    { center: [6.4, -4.1, -12.4], size: [3.9, 2.0, 1.7], tone: 0.55, turn: 0.8 },
    { center: [11.2, -3.4, -12.0], size: [4.0, 3.0, 2.1], tone: 0.63, turn: 0.4 },
  ];
  const tint = (amount) => {
    const material = materials.earth.clone();
    material.color.copy(color.clone().lerp(stone, amount));
    return material;
  };
  for (const { center, size, tone, turn } of ranges) {
    const [x, y, z] = center;
    const lower = k.drum(scene, [0.83, 1.12, 1, 6], center, 'earth',
      { scale: size, rotation: [0, turn, 0], shadow: false });
    lower.material = tint(tone);
    const upper = k.drum(scene, [0.63, 0.80, 1, 6], [x, y + size[1] * 0.62, z], 'rim',
      { scale: [size[0], size[1] * 0.35, size[2]], rotation: [0, turn, 0], shadow: false });
    upper.material = tint(tone * 0.78);
  }
}

function backdrop(world, scene, map) {
  const { id, k, theme } = world;
  scene.background = new THREE.Color(theme.sky);
  const w = map.gridWidth;
  const h = map.gridHeight;
  if (id === 'R07') {
    const tabletop = new THREE.Mesh(
      new THREE.PlaneGeometry(75, 60),
      new THREE.MeshStandardMaterial({
        map: woodTexture(new THREE.Color(theme.sky).lerp(new THREE.Color(theme.accent), 0.18).getStyle()),
        roughness: 0.57,
      }),
    );
    tabletop.rotation.x = -Math.PI / 2;
    tabletop.position.y = -0.95;
    tabletop.receiveShadow = true;
    scene.add(tabletop);
    const reflection = new THREE.PointLight('#fad6ac', 90, 28, 2);
    reflection.position.set(-8.8, 6.4, -7.4);
    scene.add(reflection);
    k.box(scene, [w + 0.79, 0.25, h + 0.79], [0, -0.81, 0], 'iron');
    k.box(scene, [w + 0.64, 0.42, h + 0.64], [0, -0.51, 0], 'earth');
    k.box(scene, [w + 0.48, 0.10, h + 0.48], [0, -0.255, 0], 'rim');
  } else if (id === 'R08') {
    scene.fog = new THREE.Fog(theme.sky, 26, 43);
    desertMesas(world, scene);
    k.box(scene, [w + 0.20, 0.32, h + 0.20], [0, -0.31, 0], 'rim');
    k.box(scene, [w + 0.03, 0.42, h + 0.03], [0, -0.68, 0], 'earth');
  } else {
    scene.fog = new THREE.Fog(theme.sky, 22, 55);
    cliff(world, scene, w + 0.16, h + 0.16);
  }
  k.box(scene, [w + 0.09, 0.20, h + 0.09], [0, -0.13, 0], 'grass');
}

function drawTerrain(world, scene, map, gridPosition) {
  const { k, materials } = world;
  const path = new Set(map.pathCells.map(String));
  const variations = (base) => [0.90, 0.95, 0.98, 1.01, 1.04, 1.07].map((factor) => {
    const material = base.clone();
    material.color.multiplyScalar(factor);
    return material;
  });
  const grass = variations(materials.grass);
  const road = variations(materials.path);
  for (let row = 0; row < map.gridHeight; row++) {
    for (let col = 0; col < map.gridWidth; col++) {
      const cell = [col, row];
      const walking = path.has(String(cell));
      const top = walking ? pathTop(col, row) : 0;
      const variation = 2.5 + 1.3 * Math.sin(col * 0.88 + row * 1.13) + 0.74 * Math.cos(col * 1.6 - row * 0.91);
      const floor = k.box(scene, [1, top + 0.05, 1], gridPosition(cell, (top - 0.05) / 2),
        walking ? 'path' : 'grass', { lined: false, shadow: false, square: true });
      floor.material = (walking ? road : grass)[Math.round(variation)];
    }
  }
  for (const [cell, side] of curbSections) {
    if (!path.has(String(cell))) continue;
    const [x, , z] = gridPosition(cell);
    for (let index = 0; index < 3; index++) {
      k.box(scene, [0.19 - index * 0.025, 0.048, 0.085],
        [x + (index - 1) * 0.21, 0.055, z + side * 0.43],
        index === 1 ? 'wall' : 'rim', { rotation: [0, index * 0.21 - 0.14, 0] });
    }
  }
  const arrows = [[map.entryCell, map.waypoints[1]], [map.waypoints.at(-2), map.exitCell]];
  for (const [[x, z], [nextX, nextZ]] of arrows) {
    const center = gridPosition([x, z], pathTop(x, z) + 0.002);
    const chevron = new THREE.Shape();
    chevron.moveTo(-0.20, 0.16);
    chevron.lineTo(0, -0.03);
    chevron.lineTo(0.20, 0.16);
    chevron.lineTo(0.20, 0.04);
    chevron.lineTo(0, -0.15);
    chevron.lineTo(-0.20, 0.04);
    chevron.closePath();
    const marker = new THREE.Mesh(new THREE.ShapeGeometry(chevron),
      new THREE.MeshBasicMaterial({ color: world.theme.iron, opacity: 0.55, transparent: true, side: THREE.DoubleSide }));
    marker.rotation.order = 'YXZ';
    marker.rotation.x = -Math.PI / 2;
    marker.rotation.y = Math.atan2(nextX - x, nextZ - z);
    marker.position.set(...center);
    scene.add(marker);
  }
}

function drawGate(world, scene, [x, , z]) {
  const { k } = world;
  const gate = new THREE.Group();
  gate.position.set(x + 0.25, 0.01, z);
  for (const sign of [-1, 1]) {
    k.box(gate, [0.44, 0.14, 0.34], [0, 0.07, sign * 0.48], 'iron');
    k.drum(gate, [0.19, 0.25, 0.89, 4], [0, 0.54, sign * 0.48], 'wall',
      { rotation: [0, Math.PI / 4, 0] });
    k.box(gate, [0.40, 0.09, 0.40], [0, 1.01, sign * 0.48], 'stone');
  }
  k.box(gate, [0.28, 0.24, 1.16], [0, 0.86, 0], 'stone');
  k.box(gate, [0.29, 0.05, 0.46], [0, 0.91, 0], 'accent');
  scene.add(gate);
}

function drawDecorations(world, scene, map, gridPosition) {
  const { id, k, theme } = world;
  const reserved = new Set([...map.pathCells.map(String), ...map.slots.map(({ x, y }) => String([x, y])),
    ...map.decorations.flatMap(({ cells }) => cells.map(String))]);
  for (const [group, cells] of rimGroves.entries()) {
    for (const [index, cell] of cells.entries()) {
      if (reserved.has(String(cell))) continue;
      const [x, , z] = gridPosition(cell);
      const rear = cell[1] <= 1;
      const tall = index === 0 || (index === 2 && rear);
      const angle = group * 0.71 + index * 2.4;
      const rockHeight = tall ? 0.44 : 0.24;
      contactShadow(scene, theme.iron, [x, 0.008, z], 0.93, 0.45, 0.86);
      k.facet(scene, 'stone', 0.48, [x, rockHeight * 0.42, z],
        [0.92, rockHeight, 0.66], id === 'R08' ? 'earth' : 'wall', [-0.09, angle, 0.11]);
      k.facet(scene, 'stone', 0.29, [x + 0.32, 0.08, z - 0.10],
        [0.88, 0.53, 0.77], 'rim', [0.11, angle + 2.3, 0]);

      if (tall && (rear || group === 4 || group === 5)) {
        const trunkX = x - 0.20;
        const trunkZ = z - 0.17;
        const treeHeight = rear ? 0.96 + 0.22 * Math.sin(group + index) : 0.66;
        k.drum(scene, [0.033, 0.071, treeHeight * 0.7, 5],
          [trunkX, treeHeight * 0.35, trunkZ], 'timber', { rotation: [0, 0, -0.06] });
        for (const [shift, height, size] of [[0, 0.78, 1], [-0.17, 0.59, 0.74], [0.18, 0.65, 0.8]]) {
          k.facet(scene, 'stone', 0.39 * size, [trunkX + shift, treeHeight * height, trunkZ + shift * 0.29],
            [0.80, id === 'R08' ? 0.64 : 1.18, 0.81], shift ? 'tips' : 'leaves', [0.1, angle + shift, -shift]);
        }
      }
      for (const [offsetX, offsetZ, size] of [[-0.3, 0.19, 1], [-0.16, 0.28, 0.72], [0.19, -0.28, 0.69]]) {
        k.facet(scene, 'stone', 0.24 * size, [x + offsetX, 0.095 * size, z + offsetZ],
          [0.94, 0.66, 0.85], index === 1 ? 'tips' : 'leaves', [0, angle + offsetX, 0]);
      }
    }
  }
  for (const { kind, cells } of map.decorations) {
    for (const cell of cells) {
      const [x, , z] = gridPosition(cell);
      if (kind === 'culture') {
        k.box(scene, [0.55, 0.082, 0.48], [x, 0.041, z], 'earth', { rotation: [0, 0.25, 0] });
        k.box(scene, [0.25, 0.36, 0.14], [x, 0.21, z], 'stone', { rotation: [0.08, 0.32, -0.17] });
      } else {
        k.facet(scene, 'stone', 0.37, [x, 0.16, z], [0.92, 0.61, 0.84], id === 'R08' ? 'earth' : 'slot', [0.1, 0.52 + x, 0.08]);
        k.facet(scene, 'stone', 0.19, [x + 0.25, 0.08, z + 0.22], [0.9, 0.51, 0.72], 'rim');
      }
    }
  }
}

function pathPosition(map, progress) {
  const index = Math.floor(progress);
  const [ax, az] = map.pathCells[index];
  const [bx, bz] = map.pathCells[index + 1];
  const amount = progress - index;
  return { x: ax + (bx - ax) * amount, z: az + (bz - az) * amount, dx: bx - ax, dz: bz - az };
}

export function buildBoard(world, map, renderer, width, height) {
  const { id, theme, k } = world;
  const scene = new THREE.Scene();
  const gridPosition = ([x, z], y = 0) => [x + 0.5 - map.gridWidth / 2, y, z + 0.5 - map.gridHeight / 2];
  backdrop(world, scene, map);
  drawTerrain(world, scene, map, gridPosition);
  drawDecorations(world, scene, map, gridPosition);
  drawGate(world, scene, gridPosition(map.exitCell));

  const towerPositions = new Map();
  for (const slot of map.slots) {
    const position = gridPosition([slot.x, slot.y], 0.017);
    const [x, , z] = position;
    k.box(scene, [0.77, 0.049, 0.77], [x, 0.025, z], 'slot', { lined: false });
    k.box(scene, [0.66, 0.033, 0.66], [x, 0.051, z], 'rim', { lined: false });
    const tower = fixtures.find((item) => item.slot === slot.id);
    if (tower) {
      const model = makeTower(k, tower.id);
      model.position.set(x, 0.074, z);
      model.scale.setScalar(1.02);
      model.rotation.y = tower.turn;
      towerPositions.set(tower.id, position);
      scene.add(model);
      contactShadow(scene, theme.iron, [x + 0.07, 0.071, z - 0.034], 1.25, 0.68, 0.79);
    } else {
      k.box(scene, [0.19, 0.009, 0.034], [x, 0.073, z], 'slot', { lined: false, shadow: false });
      k.box(scene, [0.034, 0.009, 0.19], [x, 0.073, z], 'slot', { lined: false, shadow: false });
    }
  }

  const ringMaterial = new THREE.MeshBasicMaterial({ color: theme.accent, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.66, 4, 1, Math.PI / 4), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const units = formation.map(([kind, progress, offset]) => {
    const model = makeEnemy(k, kind);
    scene.add(model);
    const shadow = contactShadow(scene, theme.iron, [0, 0.014, 0], kind === 'boss' ? 1.56 : 0.89, 0.62);
    return { kind, model, progress, offset, shadow };
  });
  world.light(scene, 13);

  const perspective = id === 'R07';
  const margin = perspective ? 0.39 : 0.10;
  const x = map.gridWidth / 2 + margin;
  const z = map.gridHeight / 2 + margin;
  const foot = id === 'R06' ? -1.55 : -0.93;
  // Frame the board's visible edges and the rear trees without fitting an empty prism.
  const edges = [
    [-x, 0, -z], [x, 0, -z], [-x, 0, z], [x, 0, z],
    [-x * 0.90, foot, z * 0.93], [x * 0.90, foot, z * 0.93],
    [-x * 0.83, 1.09, -z + 0.47], [x * 0.91, 1.05, -z + 0.47],
  ].map((point) => new THREE.Vector3(...point));
  const cameraBounds = new THREE.Box3().setFromPoints(edges);
  const camera = cameraFor(width, height, cameraBounds, theme.camera, 0.967, perspective, edges);
  const projected = new THREE.Box2().setFromPoints(edges.map((point) => {
    const ndc = point.clone().project(camera);
    return new THREE.Vector2(ndc.x, ndc.y);
  }));
  const center = projected.getCenter(new THREE.Vector2());
  const size = projected.getSize(new THREE.Vector2());
  // Keep a narrow margin around the cliff skirt and the highest trees.
  const heightLimit = 1.98;
  const zoom = Math.min(1.88 / size.x, heightLimit / size.y);
  camera.zoom *= zoom;
  camera.setViewOffset(width, height, center.x * zoom * width / 2, -center.y * zoom * height / 2, width, height);
  renderer.setSize(width, height, false);
  world.setInkSize(width, height, width < 620 ? 1.5 : 2.6);
  const post = id === 'R07' ? makeTiltShift(renderer, scene, camera, width, height) : null;

  return {
    unitCount: units.length,
    select(tower) {
      const [x, , z] = towerPositions.get(tower);
      ring.position.set(x, 0.078, z);
      ring.visible = true;
    },
    render(time) {
      for (const { kind, model, progress, offset, shadow } of units) {
        const { x, z, dx, dz } = pathPosition(map, (progress + time * 0.54) % map.pathLength);
        const [px, , pz] = gridPosition([x + dz * offset, z - dx * offset]);
        const lift = kind === 'shard' ? 0.08 : 0.0;
        const trail = pathTop(x, z);
        model.position.set(px, trail + lift + Math.abs(Math.sin(time * 6.0 + progress)) * 0.018, pz);
        model.rotation.y = Math.atan2(dx, dz);
        shadow.position.set(px + 0.065, trail + 0.008, pz - 0.045);
      }
      if (post) post.render();
      else renderer.render(scene, camera);
    },
  };
}
