import * as THREE from 'three';

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
    };
    geometries.set(key, new constructors[kind](...dimensions));
  }
  return geometries.get(key);
}

export function kit(materials, ink) {
  const edges = new WeakMap();
  const add = (parent, geometry, color, at, { scale, rotation, lined = true, shadow = true } = {}) => {
    const mesh = new THREE.Mesh(geometry, materials[color]);
    mesh.position.set(...at);
    if (scale) mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (ink && lined) {
      if (!edges.has(geometry)) edges.set(geometry, new THREE.EdgesGeometry(geometry, 32));
      mesh.add(new THREE.LineSegments(edges.get(geometry), ink));
    }
    return mesh;
  };
  return {
    add,
    box: (parent, dimensions, at, color, opts) => add(parent, shape('box', dimensions), color, at, opts),
    drum: (parent, dimensions, at, color, opts) => add(parent, shape('cylinder', dimensions), color, at, opts),
    facet: (parent, kind, radius, at, scale, color, rotation) =>
      add(parent, shape(kind, [radius, 0]), color, at, { scale, rotation }),
  };
}

function brace(parent, kit, start, end, width, color, depth = width) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const center = a.clone().lerp(b, 0.5);
  const strut = kit.box(parent, [width, a.distanceTo(b), depth], center.toArray(), color);
  strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
}

function crossbow(parent, k, y, span) {
  k.box(parent, [0.16, 0.17, 0.87], [0, y, 0.1], 'iron');
  k.box(parent, [0.068, 0.045, 0.78], [0, y + 0.10, 0.18], 'metal');
  for (const side of [-1, 1]) {
    const elbow = [side * span * 0.32, y, 0.34];
    const tip = [side * span * 0.5, y, 0.11];
    brace(parent, k, [0, y, 0.25], elbow, 0.105, 'metal');
    brace(parent, k, elbow, tip, 0.075, 'metal');
    brace(parent, k, tip, [0, y + 0.035, -0.23], 0.019, 'stone');
  }
}

function archer(parent, k, level) {
  const tier = level >= 7 ? 2 : level >= 4 ? 1 : 0;
  const height = 0.85 + tier * 0.22;
  const width = 0.68 + tier * 0.15;
  k.box(parent, [width + 0.24, 0.11, width + 0.24], [0, 0.055, 0], 'iron');
  k.drum(parent, [width * 0.55, width * 0.68, height, 4], [0, height / 2, 0], 'stone', { rotation: [0, Math.PI / 4, 0] });
  k.box(parent, [width * 0.93, 0.075, width * 0.93], [0, height * 0.66, 0], 'wall');
  k.box(parent, [0.12, height * 0.3, 0.025], [0, height * 0.56, width * 0.42], 'iron');
  k.box(parent, [width + 0.18, 0.12, width + 0.18], [0, height + 0.02, 0], 'wall');
  const platform = new THREE.Group();
  platform.rotation.y = -0.31;
  parent.add(platform);
  k.drum(platform, [0.26, 0.32, 0.13, 6], [0, height + 0.14, 0], 'iron');
  crossbow(platform, k, height + 0.28, 0.91 + 0.24 * tier);
  for (const side of [-1, 1]) {
    if (tier < 1) continue;
    const x = side * width * 0.46;
    brace(parent, k, [x, 0.13, 0.24], [x, height + 0.03, -0.09], 0.17, 'wall', 0.21);
    k.box(parent, [0.15, 0.28 + tier * 0.06, 0.23], [x, height + 0.24, -0.36], 'stone');
    if (tier === 2) {
      k.box(platform, [0.22, 0.17, 0.45], [side * 0.48, height + 0.15, -0.13], 'iron');
      brace(platform, k, [side * 0.45, height + 0.31, -0.2], [side * 0.47, height + 0.66, 0.08], 0.115, 'metal');
    }
  }
  if (tier === 2) {
    k.box(platform, [1.25, 0.08, 0.39], [0, height + 0.69, -0.03], 'metal');
    k.box(platform, [0.64, 0.055, 0.29], [0, height + 0.76, -0.11], 'stone');
  }
}

