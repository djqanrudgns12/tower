import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { BranchId, TowerId } from '../../contracts/balance';
import type { OptionId } from '../../contracts/questions';
import type { RunController } from '../../application/RunController';
import { FieldBridgeHandle, type FieldSelection, type FieldTap } from '../../game/bridge';
import { PhaserBattlefield } from '../../game/PhaserBattlefield';
import type { FontScale } from '../../application/session';
import { DEFAULTS } from '../../content';
import { SoundDirector } from '../audio/sound';
import { commandErrorText, fmtNumber } from '../copy';
import { PlayArrowIcon } from '../icons/GameIcons';
import kit from '../kit.module.css';
import { useLayout } from '../useLayout';
import css from './GameScreen.module.css';
import { Hud, type RecentDelta } from './Hud';
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
  bgmVolume?: number;
  sfxVolume?: number;
  highContrastMap?: boolean;
  showKeyHints?: boolean;
  onFont(scale: FontScale): void;
  onSound(on: boolean): void;
  onExit(reason: 'over' | 'abandon'): void;
  /** 첫 연습 판(PRD §12.2). 있으면 안내 문장·건너뛰기·연습 끝 패널을 보인다. */
  practice?: { onFinish(next: 'new' | 'again' | 'home'): void };
}

const EMPTY: FieldSelection = { slotId: null, towerId: null, previewType: null, previewBranch: null };

