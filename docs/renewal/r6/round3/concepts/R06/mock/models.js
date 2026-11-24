import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const towers = [
  { id: 'archer', name: '석궁탑', cost: 40, role: '빠른 단일 공격' },
  { id: 'cannon', name: '포대', cost: 65, role: '범위 공격' },
  { id: 'spire', name: '수정탑', cost: 55, role: '적의 이동 둔화' },
  { id: 'relay', name: '나팔탑', cost: 50, role: '가까운 타워 지원' },
];

export const enemies = [
  { id: 'golem', name: '층암 골렘', role: '갑옷을 두른 중장형' },
  { id: 'scarab', name: '현무암 갑충', role: '지면을 타는 돌진형' },
  { id: 'hound', name: '흑연 사냥개', role: '낮은 자세의 고속형' },
  { id: 'shard', name: '쐐기 수정체', role: '떠다니는 수정형' },
  { id: 'boss', name: '단층 거수', role: '등에 석판을 겹친 보스' },
];

const geometries = new Map();

export function shape(kind, dimensions) {
  const key = [kind, ...dimensions].join(':');
  if (!geometries.has(key)) {
    const constructors = {
      box: THREE.BoxGeometry,
      cylinder: THREE.CylinderGeometry,
      shard: THREE.OctahedronGeometry,
      stone: THREE.DodecahedronGeometry,
      wedge: THREE.TetrahedronGeometry,
      oval: THREE.SphereGeometry,
    };
    geometries.set(key, new constructors[kind](...dimensions));
  }
  return geometries.get(key);
}

export function kit(materials, ink, bevel) {
  const hulls = new WeakMap();
  const add = (parent, geometry, color, at, { scale, rotation, lined = true, shadow = true } = {}) => {
    const mesh = new THREE.Mesh(geometry, materials[color]);
    mesh.position.set(...at);
    if (scale) mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (ink && lined) {
      if (!hulls.has(geometry)) {
        // The lit mesh keeps its facets. Shared corners give the ink shell continuous normals.
        const shell = new THREE.BufferGeometry();
        shell.setAttribute('position', geometry.getAttribute('position'));
        shell.setIndex(geometry.getIndex());
        const welded = mergeVertices(shell);
        welded.computeVertexNormals();
        hulls.set(geometry, welded);
      }
      mesh.add(new THREE.Mesh(hulls.get(geometry), ink));
    }
    return mesh;
  };
  return {
    add,
    box(parent, dimensions, at, color, opts = {}) {
      const radius = Math.min(0.050, Math.min(...dimensions) * 0.20);
      const key = ['bevel', ...dimensions].join(':');
      const rounded = bevel && !opts.square && radius >= 0.012;
      if (rounded && !geometries.has(key)) {
        geometries.set(key, new RoundedBoxGeometry(...dimensions, 1, radius));
      }
      return add(parent, rounded ? geometries.get(key) : shape('box', dimensions), color, at, opts);
    },
    drum: (parent, dimensions, at, color, opts) => add(parent, shape('cylinder', dimensions), color, at, opts),
    facet: (parent, kind, radius, at, scale, color, rotation) =>
      add(parent, shape(kind, [radius, 0]), color, at, { scale, rotation }),
    oval: (parent, at, scale, color, rotation) =>
      add(parent, shape('oval', [1, 12, 8]), color, at, { scale, rotation }),
  };
}

function brace(parent, kit, start, end, width, color, depth = width) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const center = a.clone().lerp(b, 0.5);
  const strut = kit.box(parent, [width, a.distanceTo(b), depth], center.toArray(), color);
  strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
}

const across = [0, 0, Math.PI / 2];
const facing = [Math.PI / 2, 0, 0];

function taper(parent, k, start, end, bottom, top, color, sides = 7) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const body = k.drum(parent, [top, bottom, a.distanceTo(b), sides], a.clone().lerp(b, 0.5).toArray(), color);
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
}

function stonePlinth(parent, k, width) {
  k.box(parent, [width, 0.13, width], [0, 0.065, 0], 'earth');
  k.box(parent, [width - 0.09, 0.14, width - 0.09], [0, 0.19, 0], 'stone');
  k.box(parent, [width - 0.19, 0.07, width - 0.19], [0, 0.285, 0], 'wall');
}