function cannon(parent, k) {
  k.drum(parent, [0.52, 0.59, 0.15, 8], [0, 0.08, 0], 'iron');
  k.drum(parent, [0.42, 0.51, 0.27, 8], [0, 0.28, 0], 'stone');
  const head = new THREE.Group();
  head.rotation.y = 0.41;
  parent.add(head);
  for (const x of [-0.28, 0.28]) {
    k.box(head, [0.16, 0.37, 0.58], [x, 0.57, -0.07], 'wall', { rotation: [0.18, 0, 0] });
  }
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.63, 0.04);
  barrel.rotation.x = -0.35;
  head.add(barrel);
  k.drum(barrel, [0.17, 0.22, 0.73, 8], [0, 0, 0.12], 'metal', { rotation: [Math.PI / 2, 0, 0] });
  k.drum(barrel, [0.208, 0.208, 0.14, 8], [0, 0, 0.47], 'iron', { rotation: [Math.PI / 2, 0, 0] });
  k.drum(barrel, [0.125, 0.125, 0.008, 8], [0, 0, 0.544], 'void', { rotation: [Math.PI / 2, 0, 0] });
}

function spire(parent, k) {
  k.drum(parent, [0.48, 0.55, 0.18, 6], [0, 0.09, 0], 'iron');
  k.drum(parent, [0.26, 0.43, 0.31, 6], [0, 0.28, 0], 'wall');
  k.facet(parent, 'shard', 0.5, [0, 0.93, 0], [0.64, 1.32, 0.64], 'accent', [0.12, Math.PI / 4, 0.09]);
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const x = Math.sin(angle);
    const z = Math.cos(angle);
    brace(parent, k, [x * 0.43, 0.17, z * 0.43], [x * 0.36, 0.78, z * 0.36], 0.15, 'stone');
    brace(parent, k, [x * 0.36, 0.78, z * 0.36], [x * 0.24, 1.15, z * 0.24], 0.10, 'metal');
  }
}

function relay(parent, k) {
  k.box(parent, [0.93, 0.135, 0.8], [0, 0.067, 0], 'iron');
  const arm = new THREE.Group();
  arm.rotation.y = -0.55;
  parent.add(arm);
  for (const x of [-0.29, 0.29]) {
    brace(arm, k, [x, 0.14, 0.24], [x * 0.88, 0.97, -0.10], 0.13, 'stone', 0.19);
    brace(arm, k, [x, 0.14, -0.25], [x * 0.88, 0.97, -0.10], 0.095, 'wall');
  }
  k.box(arm, [0.73, 0.12, 0.22], [0, 0.83, -0.13], 'wall');
  const horn = new THREE.Group();
  horn.position.set(0, 0.88, 0.06);
  horn.rotation.x = -0.49;
  arm.add(horn);
  k.drum(horn, [0.32, 0.113, 0.54, 8], [0, 0, 0.08], 'metal', { rotation: [Math.PI / 2, 0, 0] });
  k.drum(horn, [0.343, 0.343, 0.06, 8], [0, 0, 0.37], 'metal', { rotation: [Math.PI / 2, 0, 0] });
  k.drum(horn, [0.263, 0.263, 0.014, 8], [0, 0, 0.406], 'iron', { rotation: [Math.PI / 2, 0, 0] });
  k.drum(horn, [0.082, 0.082, 0.02, 8], [0, 0, 0.416], 'metal', { rotation: [Math.PI / 2, 0, 0] });
}

export function makeTower(k, id, level = 1) {
  const model = new THREE.Group();
  ({ archer, cannon, spire, relay })[id](model, k, level);
  return model;
}

function visor(parent, k, at, width) {
  k.box(parent, [width, 0.043, 0.02], at, 'accent');
}

function golem(parent, k) {
  k.facet(parent, 'stone', 0.45, [0, 0.69, 0], [1.19, 1.12, 0.72], 'enemy', [0, 0.35, 0]);
  k.facet(parent, 'stone', 0.24, [0, 1.11, 0.18], [1, 0.77, 0.91], 'iron', [0, 0.3, 0]);
  visor(parent, k, [0, 1.11, 0.397], 0.25);
  for (const side of [-1, 1]) {
    k.facet(parent, 'stone', 0.34, [side * 0.48, 0.76, 0.02], [1, 1.17, 0.88], 'wall', [0, side * 0.2, side * 0.3]);
    k.facet(parent, 'stone', 0.29, [side * 0.62, 0.38, 0.1], [0.9, 1.1, 1], 'iron');
    k.box(parent, [0.3, 0.34, 0.44], [side * 0.22, 0.17, 0.10 + side * 0.1], 'enemy');
  }
}