export function GameScreen({
  controller,
  towers,
  notice,
  fontScale,
  reducedMotion,
  soundOn,
  bgmVolume,
  sfxVolume,
  highContrastMap = false,
  showKeyHints = true,
  onFont,
  onSound,
  onExit,
  practice,
}: Props) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  const [recentDelta, setRecentDelta] = useState<RecentDelta | null>(null);
  const deltaTimerRef = useRef<number | null>(null);

  // 소리 및 상단 HUD 변동 배지는 도메인 사건을 구독해 갱신한다(PRD §11.5).
  const [sound] = useState(() => new SoundDirector(DEFAULTS.audio, controller.ctx.balance.waves.bossEveryWaves));
  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const off = controller.onEvents(events => {
      sound.handle(events);
      let dGold = 0;
      let dPt = 0;
      for (const e of events) {
        if (e.type === 'answered' || e.type === 'kill') {
          dGold += e.gold;
          dPt += e.pt;
        } else if (e.type === 'towerBuilt' || e.type === 'towerUpgraded' || e.type === 'towerSold') {
          dGold += e.gold;
        } else if (e.type === 'waveComplete') {
          dGold += e.milestoneGold;
        }
      }
      if (dGold !== 0 || dPt !== 0) {
        setRecentDelta({ gold: dGold, pt: dPt });
        if (deltaTimerRef.current !== null) window.clearTimeout(deltaTimerRef.current);
        deltaTimerRef.current = window.setTimeout(() => setRecentDelta(null), 1800);
      }
    });
    return () => {
      off();
      if (deltaTimerRef.current !== null) window.clearTimeout(deltaTimerRef.current);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      sound.dispose();
    };
  }, [controller, sound]);
  useEffect(() => { sound.setEnabled(soundOn); }, [sound, soundOn]);
  useEffect(() => {
    (sound as SoundDirector & { setVolumes?: (bgm: number, sfx: number) => void }).setVolumes?.(
      bgmVolume ?? DEFAULTS.audio.bgmVolume,
      sfxVolume ?? DEFAULTS.audio.sfxVolume,
    );
  }, [sound, bgmVolume, sfxVolume]);
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

  const clear = useCallback(() => {
    setSelection(EMPTY);
    setMode('idle');
  }, []);

  const onTap = useCallback((tap: FieldTap) => {
    setFlash(null);
    if (tap.kind === 'empty') {
      clear();
      return;
    }
    setTrayOpen(true);
    if (tap.kind === 'tower') {
      setSelection({ ...EMPTY, towerId: tap.towerId });
      setMode('tower');
      return;
    }
    setSelection(prev => ({ ...EMPTY, slotId: tap.slotId, previewType: prev.previewType }));
    setMode('slot');
  }, [clear]);

  // 브리지는 판 하나 동안 같은 객체. Phaser는 매 프레임 selection·magnify를 읽는다.
  const [bridge] = useState(() => new FieldBridgeHandle(controller));
  const keyboardSlotId = fieldFocused ? cursor : null;
  useLayoutEffect(() => {
    (bridge as FieldBridgeHandle & { update(next: Record<string, unknown>): void }).update({
      selection,
      magnify,
      keyboardSlotId,
      reducedMotion,
      highContrastMap,
      onTap,
      onIcons: setIcons,
    });
  }, [bridge, selection, magnify, keyboardSlotId, reducedMotion, highContrastMap, onTap]);

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

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);
  useEffect(() => {
    if (view.phase === 'GAME_OVER') {
      const t = setTimeout(() => onExit('over'), 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [view.phase, onExit]);

  // 연습은 첫 웨이브를 지키고 성문이 회복되면 끝난다. 다음 준비로 넘어가지 않게 루프를 멈춘다.
  const practiceDone = !!practice && view.completedWave >= 1;
  useEffect(() => {
    if (practiceDone) controller.stop();
  }, [practiceDone, controller]);
  const coach = practice ? practiceCoach(view, selection) : null;
  const coachLine = (at: NonNullable<typeof coach>['at']) =>
    coach?.at === at ? <p className={css.coach} role="status">{coach.text}</p> : null;
  // 연습이 끝나면 관리 패널(다음 웨이브 잠금 문구 등) 대신 한 줄만 둔다.
  const practiceRest = <p className={kit.muted}>연습이 끝났어요. 아래에서 다음 할 일을 골라요.</p>;
  const skip = practice && !practiceDone ? (
    <button type="button" className={`${kit.button} ${kit.quietWood} ${kit.block}`} onClick={() => practice.onFinish('home')}>
      연습 건너뛰기
    </button>
  ) : null;

  const result = (r: ReturnType<RunController['dispatch']>, need?: number): r is Extract<typeof r, { ok: true }> => {
    if (!r.ok) setFlash(commandErrorText(r.error, need !== undefined ? { need } : undefined));
    else setFlash(null);
    return r.ok;
  };

  const onAnswer = useCallback((choice: OptionId) => {
    if (view.question) controller.dispatch({ type: 'answer', encounterId: view.question.encounterId, choice });
  }, [controller, view.question]);
  const onSkip = useCallback(() => {
    if (view.question) controller.dispatch({ type: 'skip', encounterId: view.question.encounterId });
  }, [controller, view.question]);
  const onNext = useCallback(() => {
    if (view.question) controller.dispatch({ type: 'next', encounterId: view.question.encounterId });
  }, [controller, view.question]);

  const onBuild = () => {
    if (!selection.slotId || !selection.previewType) return;
    const r = controller.dispatch({ type: 'build', slotId: selection.slotId, tower: selection.previewType });
    if (!result(r)) return;
    // 명령은 다음 틱에 반영되지만 새 타워 번호는 미리 정해진다. 그 번호로 선택을 옮긴다.
    let builtId: number | null = null;
    for (const e of r.events) if (e.type === 'towerBuilt') builtId = e.towerId;
    // 설치하면 구매 모드를 끝내고 선택을 설치된 타워로 바꾼다. 휴대폰은 트레이를 접고 전체 지도로 돌아간다(PRD §6.3, §12.4).
    if (layout.mode === 'S') {
      clear();
      setTrayOpen(false);
    } else if (builtId !== null) {
      setSelection({ ...EMPTY, towerId: builtId });
      setMode('tower');
    }
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
    if (result(controller.dispatch({ type: 'sell', towerId: selection.towerId }))) {
      clear();
      if (layout.mode === 'S') setTrayOpen(false);
    }
  };
  const onStart = useCallback(() => {
    if (view.towers.length === 0 && !confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    setConfirmEmpty(false);
    const r = controller.dispatch({ type: 'startBattle' });
    if (!r.ok) setFlash(commandErrorText(r.error));
    else setFlash(null);
  }, [view.towers.length, confirmEmpty, controller]);

  useEffect(() => {
    if (view.phase !== 'BUILD' || paused || practiceDone || confirmEmpty) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.phase, paused, practiceDone, confirmEmpty, onStart]);

  const panel = (
    <ManagementPanel
      ctx={controller.ctx}
      view={view}
      towers={towers}
      selection={selection}
      mode={mode}
      icons={icons}
      compact={layout.mode === 'S'}
      compactRail={layout.compactRail}
      onPickType={type => {
        setSelection(s => ({ ...s, previewType: s.previewType === type && !s.slotId ? null : type, towerId: null }));
        setMode(selection.slotId ? 'slot' : 'idle');
      }}
      onBuild={onBuild}
      onUpgrade={onUpgrade}
      onSell={onSell}
      onClear={() => {
        clear();
        setTrayOpen(false);
      }}
      onPreviewBranch={branch => setSelection(s => ({ ...s, previewBranch: branch }))}
      onMode={m => setMode(m)}
    />
  );

  // 목록에서 고르면 관리 패널의 첫 타워(또는 첫 조작 단추)로 포커스를 옮긴다(PRD §12.4).
  const pickFromList = (slotId: string) => {
    pickSlot(slotId);
    if (layout.mode === 'S') setTrayOpen(true);
    requestAnimationFrame(() => {
      const root = panelRef.current;
      (root?.querySelector<HTMLElement>('[role="option"]:not(:disabled)') ?? root?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();
    });
  };
  const slotList = (
    <SlotList
      ctx={controller.ctx}
      view={view}
      towers={towers}
      onPick={pickFromList}
      selectedSlotId={selection.slotId ?? view.towers.find(t => t.id === selection.towerId)?.slotId ?? null}
    />
  );

  const emptySlots = controller.ctx.map.slots.filter(s => !view.towers.some(t => t.slotId === s.id)).length;
  const seamClass = layout.mode === 'R' ? css.seamR : css.buildStack;

  const bottom = practiceDone ? (
    <section className={`${kit.board} ${css.build} ${seamClass}`} aria-label="연습 끝">
      <div className={css.buildMain}>
        <div className={css.buildHead}>
          <span className={css.phaseBadge}>연습 완료</span>
          <p className={css.buildTitle}>연습을 마쳤어요</p>
        </div>
        <p className={kit.muted}>성문이 다시 가득 찼어요. 문제를 풀어 골드를 모으고, 타워로 성문을 지키면 돼요.</p>
      </div>
      <div className={css.buildSide}>
        <button type="button" className={`${kit.button} ${kit.primary} ${kit.big} ${kit.block}`} onClick={() => practice.onFinish('new')}>
          새 게임 시작
        </button>
        <button type="button" className={`${kit.button} ${kit.quietWood} ${kit.block}`} onClick={() => practice.onFinish('again')}>
          연습 다시 하기
        </button>
      </div>
    </section>
  ) : view.phase === 'BUILD' ? (
    <section className={`${kit.board} ${css.build} ${seamClass}`} aria-label="전투 준비">
      <div className={css.buildMain}>
        <div className={css.buildHead}>
          <span className={css.phaseBadge}>배치 단계</span>
          <p className={css.buildTitle}>{view.wave}웨이브 준비 완료</p>
        </div>
        {coach?.at === 'start' ? (
          coachLine('start')
        ) : (
          <p className={kit.muted}>
            {view.towers.length === 0
              ? '빈 돌 받침을 눌러 첫 타워를 놓아 보세요. 장착함에서 비용과 역할을 비교할 수 있어요.'
              : '타워를 더 놓거나 강화한 뒤 전투 시작을 눌러 적을 맞이하세요.'}
          </p>
        )}
        <div className={css.buildStats}>
          <span className={css.buildStatPill}>보유 골드 <strong>{fmtNumber(view.gold)}골드</strong></span>
          <span className={css.buildStatPill}>현재 점수 <strong>{fmtNumber(view.pt)}점</strong></span>
          <span className={css.buildStatPill}>설치 현황 <strong>{view.towers.length}개 · 빈칸 {emptySlots}곳</strong></span>
        </div>
      </div>
      <div className={css.buildSide}>
        <span className={css.sideCaption}>{showKeyHints ? '출격 준비함 · 단축키 엔터' : '출격 준비함'}</span>
        {confirmEmpty ? (
          <div className={css.confirmBox}>
            <p className={css.confirmText}>타워 없이 시작할까요?</p>
            <div className={css.row}>
              <button type="button" className={`${kit.button} ${kit.primary}`} onClick={onStart}>시작</button>
              <button type="button" className={`${kit.button} ${kit.quietWood}`} onClick={() => setConfirmEmpty(false)}>취소</button>
            </div>
          </div>
        ) : (
          <button type="button" className={`${kit.button} ${kit.primary} ${kit.big} ${kit.block} ${css.start}`} onClick={onStart}>
            <span>전투 시작</span>
            <PlayArrowIcon size={18} />
          </button>
        )}
        <span className={css.sideSub}>전투 중에도 문제 풀이와 타워 강화 가능</span>
      </div>
    </section>
  ) : view.question && !paused ? (
    <div className={css.questionWrap}>
      {view.phase === 'WAVE_WRAPUP' && <p className={css.wrapup}>전투가 끝났어요. 이 문제만 풀고 다음으로 가요.</p>}
      {coachLine('question')}
      <QuestionPanel
        question={view.question}
        stakes={view.stakes}
        wide={layout.wideQuestion}
        seamLock={layout.mode === 'R'}
        showKeyHints={showKeyHints}
        onAnswer={onAnswer}
        onSkip={onSkip}
        onNext={onNext}
      />
    </div>
  ) : view.phase === 'GAME_OVER' ? (
    <section className={`${kit.board} ${css.build} ${css.buildStack}`}>
      <p className={css.buildTitle}>{view.endReason === 'DEFEAT' ? '성문이 무너졌어요.' : '이번 판을 마쳤어요.'}</p>
    </section>
  ) : null;

  const field = (
    <div className={css.field} style={{ width: layout.mapW, height: layout.mapH }}>
      <PhaserBattlefield
        bridge={bridge}
        width={layout.mapW}
        height={layout.mapH}
        label={`전장: 웨이브 ${view.wave}, 성문 ${view.gateHp}/${view.gateMaxHp}, 타워 ${view.towers.length}개`}
        hintId="field-keys"
        onKeyDown={onFieldKey}
        onFocus={onFieldFocus}
        onBlur={() => setFieldFocused(false)}
      />
      <p id="field-keys" className="sr-only">화살표로 설치 자리를 옮기고 엔터로 고릅니다. Esc는 선택을 풉니다.</p>
      <p className="sr-only" aria-live="polite">{keyboardSlotId ? slotDescription(controller.ctx, view, keyboardSlotId) : ''}</p>
      <div className={css.notices} aria-live="polite">
        {view.notices.map(n => (
          <p key={n.id} className={css.notice} data-tone={n.tone}>{n.text}</p>
        ))}
      </div>
      {magnify && (
        <button type="button" className={`${kit.button} ${kit.quietWood} ${css.fullMap}`} onClick={clear}>
          전체 지도
        </button>
      )}
      {coach?.at === 'field' && <div className={css.coachField}>{coachLine('field')}</div>}
    </div>
  );

  const mainStyle: CSSProperties = layout.mode === 'R'
    ? ({
        padding: layout.pad,
        '--map-w': `${layout.mapW}px`,
        '--rail-w': `${layout.railW}px`,
      } as CSSProperties)
    : { padding: layout.pad };

  return (
    <>
      <main
        className={`${css.screen} ${layout.mode === 'R' ? css.modeR : css.modeS}`}
        style={mainStyle}
        inert={paused}
      >
        <h1 className="sr-only">어휘력 타워 디펜스 · {Math.max(1, view.wave)}웨이브</h1>
        {layout.mode === 'R' ? (
          <>
            {field}
            <aside className={`${kit.board} ${css.rail}`} style={{ height: layout.mapH }} aria-label="타워 관리">
              <Hud view={view} mode="R" compactRail={layout.compactRail} recentDelta={recentDelta} onPause={() => controller.pause('USER')} />
              {notice && <p className={css.hint} role="status">{notice}</p>}
              <div className={`${css.railBody} ${layout.compactRail ? css.railBodyCompact : ''}`}>
                {practiceDone ? (
                  practiceRest
                ) : (
                  <>
                    {skip}
                    {coachLine('panel')}
                    <div ref={panelRef}>{panel}</div>
                    {flash && <p className={kit.reason} role="status">{flash}</p>}
                    {slotList}
                  </>
                )}
              </div>
            </aside>
            <div className={css.bottom}>{bottom}</div>
          </>
        ) : (
          <>
            <Hud view={view} mode="S" recentDelta={recentDelta} onPause={() => controller.pause('USER')} />
            {layout.portraitHint && <p className={css.hint}>세로로 돌리면 더 편해요.</p>}
            {notice && <p className={css.hint} role="status">{notice}</p>}
            {field}
            <div className={css.toolbar}>
              <button type="button" className={`${kit.button} ${kit.quietWood}`} aria-expanded={trayOpen} onClick={() => setTrayOpen(o => !o)}>
                {trayOpen ? '관리 접기' : '타워 관리'}
              </button>
              {skip}
              <span className={kit.muted}>
                {selection.towerId !== null
                  ? '선택한 타워'
                  : selection.slotId
                    ? '빈 자리 선택됨'
                    : view.phase === 'BATTLE'
                      ? '전투 중에도 설치·강화할 수 있어요'
                      : ''}
              </span>
            </div>
            {trayOpen && (
              <div className={`${kit.board} ${css.tray}`}>
                {practiceDone ? (
                  practiceRest
                ) : (
                  <>
                    {coachLine('panel')}
                    <div ref={panelRef}>{panel}</div>
                    {flash && <p className={kit.reason} role="status">{flash}</p>}
                    {slotList}
                  </>
                )}
              </div>
            )}
            {bottom}
          </>
        )}
      </main>
      {paused && view.phase !== 'GAME_OVER' && (
        <PauseOverlay
          reasons={view.pause}
          renderLost={view.renderLost}
          canSave={view.saveStatus !== 'disabled' && 'saveAndExit' in controller}
          saveError={view.saveStatus === 'error'}
          fontScale={fontScale}
          soundOn={soundOn}
          onResume={() => controller.resume()}
          onFont={onFont}
          onSound={onSound}
          onSaveExit={async () => {
            const fn = (controller as RunController & { saveAndExit?: () => Promise<boolean> }).saveAndExit;
            const ok = fn ? await fn.call(controller) : false;
            if (ok) (onExit as (reason: 'over' | 'abandon' | 'saved') => void)('saved');
            return ok;
          }}
          onRetrySave={async () => {
            const fn = (controller as RunController & { retrySave?: () => Promise<void> }).retrySave;
            if (fn) await fn.call(controller);
          }}
          onQuit={() => {
            controller.resume();
            controller.dispatch({ type: 'quit' });
          }}
          onLeaveUnsaved={() => onExit('abandon')}
        />
      )}
    </>
  );
}
