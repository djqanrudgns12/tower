import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { BranchId, TowerId } from '../../contracts/balance';
import type { OptionId } from '../../contracts/questions';
import type { RunController } from '../../application/RunController';
import { FieldBridgeHandle, type FieldSelection, type FieldTap } from '../../game/bridge';
import { PhaserBattlefield } from '../../game/PhaserBattlefield';
import type { FontScale } from '../../application/session';
import { DEFAULTS } from '../../content';
import { SoundDirector } from '../audio/sound';
import { commandErrorText } from '../copy';
import kit from '../kit.module.css';
import { useLayout } from '../useLayout';
import css from './GameScreen.module.css';
import { Hud } from './Hud';
import { ManagementPanel, type PanelMode } from './ManagementPanel';
import { PauseOverlay } from './PauseOverlay';
import { QuestionPanel } from './QuestionPanel';
import { practiceCoach } from './practiceCoach';
import { nextSlot, SlotList, slotDescription, type Arrow } from './SlotList';

interface Props {
  controller: RunController;
  towers: readonly TowerId[];
  notice: string | null;
  fontScale: FontScale;
  reducedMotion: boolean;
  soundOn: boolean;
  onFont(scale: FontScale): void;
  onSound(on: boolean): void;
  onExit(reason: 'saved' | 'over' | 'abandon'): void;
  /** 첫 연습 판(PRD §12.2). 있으면 안내 문장·건너뛰기·연습 끝 패널을 보인다. */
  practice?: { onFinish(next: 'new' | 'again' | 'home'): void };
}

const EMPTY: FieldSelection = { slotId: null, towerId: null, previewType: null, previewBranch: null };