function scarab(parent, k) {
  k.facet(parent, 'stone', 0.62, [0, 0.43, -0.14], [0.84, 0.65, 1.16], 'enemy', [0, 0.32, 0]);
  k.facet(parent, 'stone', 0.28, [0, 0.34, 0.49], [1.02, 0.72, 1.06], 'iron');
  k.box(parent, [0.045, 0.03, 0.74], [0, 0.82, -0.17], 'wall');
  visor(parent, k, [0, 0.4, 0.738], 0.30);
  for (const side of [-1, 1]) {
    for (const z of [-0.50, -0.12, 0.28]) {
      brace(parent, k, [side * 0.31, 0.39, z], [side * 0.66, 0.30, z - 0.08], 0.11, 'iron');
      brace(parent, k, [side * 0.66, 0.30, z - 0.08], [side * 0.77, 0.055, z + 0.04], 0.07, 'iron');
    }
  }
}

function hound(parent, k) {
  k.facet(parent, 'stone', 0.49, [0, 0.49, -0.1], [0.58, 0.71, 1.46], 'enemy', [0.15, 0, 0]);
  k.facet(parent, 'stone', 0.29, [0, 0.65, 0.57], [0.82, 0.7, 1.11], 'iron');
  k.box(parent, [0.22, 0.15, 0.35], [0, 0.57, 0.78], 'iron', { rotation: [0.15, 0, 0] });
  brace(parent, k, [0, 0.54, -0.58], [0, 0.58, -1.03], 0.09, 'enemy');
  for (const side of [-1, 1]) {
    k.drum(parent, [0, 0.10, 0.23, 4], [side * 0.135, 0.845, 0.52], 'iron', { rotation: [-0.35, 0, -side * 0.1] });
    k.box(parent, [0.031, 0.043, 0.096], [side * 0.202, 0.66, 0.69], 'accent');
    for (const z of [-0.45, 0.37]) {
      const step = side * 0.12 * Math.sign(z);
      brace(parent, k, [side * 0.18, 0.48, z], [side * 0.25, 0.23, z + step], 0.11, 'iron');
      brace(parent, k, [side * 0.25, 0.23, z + step], [side * 0.26, 0.055, z - step], 0.084, 'enemy');
    }
  }
}

function shard(parent, k) {
  k.facet(parent, 'shard', 0.58, [0, 0.73, 0], [0.71, 1.28, 0.65], 'enemy', [0.12, 0.42, 0.12]);
  k.facet(parent, 'shard', 0.33, [0.05, 0.75, 0.18], [0.78, 0.95, 0.64], 'accent', [0.12, 0.42, 0.12]);
  for (const side of [-1, 1]) {
    k.facet(parent, 'shard', 0.36, [side * 0.39, 0.52 + side * 0.09, -0.10], [0.53, 1.55, 0.59], 'iron', [0.12, 0.42, -side * 0.49]);
  }
}

function boss(parent, k) {
  k.facet(parent, 'stone', 0.95, [0, 0.89, -0.29], [0.83, 0.76, 1.1], 'enemy', [0.12, Math.PI / 5, 0]);
  k.facet(parent, 'stone', 0.50, [0, 0.75, 0.75], [1, 0.71, 0.97], 'iron', [0, 0.28, 0]);
  visor(parent, k, [0, 0.79, 1.145], 0.5);
  for (const z of [-0.76, -0.32, 0.12]) {
    const height = 1.64 + (z + 0.8) * 0.24;
    k.box(parent, [1.02, 0.18, 0.41], [0, height, z], 'wall', { rotation: [-0.3, 0.12, 0] });
    k.box(parent, [0.49, 0.11, 0.25], [0, height + 0.13, z - 0.04], 'metal', { rotation: [-0.3, 0.12, 0] });
  }
  for (const side of [-1, 1]) {
    for (const z of [-0.73, 0.49]) {
      k.facet(parent, 'stone', 0.45, [side * 0.64, 0.56, z], [0.76, 1.3, 0.94], 'iron');
      k.box(parent, [0.40, 0.19, 0.52], [side * 0.78, 0.105, z + 0.15], 'enemy');
    }
    brace(parent, k, [side * 0.36, 0.81, 0.88], [side * 0.67, 0.93, 1.22], 0.14, 'wall');
  }
}

export function makeEnemy(k, id) {
  const model = new THREE.Group();
  ({ golem, scarab, hound, shard, boss })[id](model, k);
  return model;
}
