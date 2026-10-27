import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { WORLD_H, WORLD_W } from './assets';
import { BattleScene } from './BattleScene';
import type { FieldBridge } from './bridge';

interface Props { bridge: FieldBridge; width: number; height: number; label: string }

/**
 * Phaser Game 인스턴스는 이 컴포넌트가 하나만 만들고 언마운트 때 파괴한다.
 * StrictMode의 이중 effect에서도 생성→파괴→생성으로 정리된다(공식 React 템플릿의 단일 인스턴스 패턴).
 */
export function PhaserBattlefield({ bridge, width, height, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const size = useRef('');

  useEffect(() => {
    if (!host.current) return;
    size.current = '';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const instance = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: host.current,
      width: Math.max(1, Math.round(WORLD_W * dpr)),
      height: Math.max(1, Math.round(WORLD_H * dpr)),
      backgroundColor: '#7cbc4c',
      banner: false,
      audio: { noAudio: true },
      render: { antialias: true, powerPreference: 'default' },
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      input: { touch: { capture: false }, mouse: { preventDefaultWheel: false } },
      scene: [],
    });
    instance.scene.add('battle', BattleScene, true, { bridge });
    game.current = instance;
    return () => {
      instance.destroy(true);
      game.current = null;
    };
    // 브리지는 판 하나 동안 같은 객체다.
  }, [bridge]);

  useEffect(() => {
    const g = game.current;
    if (!g || width <= 0 || height <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = `${width}x${height}@${dpr}`;
    if (size.current !== key) {
      size.current = key;
      g.scale.resize(Math.round(width * dpr), Math.round(height * dpr));
      g.scale.setZoom(1 / dpr);
    }
    // 선택·확대가 바뀌는 렌더마다 카메라만 다시 맞춘다.
    const scene = g.scene.getScene('battle') as BattleScene | null;
    if (scene?.sys.isActive()) scene.layout();
  });

  return <div ref={host} role="img" aria-label={label} style={{ width, height, touchAction: 'none', lineHeight: 0 }} />;
}