export function GameScreen({ controller, towers, notice, fontScale, reducedMotion, soundOn, onFont, onSound, onExit, practice }: Props) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  // 소리는 도메인 사건을 듣기만 한다. 브라우저 규칙상 첫 입력 뒤에 켠다(PRD §11.5).
  const [sound] = useState(() => new SoundDirector(DEFAULTS.audio, controller.ctx.balance.waves.bossEveryWaves));
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const off = controller.onEvents(events => sound.handle(events));
    return () => { off(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); sound.dispose(); };
  }, [controller, sound]);
  useEffect(() => { sound.setEnabled(soundOn); }, [sound, soundOn]);
  useEffect(() => { sound.setPaused(view.pause.length > 0 || view.phase === 'GAME_OVER'); }, [sound, view.pause.length, view.phase]);
  const layout = useLayout();
  const [rawSelection, setSelection] = useState<FieldSelection>(EMPTY);
  const [rawMode, setMode] = useState<PanelMode>('idle');
  const [trayOpen, setTrayOpen] = useState(false);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  // 전장 키보드 커서(PRD §12.4). 포커스가 전장에 있을 때만 그린다.
  const [cursor, setCursor] = useState<string | null>(null);
  const [fieldFocused, setFieldFocused] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
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
  const keyboardSlotId = fieldFocused ? cursor : null;
  useLayoutEffect(() => { bridge.update({ selection, magnify, keyboardSlotId, reducedMotion, onTap, onIcons: setIcons }); }, [bridge, selection, magnify, keyboardSlotId, reducedMotion, onTap]);

  const pickSlot = useCallback((slotId: string) => {
    const tower = view.towers.find(t => t.slotId === slotId);
    onTap(tower ? { kind: 'tower', towerId: tower.id, slotId } : { kind: 'slot', slotId });
  }, [view.towers, onTap]);

  const onFieldKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const slots = controller.ctx.map.slots;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setCursor(c => nextSlot(slots, c, e.key as Arrow));
    } else if ((e.key === 'Enter' || e.key === ' ') && cursor) {
      e.preventDefault();
      pickSlot(cursor);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clear();
    }
  };
  const onFieldFocus = () => {
    setFieldFocused(true);
    // 처음 들어오면 선택한 자리, 없으면 첫 자리에서 시작한다.
    setCursor(c => c ?? selection.slotId ?? view.towers.find(t => t.id === selection.towerId)?.slotId ?? controller.ctx.map.slots[0]?.id ?? null);
  };

  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  useEffect(() => { if (view.phase === 'GAME_OVER') { const t = setTimeout(() => onExit('over'), 900); return () => clearTimeout(t); } return undefined; }, [view.phase, onExit]);

  // 연습은 첫 웨이브를 지키고 성문이 회복되면 끝난다. 다음 준비로 넘어가지 않게 루프를 멈춘다.
  const practiceDone = !!practice && view.completedWave >= 1;
  useEffect(() => { if (practiceDone) controller.stop(); }, [practiceDone, controller]);
  const coach = practice ? practiceCoach(view, selection) : null;
  const coachLine = (at: NonNullable<typeof coach>['at']) => (coach?.at === at ? <p className={css.coach} role="status">{coach.text}</p> : null);
  // 연습이 끝나면 관리 패널(다음 웨이브 잠금 문구 등) 대신 한 줄만 둔다.
  const practiceRest = <p className={kit.muted}>연습이 끝났어요. 아래에서 다음 할 일을 골라요.</p>;
  const skip = practice && !practiceDone ? <button type="button" className={`${kit.button} ${kit.quiet}`} onClick={() => practice.onFinish('home')}>연습 건너뛰기</button> : null;

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

  // 목록에서 고르면 관리 패널의 첫 조작으로 포커스를 옮긴다. 목록 아래에 있던 학생이 위로 찾아 올라가지 않게 한다.
  const pickFromList = (slotId: string) => {
    pickSlot(slotId);
    if (layout.mode === 'S') setTrayOpen(true);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus());
  };
  const slotList = (
    <SlotList
      ctx={controller.ctx} view={view} towers={towers} onPick={pickFromList}
      selectedSlotId={selection.slotId ?? view.towers.find(t => t.id === selection.towerId)?.slotId ?? null}
    />
  );

  const bottom = practiceDone ? (
    <section className={`${kit.board} ${css.build}`} aria-label="연습 끝">
      <div>
        <p className={css.buildTitle}>연습을 마쳤어요</p>
        <p className={kit.muted}>성문이 다시 가득 찼어요. 문제를 풀어 골드를 모으고, 타워로 성문을 지키면 돼요.</p>
      </div>
      <div className={css.row}>
        <button type="button" className={`${kit.button} ${kit.primary} ${kit.big}`} onClick={() => practice.onFinish('new')}>새 게임 시작</button>
        <button type="button" className={kit.button} onClick={() => practice.onFinish('again')}>연습 다시 하기</button>
      </div>
    </section>
  ) : view.phase === 'BUILD' ? (
    <section className={`${kit.board} ${css.build}`} aria-label="전투 준비">
      <div>
        <p className={css.buildTitle}>{view.wave}웨이브 준비 완료</p>
        {coach?.at === 'start' ? coachLine('start') : <p className={kit.muted}>{view.towers.length === 0 ? '빈 돌 받침을 눌러 첫 타워를 놓아 보세요.' : '타워를 더 놓거나 강화한 뒤 전투를 시작하세요.'}</p>}
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
      {coachLine('question')}
      <QuestionPanel question={view.question} wide={layout.wideQuestion} onAnswer={onAnswer} onSkip={onSkip} onNext={onNext} />
    </div>
  ) : view.phase === 'GAME_OVER' ? (
    <section className={`${kit.board} ${css.build}`}><p className={css.buildTitle}>{view.endReason === 'DEFEAT' ? '성문이 무너졌어요.' : '이번 판을 마쳤어요.'}</p></section>
  ) : null;

  const field = (
    <div className={css.field} style={{ width: layout.mapW, height: layout.mapH }}>
      <PhaserBattlefield
        bridge={bridge} width={layout.mapW} height={layout.mapH} label={`전장: 웨이브 ${view.wave}, 성문 ${view.gateHp}/${view.gateMaxHp}, 타워 ${view.towers.length}개`}
        hintId="field-keys" onKeyDown={onFieldKey} onFocus={onFieldFocus} onBlur={() => setFieldFocused(false)}
      />
      <p id="field-keys" className="sr-only">화살표로 설치 자리를 옮기고 Enter로 고릅니다. Esc는 선택을 풉니다.</p>
      <p className="sr-only" aria-live="polite">{keyboardSlotId ? slotDescription(controller.ctx, view, keyboardSlotId) : ''}</p>
      <div className={css.notices} aria-live="polite">
        {view.notices.map(n => <p key={n.id} className={css.notice} data-tone={n.tone}>{n.text}</p>)}
      </div>
      {magnify && <button type="button" className={`${kit.button} ${css.fullMap}`} onClick={clear}>전체 지도</button>}
      {coach?.at === 'field' && <div className={css.coachField}>{coachLine('field')}</div>}
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
              <div className={css.railBody}>{practiceDone ? practiceRest : <>{skip}{coachLine('panel')}<div ref={panelRef}>{panel}</div><p className={kit.reason} role="status">{flash}</p>{slotList}</>}</div>
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
              {skip}
              <span className={kit.muted}>{selection.towerId !== null ? '선택한 타워' : selection.slotId ? '빈 자리 선택됨' : view.phase === 'BATTLE' ? '전투 중에도 설치·강화할 수 있어요' : ''}</span>
            </div>
            {trayOpen && <div className={`${kit.board} ${css.tray}`}>{practiceDone ? practiceRest : <>{coachLine('panel')}<div ref={panelRef}>{panel}</div><p className={kit.reason} role="status">{flash}</p>{slotList}</>}</div>}
            {bottom}
          </>
        )}
      </main>
      {paused && view.phase !== 'GAME_OVER' && (
        <PauseOverlay
          reasons={view.pause} renderLost={view.renderLost} canSave={controller.persist} fontScale={fontScale} soundOn={soundOn} saveError={view.saveStatus === 'error'}
          onResume={() => controller.resume()} onFont={onFont} onSound={onSound}
          onSaveExit={async () => { const ok = await controller.saveAndExit(); if (ok) onExit('saved'); return ok; }}
          onRetrySave={() => controller.retrySave()}
          onQuit={() => { controller.resume(); controller.dispatch({ type: 'quit' }); }}
          onLeaveUnsaved={() => onExit('abandon')}
        />
      )}
    </>
  );
}