function crossbow(parent, k, y, span) {
  k.box(parent, [0.19, 0.15, 0.93], [0, y, 0.02], 'timber');
  k.box(parent, [0.085, 0.06, 0.81], [0, y + 0.087, 0.11], 'metal');
  for (const side of [-1, 1]) {
    const heel = [side * 0.08, y, 0.27];
    const elbow = [side * span * 0.30, y + 0.045, 0.42];
    const tip = [side * span * 0.50, y + 0.15, 0.26];
    brace(parent, k, heel, elbow, 0.115, 'warmWood');
    taper(parent, k, elbow, tip, 0.070, 0.028, 'warmWood', 5);
    brace(parent, k, tip, [0, y + 0.10, -0.31], 0.015, 'stone');
  }
}

function archer(parent, k, level) {
  const tier = level >= 7 ? 2 : level >= 4 ? 1 : 0;
  const deck = 1.22 + 0.23 * tier;
  const foot = 0.36 + tier * 0.055;
  stonePlinth(parent, k, 0.92 + tier * 0.17);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      brace(parent, k, [x * foot, 0.25, z * foot], [x * foot * 0.70, deck + 0.03, z * foot * 0.69], 0.12, 'timber');
      k.box(parent, [0.16, 0.12, 0.16], [x * foot, 0.33, z * foot], 'metal');
    }
    brace(parent, k, [x * foot * 0.93, 0.43, -foot * 0.91], [x * foot * 0.72, deck - 0.08, foot * 0.75], 0.082, 'warmWood');
    if (tier >= 1) {
      k.box(parent, [0.19, 0.69, 0.34], [x * (foot - 0.01), 0.56, -0.24], 'stone');
      k.box(parent, [0.28, 0.20, 0.39], [x * (foot + 0.02), 0.37, -0.24], 'wall');
      brace(parent, k, [x * 0.52, 0.32, 0.12], [x * foot * 0.75, deck - 0.21, 0.05], 0.13, 'timber');
    }
  }
  k.box(parent, [0.79 + tier * 0.2, 0.12, 0.81], [0, deck, 0], 'warmWood');
  k.box(parent, [0.83 + tier * 0.2, 0.08, 0.87], [0, deck - 0.08, 0], 'iron');
  k.drum(parent, [0.25 + tier * 0.04, 0.30 + tier * 0.04, 0.16, 10], [0, deck + 0.13, 0], 'iron');
  const turret = new THREE.Group();
  turret.rotation.y = -0.12;
  parent.add(turret);
  crossbow(turret, k, deck + 0.28, 1.10 + tier * 0.24);
  if (tier < 2) return;

  for (const side of [-1, 1]) {
    k.box(parent, [0.21, 0.35, 0.40], [side * 0.47, deck + 0.19, -0.21], 'wall');
    k.box(parent, [0.085, 0.73, 0.10], [side * 0.43, deck + 0.52, -0.31], 'timber');
    k.box(parent, [0.64, 0.085, 0.49], [side * 0.30, deck + 0.83, -0.23], 'roof',
      { rotation: [0, 0, -side * 0.29] });
  }
  k.box(parent, [0.10, 0.095, 0.52], [0, deck + 0.94, -0.23], 'metal');
}

function wheel(parent, k, side) {
  const x = side * 0.39;
  k.drum(parent, [0.213, 0.213, 0.096, 12], [x, 1.00, -0.18], 'iron', { rotation: across });
  k.drum(parent, [0.174, 0.174, 0.105, 12], [x + side * 0.008, 1.00, -0.18], 'timber', { rotation: across });
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    brace(parent, k, [x + side * 0.069, 1.00, -0.18],
      [x + side * 0.069, 1.00 + 0.167 * Math.cos(angle), -0.18 + 0.167 * Math.sin(angle)], 0.034, 'warmWood');
  }
  k.drum(parent, [0.07, 0.07, 0.12, 8], [x + side * 0.050, 1.00, -0.18], 'metal', { rotation: across });
}

