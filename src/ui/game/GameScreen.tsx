import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { BranchId, TowerId } from '../../contracts/balance';
import type { OptionId } from '../../contracts/questions';
import type { RunController } from '../../application/RunController';
import { FieldBridgeHandle, type FieldSelection, type FieldTap } from '../../game/bridge';
import { PhaserBattlefield } from '../../game/PhaserBattlefield';
import type { FontScale } from '../../application/session';
import { commandErrorText } from '../copy';
import kit from '../kit.module.css';
import { useLayout } from '../useLayout';
import css from './GameScreen.module.css';
import { Hud } from './Hud';
import { ManagementPanel, type PanelMode } from './ManagementPanel';
import { PauseOverlay } from './PauseOverlay';
import { QuestionPanel } from './QuestionPanel';

interface Props {
  controller: RunController;
  towers: readonly TowerId[];
  notice: string | null;
  fontScale: FontScale;
  reducedMotion: boolean;
  onFont(scale: FontScale): void;
  onExit(reason: 'saved' | 'over' | 'abandon'): void;
}

const EMPTY: FieldSelection = { slotId: null, towerId: null, previewType: null, previewBranch: null };

export function GameScreen({ controller, towers, notice, fontScale, reducedMotion, onFont, onExit }: Props) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  const layout = useLayout();
  const [rawSelection, setSelection] = useState<FieldSelection>(EMPTY);
  const [rawMode, setMode] = useState<PanelMode>('idle');
  const [trayOpen, setTrayOpen] = useState(false);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const paused = view.pause.length > 0;
  // 선택한 타워가 팔리거나 사라지면 선택이 없는 것으로 본다(렌더 중 파생, effect로 setState하지 않음).
  const towerGone = rawSelection.towerId !== null && !view.towers.some(t => t.id === rawSelection.towerId);
  const selection = towerGone ? EMPTY : rawSelection;
  const mode: PanelMode = towerGone ? 'idle' : rawMode;
  const hasSelection = selection.slotId !== null || selection.towerId !== null;
  const magnify = layout.cell < layout.magnifyBelow && hasSelection;

  const clear = useCallback(() => { setSelection(EMPTY); setMode('idle'); }, []);

  const onTap = useCallback((tap: FieldTap) => {
    setFlash(null);
    if (tap.kind === 'empty') { clear(); return; }
    setTrayOpen(true);
    if (tap.kind === 'tower') { setSelection({ ...EMPTY, towerId: tap.towerId }); setMode('tower'); return; }
    setSelection(prev => ({ ...EMPTY, slotId: tap.slotId, previewType: prev.previewType }));
    setMode('slot');
  }, [clear]);

  // 브리지는 판 하나 동안 같은 객체. Phaser는 매 프레임 selection·magnify를 읽는다.
  const [bridge] = useState(() => new FieldBridgeHandle(controller));
  useLayoutEffect(() => { bridge.update({ selection, magnify, reducedMotion, onTap, onIcons: setIcons }); }, [bridge, selection, magnify, reducedMotion, onTap]);

  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  useEffect(() => { if (view.phase === 'GAME_OVER') { const t = setTimeout(() => onExit('over'), 900); return () => clearTimeout(t); } return undefined; }, [view.phase, onExit]);

  const result = (r: ReturnType<RunController['dispatch']>, need?: number): r is Extract<typeof r, { ok: true }> => {
    if (!r.ok) setFlash(commandErrorText(r.error, need !== undefined ? { need } : undefined));
    else setFlash(null);
    return r.ok;
  };

  const onAnswer = useCallback((choice: OptionId) => { if (view.question) controller.dispatch({ type: 'answer', encounterId: view.question.encounterId, choice }); }, [controller, view.question]);
  const onSkip = useCallback(() => { if (view.question) controller.dispatch({ type: 'skip', encounterId: view.question.encounterId }); }, [controller, view.question]);
  const onNext = useCallback(() => { if (view.question) controller.dispatch({ type: 'next', encounterId: view.question.encounterId }); }, [controller, view.question]);

  const onBuild = () => {
    if (!selection.slotId || !selection.previewType) return;
    const r = controller.dispatch({ type: 'build', slotId: selection.slotId, tower: selection.previewType });
    if (!result(r)) return;
    // 명령은 다음 틱에 반영되지만 새 타워 번호는 미리 정해진다. 그 번호로 선택을 옮긴다.
    let builtId: number | null = null;
    for (const e of r.events) if (e.type === 'towerBuilt') builtId = e.towerId;
    // 설치하면 구매 모드를 끝내고 선택을 설치된 타워로 바꾼다. 휴대폰은 트레이를 접고 전체 지도로 돌아간다(PRD §6.3, §12.4).
    if (layout.mode === 'S') { clear(); setTrayOpen(false); }
    else if (builtId !== null) { setSelection({ ...EMPTY, towerId: builtId }); setMode('tower'); }
  };
  const onUpgrade = (branch?: BranchId) => {
    if (selection.towerId === null) return;
    if (result(controller.dispatch(branch ? { type: 'upgrade', towerId: selection.towerId, branch } : { type: 'upgrade', towerId: selection.towerId }))) {
      setSelection(s => ({ ...s, previewBranch: null }));
      setMode('tower');
    }
  };
  const onSell = () => {
    if (selection.towerId === null) return;
    if (result(controller.dispatch({ type: 'sell', towerId: selection.towerId }))) { clear(); if (layout.mode === 'S') setTrayOpen(false); }
  };
  const onStart = () => {
    if (view.towers.length === 0 && !confirmEmpty) { setConfirmEmpty(true); return; }
    setConfirmEmpty(false);
    result(controller.dispatch({ type: 'startBattle' }));
  };

  const panel = (
    <ManagementPanel
      ctx={controller.ctx} view={view} towers={towers} selection={selection} mode={mode} icons={icons} compact={layout.mode === 'S'}
      onPickType={type => { setSelection(s => ({ ...s, previewType: s.previewType === type && !s.slotId ? null : type, towerId: null })); setMode(selection.slotId ? 'slot' : 'idle'); }}
      onBuild={onBuild} onUpgrade={onUpgrade} onSell={onSell} onClear={() => { clear(); setTrayOpen(false); }}
      onPreviewBranch={branch => setSelection(s => ({ ...s, previewBranch: branch }))}
      onMode={m => setMode(m)}
    />
  );

  const bottom = view.phase === 'BUILD' ? (
    <section className={`${kit.board} ${css.build}`} aria-label="전투 준비">
      <div>
        <p className={css.buildTitle}>{view.wave}웨이브 준비 완료</p>
        <p className={kit.muted}>{view.towers.length === 0 ? '빈 돌 받침을 눌러 첫 타워를 놓아 보세요.' : '타워를 더 놓거나 강화한 뒤 전투를 시작하세요.'}</p>
      </div>
      {confirmEmpty ? (
        <div className={css.row}>
          <p>타워 없이 시작할까요?</p>
          <button type="button" className={`${kit.button} ${kit.primary}`} onClick={onStart}>시작</button>
          <button type="button" className={kit.button} onClick={() => setConfirmEmpty(false)}>취소</button>
        </div>
      ) : (
        <button type="button" className={`${kit.button} ${kit.primary} ${kit.big} ${css.start}`} onClick={onStart}>
          전투 시작
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor" /></svg>
        </button>
      )}
    </section>
  ) : view.question && !paused ? (
    <div className={css.questionWrap}>
      {view.phase === 'WAVE_WRAPUP' && <p className={css.wrapup}>전투가 끝났어요. 이 문제만 풀고 다음으로 가요.</p>}
      <QuestionPanel question={view.question} wide={layout.wideQuestion} onAnswer={onAnswer} onSkip={onSkip} onNext={onNext} />
    </div>
  ) : view.phase === 'GAME_OVER' ? (
    <section className={`${kit.board} ${css.build}`}><p className={css.buildTitle}>{view.endReason === 'DEFEAT' ? '성문이 무너졌어요.' : '이번 판을 마쳤어요.'}</p></section>
  ) : null;

  const field = (
    <div className={css.field} style={{ width: layout.mapW, height: layout.mapH }}>
      <PhaserBattlefield bridge={bridge} width={layout.mapW} height={layout.mapH} label={`전장: 웨이브 ${view.wave}, 성문 ${view.gateHp}/${view.gateMaxHp}, 타워 ${view.towers.length}개`} />
      <div className={css.notices} aria-live="polite">
        {view.notices.map(n => <p key={n.id} className={css.notice} data-tone={n.tone}>{n.text}</p>)}
      </div>
      {magnify && <button type="button" className={`${kit.button} ${css.fullMap}`} onClick={clear}>전체 지도</button>}
    </div>
  );

  return (
    <>
      <main className={`${css.screen} ${layout.mode === 'R' ? css.modeR : css.modeS}`} style={{ padding: layout.pad, gridTemplateColumns: layout.mode === 'R' ? `${layout.mapW}px 224px` : undefined }} inert={paused}>
        <h1 className="sr-only">어휘력 타워 디펜스 · {Math.max(1, view.wave)}웨이브</h1>
        {layout.mode === 'R' ? (
          <>
            {field}
            <aside className={`${kit.board} ${css.rail}`} style={{ height: layout.mapH }} aria-label="타워 관리">
              <Hud view={view} mode="R" onPause={() => controller.pause('USER')} />
              {notice && <p className={css.hint} role="status">{notice}</p>}
              <div className={css.railBody}>{panel}<p className={kit.reason} role="status">{flash}</p></div>
            </aside>
            <div className={css.bottom}>{bottom}</div>
          </>
        ) : (
          <>
            <Hud view={view} mode="S" onPause={() => controller.pause('USER')} />
            {layout.portraitHint && <p className={css.hint}>세로로 돌리면 더 편해요.</p>}
            {notice && <p className={css.hint} role="status">{notice}</p>}
            {field}
            <div className={css.toolbar}>
              <button type="button" className={kit.button} aria-expanded={trayOpen} onClick={() => setTrayOpen(o => !o)}>{trayOpen ? '관리 접기' : '타워 관리'}</button>
              <span className={kit.muted}>{selection.towerId !== null ? '선택한 타워' : selection.slotId ? '빈 자리 선택됨' : view.phase === 'BATTLE' ? '전투 중에도 설치·강화할 수 있어요' : ''}</span>
            </div>
            {trayOpen && <div className={`${kit.board} ${css.tray}`}>{panel}<p className={kit.reason} role="status">{flash}</p></div>}
            {bottom}
          </>
        )}
      </main>
      {paused && view.phase !== 'GAME_OVER' && (
        <PauseOverlay
          reasons={view.pause} canSave={controller.persist} fontScale={fontScale} saveError={view.saveStatus === 'error'}
          onResume={() => controller.resume()} onFont={onFont}
          onSaveExit={async () => { const ok = await controller.saveAndExit(); if (ok) onExit('saved'); return ok; }}
          onRetrySave={() => controller.retrySave()}
          onQuit={() => { controller.resume(); controller.dispatch({ type: 'quit' }); }}
          onLeaveUnsaved={() => onExit('abandon')}
        />
      )}
    </>
  );
}

