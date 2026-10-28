import Phaser from 'phaser';
import { useEffect, useRef, type FocusEventHandler, type KeyboardEventHandler } from 'react';
import { WORLD_H, WORLD_W } from './assets';
import { BattleScene } from './BattleScene';
import type { FieldBridge } from './bridge';

interface Props {
  bridge: FieldBridge; width: number; height: number; label: string;
  /** 전장 키보드(PRD §12.4). 화살표·Enter·Esc는 화면이 처리한다. */
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>; onFocus?: FocusEventHandler<HTMLDivElement>; onBlur?: FocusEventHandler<HTMLDivElement>; hintId?: string;
}

/**
 * Phaser Game 인스턴스는 이 컴포넌트가 하나만 만들고 언마운트 때 파괴한다.
 * StrictMode의 이중 effect에서도 생성→파괴→생성으로 정리된다(공식 React 템플릿의 단일 인스턴스 패턴).
 */
export function PhaserBattlefield({ bridge, width, height, label, onKeyDown, onFocus, onBlur, hintId }: Props) {
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
    // 문맥 손실·복구(PRD §12.7). Phaser가 텍스처를 되살린 뒤 RESTORE_WEBGL을 보낸다. 임시 그림도 캔버스 원본이라 함께 돌아온다.
    const watchRenderer = () => {
      const renderer = instance.renderer;
      renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, () => bridge.controller.rendererLost());
      renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => bridge.controller.rendererRestored());
    };
    if (instance.isBooted) watchRenderer();
    else instance.events.once(Phaser.Core.Events.BOOT, watchRenderer);
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

  // data-keyscope: 전장에 포커스가 있을 때 문항의 1~4 단축키가 답을 내지 않게 구분한다.
  return (
    <div
      ref={host} role="application" aria-roledescription="전장" aria-label={label} aria-describedby={hintId} tabIndex={0} data-keyscope="field"
      onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} style={{ width, height, touchAction: 'none', lineHeight: 0 }}
    />
  );
}