function cannon(parent, k) {
  stonePlinth(parent, k, 0.98);
  k.drum(parent, [0.42, 0.48, 0.37, 8], [0, 0.46, 0], 'wall');
  k.drum(parent, [0.50, 0.41, 0.13, 8], [0, 0.68, 0], 'stone');
  k.drum(parent, [0.42, 0.50, 0.085, 8], [0, 0.77, 0], 'iron');
  const carriage = new THREE.Group();
  carriage.rotation.y = 0.23;
  parent.add(carriage);
  for (const side of [-1, 1]) {
    k.box(carriage, [0.14, 0.25, 0.73], [side * 0.25, 0.95, -0.10], 'timber',
      { rotation: [0.15, 0, 0] });
    k.box(carriage, [0.13, 0.15, 0.29], [side * 0.25, 1.15, 0.04], 'warmWood');
    wheel(carriage, k, side);
  }
  k.drum(carriage, [0.08, 0.08, 0.66, 8], [0, 1.21, 0.04], 'metal', { rotation: across });
  const barrel = new THREE.Group();
  barrel.position.set(0, 1.24, 0.04);
  barrel.rotation.x = -0.45;
  carriage.add(barrel);
  k.drum(barrel, [0.158, 0.214, 0.78, 12], [0, 0, 0.11], 'iron', { rotation: facing });
  for (const [z, radius] of [[-0.24, 0.223], [0.25, 0.175], [0.49, 0.195]]) {
    k.drum(barrel, [radius, radius, 0.069, 12], [0, 0, z], 'metal', { rotation: facing });
  }
  k.drum(barrel, [0.130, 0.130, 0.013, 12], [0, 0, 0.529], 'void', { rotation: facing });
}

function crystal(parent, k, x, y, z, height, radius, lean, color) {
  const shard = new THREE.Group();
  shard.position.set(x, y, z);
  shard.rotation.set(-0.08, 0.42, lean);
  parent.add(shard);
  k.drum(shard, [radius * 0.78, radius, height * 0.63, 6], [0, height * 0.27, 0], color);
  k.drum(shard, [0, radius * 0.78, height * 0.42, 6], [0, height * 0.795, 0], color);
}

function spire(parent, k) {
  k.drum(parent, [0.49, 0.55, 0.14, 6], [0, 0.07, 0], 'earth');
  k.drum(parent, [0.37, 0.49, 0.37, 6], [0, 0.31, 0], 'stone');
  k.drum(parent, [0.41, 0.37, 0.11, 6], [0, 0.55, 0], 'wall');
  k.drum(parent, [0.36, 0.42, 0.10, 6], [0, 0.64, 0], 'iron');
  crystal(parent, k, 0, 0.65, -0.03, 1.18, 0.255, -0.11, 'gem');
  crystal(parent, k, -0.22, 0.60, 0.15, 0.70, 0.155, 0.49, 'gemDusk');
  crystal(parent, k, 0.23, 0.61, 0.09, 0.62, 0.135, -0.55, 'gem');
  for (const side of [-1, 1]) {
    brace(parent, k, [side * 0.39, 0.28, 0.18], [side * 0.34, 0.68, 0.26], 0.095, 'wall');
  }
}

