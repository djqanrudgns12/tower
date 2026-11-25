import Phaser from 'phaser';
import type { SpinePlugin } from '@esotericsoftware/spine-phaser-v4';
import { WORLD_H, WORLD_W } from './assets';
import { BattleScene } from './BattleScene';
import type { FieldBridge } from './bridge';
import { isR6Battlefield } from './r6/manifest';
import { battlefieldDensity } from './quality';

export function startBattlefield(parent: HTMLElement, bridge: FieldBridge, signal: AbortSignal, ready: (game: Phaser.Game) => void) {
  const r6 = isR6Battlefield(bridge.controller.ctx);
  const start = (plugin?: typeof SpinePlugin) => {
    if (signal.aborted) return;
    const dpr = battlefieldDensity(bridge.controller.renderQuality.current);
    const game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width: Math.max(1, Math.round((parent.clientWidth || WORLD_W) * dpr)),
      height: Math.max(1, Math.round((parent.clientHeight || WORLD_H) * dpr)),
      backgroundColor: r6 ? '#1d242c' : '#7cbc4c',
      banner: false,
      audio: { noAudio: true },
      render: { antialias: true, powerPreference: 'default' },
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      input: { touch: { capture: false }, mouse: { preventDefaultWheel: false } },
      ...(plugin ? { plugins: { scene: [{ key: 'spine.SpinePlugin', plugin, mapping: 'spine' }] } } : {}),
      scene: [],
    });
    game.scene.add('battle', BattleScene, true, { bridge });
    // Phaser가 텍스처를 복원한 뒤 RESTORE_WEBGL을 보낸다.
    const watchRenderer = () => {
      const renderer = game.renderer;
      renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, () => bridge.controller.rendererLost());
      renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => bridge.controller.rendererRestored());
    };
    if (game.isBooted) watchRenderer();
    else game.events.once(Phaser.Core.Events.BOOT, watchRenderer);
    ready(game);
  };
  if (r6) void import('@esotericsoftware/spine-phaser-v4').then(({ SpinePlugin }) => start(SpinePlugin), () => start());
  else start();
}
