import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { kit } from './models.js';

export const themes = {
  R06: {
    sky: '#cedbd8', ground: '#7f9690', stone: '#e5dcc4', iron: '#2d4145', enemy: '#647379', accent: '#a95b43',
    camera: [-2.8, 16, 13], light: 2.15, ambient: 1.75, name: '바람섬',
  },
  R07: {
    sky: '#241e1a', ground: '#666d52', stone: '#d9c7a5', iron: '#35342b', enemy: '#62574b', accent: '#a56f52',
    camera: [3.4, 15, 13], light: 2.7, ambient: 1.5, name: '작업대',
  },
  R08: {
    sky: '#d4dcce', ground: '#d9b285', stone: '#f3e4c6', iron: '#262823', enemy: '#575b51', accent: '#9b4531',
    camera: [3.1, 15, 13], light: 2.05, ambient: 1.37, name: '모래 협곡',
  },
};

function materialsFor(id) {
  const theme = themes[id];
  const color = (name) => new THREE.Color(theme[name]);
  const palette = {
    grass: color('ground'), path: color('stone'), stone: color('stone'), iron: color('iron'),
    wall: color('stone').lerp(color('ground'), 0.28), metal: color('iron').lerp(color('stone'), 0.28),
    earth: color('ground').lerp(color('enemy'), 0.48), rim: color('ground').lerp(color('stone'), 0.41),
    slot: color('ground').lerp(color('iron'), 0.38), enemy: color('enemy'), accent: color('accent'),
    void: color('iron').multiplyScalar(0.4),
  };
  const levels = new THREE.DataTexture(new Uint8Array([80, 160, 244]), 3, 1, THREE.RedFormat);
  levels.minFilter = THREE.NearestFilter;
  levels.magFilter = THREE.NearestFilter;
  levels.needsUpdate = true;

  return Object.fromEntries(Object.entries(palette).map(([name, color]) => {
    const material = id === 'R08'
      ? new THREE.MeshToonMaterial({ color, gradientMap: levels })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.94, flatShading: true });
    return [name, material];
  }));
}

export function makeWorld(id) {
  const theme = themes[id];
  const materials = materialsFor(id);
  const ink = id === 'R08'
    ? new THREE.LineBasicMaterial({ color: theme.iron, transparent: true, opacity: 0.82 })
    : null;
  const k = kit(materials, ink);
  const light = (scene, span) => {
    scene.add(new THREE.HemisphereLight('#fff8e7', theme.ground, theme.ambient));
    const key = new THREE.DirectionalLight(id === 'R07' ? '#ffe8ce' : '#fff5e8', theme.light);
    key.position.set(-span * 0.78, span * 1.22, span * 0.62);
    if (id === 'R07') {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: span * 4 });
      key.shadow.bias = -0.00025;
      key.shadow.normalBias = 0.065;
    }
    scene.add(key);
  };
  return { id, theme, materials, ink, k, light };
}

export function cameraFor(width, height, bounds, direction, margin, perspective = false) {
  const target = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const aspect = width / height;
  const camera = perspective
    ? new THREE.PerspectiveCamera(32, aspect, 0.05, 160)
    : new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.05, 160);
  const ray = new THREE.Vector3(...direction).normalize();
  const orient = (distance) => {
    camera.position.copy(target).addScaledVector(ray, distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };
  const corners = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        corners.push(target.clone().add(new THREE.Vector3(x * size.x / 2, y * size.y / 2, z * size.z / 2)));
      }
    }
  }
  if (perspective) {
    let distance = size.length() * 1.05;
    for (let i = 0; i < 16; i++) {
      orient(distance);
      const extent = Math.max(...corners.map((p) => {
        const q = p.clone().project(camera);
        return Math.max(Math.abs(q.x), Math.abs(q.y));
      }));
      if (extent <= margin) break;
      distance *= 1.065;
    }
  } else {
    orient(size.length() * 1.55);
    const projected = corners.map((p) => p.clone().project(camera));
    const extent = Math.max(...projected.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) / margin;
    Object.assign(camera, {
      left: -extent * aspect, right: extent * aspect, top: extent, bottom: -extent,
    });
    camera.updateProjectionMatrix();
  }
  return camera;
}