function relay(parent, k) {
  stonePlinth(parent, k, 0.86);
  k.box(parent, [0.53, 0.75, 0.53], [0, 0.64, 0], 'stone');
  k.box(parent, [0.59, 0.075, 0.59], [0, 0.58, 0], 'wall');
  k.box(parent, [0.59, 0.075, 0.59], [0, 0.85, 0], 'wall');
  k.box(parent, [0.108, 0.27, 0.019], [0, 0.74, 0.269], 'void');
  k.box(parent, [0.019, 0.25, 0.098], [0.269, 0.74, 0], 'void');
  k.box(parent, [0.78, 0.105, 0.78], [0, 1.035, 0], 'wall');
  for (const side of [-1, 1]) {
    for (const other of [-1, 0, 1]) {
      const d = other * 0.28;
      const w = side * 0.31;
      k.box(parent, [0.145, 0.15, 0.145], [d, 1.14, w], 'stone');
      if (!other) k.box(parent, [0.145, 0.15, 0.145], [w, 1.14, 0], 'stone');
    }
    k.box(parent, [0.085, 0.42, 0.085], [side * 0.18, 1.33, -0.16], 'timber');
    k.box(parent, [0.085, 0.42, 0.085], [side * 0.18, 1.33, 0.14], 'timber');
  }
  k.drum(parent, [0.04, 0.43, 0.30, 4], [0, 1.63, 0], 'roof', { rotation: [0, Math.PI / 4, 0] });
  const horn = new THREE.Group();
  horn.position.set(0, 1.26, 0.11);
  horn.rotation.x = -0.21;
  parent.add(horn);
  k.drum(horn, [0.138, 0.051, 0.29, 10], [0, 0, 0.065], 'warmWood', { rotation: facing });
  k.drum(horn, [0.109, 0.109, 0.015, 10], [0, 0, 0.214], 'void', { rotation: facing });
}

export function makeTower(k, id, level = 1) {
  const model = new THREE.Group();
  ({ archer, cannon, spire, relay })[id](model, k, level);
  return model;
}

function golem(parent, k) {
  k.facet(parent, 'stone', 0.44, [0, 0.70, 0], [1.06, 1.14, 0.67], 'enemy', [0.14, 0.3, 0]);
  k.facet(parent, 'stone', 0.225, [0, 1.12, 0.16], [1, 0.75, 0.89], 'stone', [-0.04, 0.3, 0]);
  k.box(parent, [0.23, 0.044, 0.036], [0, 1.102, 0.335], 'void');
  for (const side of [-1, 1]) {
    k.box(parent, [0.043, 0.027, 0.02], [side * 0.063, 1.105, 0.357], 'accent');
    k.facet(parent, 'stone', 0.29, [side * 0.40, 0.78, 0.01], [1.00, 1.22, 1.03], 'wall', [0, side * 0.2, side * 0.3]);
    k.facet(parent, 'stone', 0.26, [side * 0.52, 0.45 + side * 0.044, 0.12], [0.87, 1.33, 1.05], 'enemy');
    k.oval(parent, [side * 0.56, 0.24 + side * 0.044, 0.19], [0.17, 0.18, 0.18], 'iron');
    k.facet(parent, 'stone', 0.27, [side * 0.23, 0.19, 0.14 + side * 0.09], [0.81, 0.81, 1.12], 'enemy');
  }
}

function scarab(parent, k) {
  k.oval(parent, [0, 0.36, -0.08], [0.36, 0.24, 0.53], 'iron');
  k.oval(parent, [0, 0.35, 0.44], [0.24, 0.17, 0.24], 'wall');
  for (const side of [-1, 1]) {
    k.oval(parent, [side * 0.153, 0.46, -0.19], [0.169, 0.27, 0.54], 'shell', [0.04, side * 0.07, side * 0.12]);
    k.oval(parent, [side * 0.171, 0.389, 0.59], [0.046, 0.048, 0.063], 'void');
    taper(parent, k, [side * 0.14, 0.39, 0.60], [side * 0.28, 0.43, 0.77], 0.065, 0.024, 'iron');
    for (const z of [-0.49, -0.12, 0.26]) {
      const joint = [side * 0.53, 0.28, z - 0.14];
      taper(parent, k, [side * 0.25, 0.39, z], joint, 0.078, 0.066, 'iron');
      taper(parent, k, joint, [side * 0.65, 0.018, z + 0.04], 0.066, 0.025, 'iron');
    }
  }
}

