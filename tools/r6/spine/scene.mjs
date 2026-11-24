/* global window, document */
import Phaser from 'phaser';

const WIDTH = 768;
const HEIGHT = 624;
const CLIPS = ['walk', 'hit', 'fall'];

export function runGame(adapter) {
  const count = Number(new URLSearchParams(window.location.search).get('count') ?? 120);
  if (!Number.isInteger(count) || count < 4 || count > 120) throw new Error('개체 수는 4~120이 필요합니다.');
  new Phaser.Game({
    type: Phaser.WEBGL,
    width: WIDTH,
    height: HEIGHT,
    parent: 'stage',
    backgroundColor: '#1D242C',
    audio: { noAudio: true },
    plugins: adapter.plugins,
    scene: {
      preload() {
        this.load.on('loaderror', (file) => { window.r6Error = `로드 실패 · ${file.src}`; });
        adapter.preload?.(this);
      },
      create() {
        prepare(this, adapter, count).catch((error) => { window.r6Error = error.stack; });
      },
    },
  });
}

async function prepare(scene, adapter, count) {
  const grid = scene.add.graphics();
  for (let i = 0; i < count; i++) {
    const x = 32 + 64 * (i % 12);
    const y = 54 + 60 * Math.floor(i / 12);
    grid.fillStyle(i % 2 ? 0x12161b : 0x26303a).fillRoundedRect(x - 27, y - 47, 54, 54, 4);
    grid.fillStyle(0x4a5563).fillRect(x - 17, y + 2, 34, 1);
  }
  const loaded = await adapter.start?.(scene);
  const units = [];
  for (let i = 0; i < count; i++) {
    const x = 32 + 64 * (i % 12);
    const y = 54 + 60 * Math.floor(i / 12);
    units.push(await adapter.add(scene, x, y, i % 4, loaded));
  }
  const play = (name, offset = true) => {
    units.forEach((unit, i) => unit(name, offset ? (i % 11) / 30 : 0));
  };
  play('walk');
  document.querySelectorAll('button').forEach((button, i) => {
    button.addEventListener('click', () => play(CLIPS[i], false));
  });
  const renderer = scene.game.renderer;
  const gl = renderer.gl;
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  window.r6 = {
    play,
    count: units.length,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    measure(duration, beginAt) {
      return new Promise((resolve) => {
        const intervals = [];
        const cpu = [];
        const game = scene.game.events;
        let started = 0;
        let last = 0;
        let step = 0;
        let running = false;
        const beforeRender = () => { step = performance.now(); };
        const rendered = (_renderer, time) => {
          if (!started) started = time;
          if (last && running) {
            intervals.push(time - last);
            cpu.push(performance.now() - step);
          }
          last = time;
          if (!running && time - started >= beginAt) {
            running = true;
            started = time;
          }
          if (running && time - started >= duration) {
            game.off('prestep', beforeRender);
            game.off('postrender', rendered);
            resolve({ intervals, cpu });
          }
        };
        game.on('prestep', beforeRender);
        game.on('postrender', rendered);
      });
    },
  };
  document.querySelector('#status').textContent = `${count}개체 · ${Phaser.VERSION}`;
}