export function makeRenderer(world) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0, 0);
  renderer.shadowMap.enabled = world.id === 'R07';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

// Screen-space tilt-shift, with the focus band covering the playable board.
export function makeTiltShift(renderer, scene, camera, width, height) {
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const blur = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, pixel: { value: new THREE.Vector2(1 / width, 1 / height) } },
    vertexShader: `
      varying vec2 uvOnScreen;
      void main() {
        uvOnScreen = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 pixel;
      varying vec2 uvOnScreen;
      void main() {
        float distanceFromFocus = abs(uvOnScreen.y - 0.54 - (uvOnScreen.x - 0.5) * 0.11);
        float radius = 3.9 * smoothstep(0.26, 0.53, distanceFromFocus);
        vec4 sampleSum = vec4(0.0);
        for (int y = -1; y <= 1; ++y) {
          for (int x = -1; x <= 1; ++x) {
            vec2 offset = vec2(float(x), float(y)) * radius * pixel;
            float weight = 1.0 / (1.0 + length(vec2(float(x), float(y))));
            sampleSum += texture2D(tDiffuse, uvOnScreen + offset) * weight;
          }
        }
        gl_FragColor = sampleSum / (3.0 + 4.0 / (1.0 + sqrt(2.0)));
      }
    `,
  });
  composer.addPass(blur);
  composer.addPass(new OutputPass());
  return composer;
}

const contactMaps = new Map();

export function contactShadow(scene, color, position, width, opacity = 0.3, ratio = 0.64) {
  if (!contactMaps.has(color)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const falloff = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    falloff.addColorStop(0, color);
    falloff.addColorStop(0.44, color + '97');
    falloff.addColorStop(1, color + '00');
    ctx.fillStyle = falloff;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    contactMaps.set(color, texture);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * ratio),
    new THREE.MeshBasicMaterial({ map: contactMaps.get(color), transparent: true, opacity, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(...position);
  scene.add(mesh);
  return mesh;
}

export function modelBounds(model, turn) {
  model.rotation.y = turn;
  return new THREE.Box3().setFromObject(model);
}

export function modelPreview(renderer, world, model, canvas, { pad = true, turn = 0, margin = 0.92, frame } = {}) {
  const { id, theme, k, light } = world;
  const scene = new THREE.Scene();
  scene.add(model);
  const actual = modelBounds(model, turn);
  const bounds = frame ? frame.clone() : actual.clone();
  bounds.min.y = Math.min(bounds.min.y, 0);
  if (pad) {
    const radius = Math.max(actual.max.x - actual.min.x, actual.max.z - actual.min.z) * 0.62;
    k.drum(scene, [radius * 0.94, radius, 0.10, 8], [0, -0.055, 0], id === 'R07' ? 'iron' : 'rim');
    contactShadow(scene, theme.iron, [0, 0.008, 0], radius * 1.8, 0.45);
    bounds.min.y = -0.12;
  }
  light(scene, 3);
  const width = canvas.width;
  const height = canvas.height;
  const camera = cameraFor(width, height, bounds, [4, 4.2, 7.4], margin);
  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
  canvas.getContext('2d').drawImage(renderer.domElement, 0, 0);
}

export function woodTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < 520; y += 2) {
    const knot = Math.sin(y * 0.31) * Math.cos(y * 0.019);
    ctx.strokeStyle = knot > 0 ? 'rgba(245,225,190,0.065)' : 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    for (let x = 0; x <= 768; x += 8) {
      const offset = 1.0 * Math.sin(x * 0.018 + y * 0.064) + 2.4 * knot * Math.sin(x * 0.005 + y * 0.018);
      ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
  for (const y of [82, 208, 354, 456]) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, y, 768, 2);
    ctx.fillStyle = 'rgba(245,225,190,0.10)';
    ctx.fillRect(0, y + 2, 768, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