function hound(parent, k) {
  k.oval(parent, [0, 0.51, -0.16], [0.23, 0.24, 0.57], 'fur', [0.08, 0, 0]);
  k.oval(parent, [0, 0.53, 0.23], [0.28, 0.28, 0.35], 'fur', [-0.22, 0, 0]);
  k.oval(parent, [0, 0.70, 0.50], [0.24, 0.24, 0.28], 'fur', [-0.44, 0, 0]);
  k.oval(parent, [0, 0.69, 0.73], [0.19, 0.155, 0.25], 'fur');
  k.oval(parent, [0, 0.62, 0.93], [0.132, 0.092, 0.235], 'wall', [0.18, 0, 0]);
  k.oval(parent, [0, 0.663, 1.10], [0.091, 0.058, 0.078], 'void');
  const tail = [0.11, 0.35, -0.92];
  taper(parent, k, [0, 0.53, -0.59], tail, 0.111, 0.074, 'fur');
  taper(parent, k, tail, [0.20, 0.29, -1.21], 0.081, 0.021, 'iron');
  for (const side of [-1, 1]) {
    taper(parent, k, [side * 0.13, 0.75, 0.62], [side * 0.20, 1.01, 0.59], 0.10, 0.017, 'iron', 4);
    k.oval(parent, [side * 0.156, 0.735, 0.84], [0.039, 0.034, 0.056], 'void');
    for (const z of [-0.45, 0.31]) {
      const step = 0.14 * side * Math.sign(z);
      const knee = [side * 0.22, 0.25, z + step - (z < 0 ? 0.11 : 0)];
      const paw = [side * 0.235, 0.063, z - step];
      taper(parent, k, [side * 0.16, 0.48, z], knee, 0.114, 0.073, 'fur');
      taper(parent, k, knee, paw, 0.074, 0.047, 'iron');
      k.oval(parent, [paw[0], 0.05, paw[2] + 0.04], [0.068, 0.052, 0.102], 'fur');
    }
  }
}

function shard(parent, k) {
  k.facet(parent, 'shard', 0.51, [0, 0.65, 0], [0.84, 1.24, 0.74], 'enemy', [0.13, 0.42, 0.1]);
  k.facet(parent, 'shard', 0.27, [0.03, 0.66, 0.24], [0.74, 1.18, 0.64], 'gem', [0.13, 0.42, 0.1]);
  for (const side of [-1, 1]) {
    k.facet(parent, 'shard', 0.32, [side * 0.29, 0.42 + side * 0.09, 0.02], [0.57, 1.25, 0.68], 'iron', [0.12, 0.42, -side * 0.49]);
  }
}

function boss(parent, k) {
  k.oval(parent, [0, 0.82, -0.24], [0.72, 0.60, 1.00], 'enemy');
  k.oval(parent, [0, 0.74, 0.71], [0.49, 0.42, 0.58], 'iron', [0.30, 0, 0]);
  k.oval(parent, [0, 0.55, 1.06], [0.42, 0.22, 0.38], 'enemy');
  taper(parent, k, [0, 0.67, -0.83], [0.22, 0.24, -1.48], 0.38, 0.075, 'enemy', 6);
  for (const z of [-0.77, -0.38, 0.02, 0.39]) {
    const height = 1.23 + (z + 0.80) * 0.24;
    k.facet(parent, 'stone', 0.50, [0, height, z], [1.52, 0.62, 0.57], 'wall', [-0.48, 0.10, 0]);
    k.box(parent, [0.72, 0.11, 0.28], [0, height + 0.24, z - 0.08], 'stone', { rotation: [-0.44, 0.10, 0] });
  }
  for (const side of [-1, 1]) {
    for (const z of [-0.71, 0.49]) {
      k.facet(parent, 'stone', 0.43, [side * 0.58, 0.56, z], [0.82, 1.18, 0.96], 'iron');
      k.oval(parent, [side * 0.65, 0.12, z + 0.16], [0.26, 0.13, 0.31], 'enemy');
    }
    taper(parent, k, [side * 0.34, 0.70, 0.99], [side * 0.61, 0.73, 1.24], 0.15, 0.028, 'stone', 5);
    k.oval(parent, [side * 0.343, 0.816, 1.00], [0.047, 0.054, 0.077], 'accent');
  }
}

export function makeEnemy(k, id) {
  const model = new THREE.Group();
  ({ golem, scarab, hound, shard, boss })[id](model, k);
  // Longest ground-plane side in cells. The boss shares the same scale as the formation.
  const footprint = { golem: 0.77, scarab: 0.75, hound: 0.80, shard: 0.62, boss: 1.52 };
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(footprint[id] / Math.max(size.x, size.z));
  return model;
}
