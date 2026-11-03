import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { TowerId } from '../../contracts/balance';
import type { OptionId } from '../../contracts/questions';
import type { RunController } from '../../application/RunController';
import { buildCost } from '../../domain/towers';
import { FieldBridgeHandle, type FieldDrag, type FieldSelection, type FieldTap, type FieldView } from '../../game/bridge';
import { PhaserBattlefield } from '../../game/PhaserBattlefield';
import type { FontScale } from '../../application/session';
import { DEFAULTS } from '../../content';
import { SoundDirector } from '../audio/sound';
import { commandErrorText } from '../copy';
import { PlayArrowIcon, TowerShieldPortrait, WaveFlagIcon } from '../icons/GameIcons';
import kit from '../kit.module.css';
import { useLayout } from '../useLayout';
import { Armory } from './Armory';
import { CoinFlight, coinsFor, type Flight } from './CoinFlight';
import { EvolveCard } from './EvolveCard';
import { evolutionChoices, previewForm, previewMarker, towerForm, undoBuildCommand, upgradeCommand, upgradeCost, type FormId } from './evolution';
import { FieldOverlay, type FieldFlash } from './FieldOverlay';
import { FULL_VIEW } from './fieldGeometry';
import { COACH_TEXT, currentCoach, markCoachDone, readCoachDone } from './firstRunCoach';
import css from './GameScreen.module.css';
import { Hud, type RecentDelta } from './Hud';
import { PauseOverlay } from './PauseOverlay';
import { QuestionPanel } from './QuestionPanel';
import { RecruitCard } from './RecruitCard';
import { recruitCommand, recruitOffer, showRecruit } from './recruit';
import { practiceCoach } from './practiceCoach';
import { nextSlot, SlotList, slotDescription, type Arrow } from './SlotList';
import { TowerDetail } from './TowerDetail';
import { useTowerDrag } from './useTowerDrag';
import { ENEMY_NAME, wavePreview } from './wavePreview';
import { WaveBand } from './WaveBand';

interface Props {
  controller: RunController;
  /** 판 설정의 타워(호환용). 화면은 엔진 장착함(view.owned)을 쓴다. */
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
  onExit(reason: 'saved' | 'over' | 'abandon'): void;
  /** 첫 연습 판(PRD §12.2). 있으면 안내 문장·건너뛰기·연습 끝 패널을 보인다. */
  practice?: { onFinish(next: 'new' | 'again' | 'home'): void };
}

const EMPTY: FieldSelection = { slotId: null, towerId: null, previewType: null, previewBranch: null };
const FLASH_MS = 2400;

export function GameScreen({
  controller,
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
  const b = controller.ctx.balance;
  const map = controller.ctx.map;
  const [recentDelta, setRecentDelta] = useState<RecentDelta | null>(null);
  const deltaTimerRef = useRef<number | null>(null);
  // 연출(ui-rules-v2 §5): 정답 금화 비행, 웨이브 띠, 진화 빛기둥. 보상은 이미 상태에 반영된 뒤의 그림이다.
  const goldRef = useRef<HTMLElement>(null);
  const answerFrom = useRef<{ x: number; y: number } | null>(null);
  const motionRef = useRef(reducedMotion);
  useEffect(() => { motionRef.current = reducedMotion; }, [reducedMotion]);
  const fxSeq = useRef(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [band, setBand] = useState<{ id: number; wave: number; boss: boolean } | null>(null);
  const [pillar, setPillar] = useState<{ id: number; slotId: string } | null>(null);

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
        if (e.type === 'answered' && e.result === 'correct' && e.gold > 0 && !motionRef.current) {
          const from = answerFrom.current;
          const to = goldRef.current?.getBoundingClientRect();
          if (from && to && to.width > 0) {
            fxSeq.current += 1;
            const flight = { id: fxSeq.current, from, to: { x: to.left + to.width / 2, y: to.top + to.height / 2 }, coins: coinsFor(e.gold) };
            setFlights(f => [...f, flight]);
          }
        }
        if (e.type === 'phase' && e.phase === 'BATTLE') {
          fxSeq.current += 1;
          setBand({ id: fxSeq.current, wave: e.wave, boss: e.wave % controller.ctx.balance.waves.bossEveryWaves === 0 });
        }
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
  const [evolveOpen, setEvolveOpen] = useState(false);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<FieldFlash | null>(null);
  const flashSeq = useRef(0);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [camera, setCamera] = useState<FieldView>(FULL_VIEW);
  const cameraRef = useRef<FieldView>(FULL_VIEW);
  const [dragging, setDragging] = useState(false);
  const [coachDone, setCoachDone] = useState(readCoachDone);
  // 전장 키보드 커서(PRD §12.4). 포커스가 전장에 있을 때만 그린다.
  const [cursor, setCursor] = useState<string | null>(null);
  const [fieldFocused, setFieldFocused] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [lastBuilt, setLastBuilt] = useState<number | null>(null);
  const paused = view.pause.length > 0;
  // 선택한 타워가 팔리거나 사라지면 선택이 없는 것으로 본다(렌더 중 파생, effect로 setState하지 않음).
  const towerGone = rawSelection.towerId !== null && !view.towers.some(t => t.id === rawSelection.towerId);
  const selection = towerGone ? EMPTY : rawSelection;
  const selectedTower = selection.towerId !== null ? view.towers.find(t => t.id === selection.towerId) ?? null : null;
  /** 먼저 골라 둔 타워: 빈 자리를 누르면 바로 설치한다. */
  const armed = selection.slotId === null && selection.towerId === null ? selection.previewType : null;
  const hasSelection = selection.slotId !== null || selection.towerId !== null;
  const magnify = layout.cell < layout.magnifyBelow && hasSelection && !dragging;
  const trading = view.phase === 'BUILD' || view.phase === 'BATTLE';
  const lock = view.phase === 'PREP_QUIZ' ? '준비 문제를 먼저 풀어 주세요' : view.phase === 'WAVE_WRAPUP' ? '다음 웨이브 준비 중이에요' : null;
  // 장착함(징집으로 늘어난다). 장착 홈·설치 메뉴·자리 목록은 이 타워만 보인다(엔진은 장착함 밖 설치를 NOT_OWNED로 막는다).
  const towers = view.owned;
  const occupied = useMemo(() => new Set(view.towers.map(t => t.slotId)), [view.towers]);
  // 골드가 늘어 새로 살 수 있게 된 타워: 장착 홈 테두리가 한 번 빛난다(ui-rules-v2 §5).
  const [goldSeen, setGoldSeen] = useState<{ gold: number; fresh: ReadonlySet<TowerId>; n: number }>({ gold: view.gold, fresh: new Set(), n: 0 });
  if (goldSeen.gold !== view.gold) {
    const fresh = new Set(towers.filter(t => goldSeen.gold < buildCost(b, t) && view.gold >= buildCost(b, t)));
    setGoldSeen({ gold: view.gold, fresh: fresh.size > 0 ? fresh : goldSeen.fresh, n: fresh.size > 0 ? goldSeen.n + 1 : goldSeen.n });
  }
  useEffect(() => {
    if (goldSeen.n === 0) return undefined;
    const t = window.setTimeout(() => setGoldSeen(g => ({ ...g, fresh: new Set() })), 700);
    return () => window.clearTimeout(t);
  }, [goldSeen.n]);

  const showFlash = useCallback((text: string, slotId: string | null = null) => {
    flashSeq.current += 1;
    setFlash({ id: flashSeq.current, text, slotId });
  }, []);
  useEffect(() => {
    if (!flash) return undefined;
    const t = window.setTimeout(() => setFlash(f => (f?.id === flash.id ? null : f)), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flash]);

  const clear = useCallback(() => {
    setSelection(EMPTY);
    setEvolveOpen(false);
  }, []);

  /**
   * 설치·판매로 누른 단추(전장 옆 메뉴·도구)가 사라지면 포커스가 body로 떨어진다. 그때만 전장으로 돌려
   * 화살표로 다음 자리를 고를 수 있게 한다(PRD §12.4). 포커스가 살아 있으면 건드리지 않는다.
   */
  const refocusField = useCallback(() => requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && active.isConnected) return;
    fieldRef.current?.querySelector<HTMLElement>('[data-keyscope="field"]')?.focus();
  }), []);

  /** 설치. 실패하면 그 자리 옆에 이유를 짧게 보인다. 골라 둔 타워는 골드가 남으면 계속 골라 둔다(연속 설치). */
  const build = useCallback((slotId: string, type: TowerId, keepArmed: boolean) => {
    const r = controller.dispatch({ type: 'build', slotId, tower: type });
    if (!r.ok) {
      showFlash(commandErrorText(r.error, r.error === 'NOT_ENOUGH_GOLD' ? { need: buildCost(b, type) - view.gold } : undefined), slotId);
      return false;
    }
    // 새 타워 번호는 명령 때 정해진다. 그 타워 위에 3초 동안 되돌리기 칩을 띄운다(ui-rules-v2 §4).
    for (const e of r.events) if (e.type === 'towerBuilt') setLastBuilt(e.towerId);
    setFlash(null);
    setCoachDone(d => markCoachDone(d, 'place'));
    refocusField();
    const cost = buildCost(b, type);
    setSelection(keepArmed && view.gold - cost >= cost ? { ...EMPTY, previewType: type } : EMPTY);
    setEvolveOpen(false);
    return true;
  }, [controller, b, view.gold, showFlash, refocusField]);

  const onTap = useCallback((tap: FieldTap) => {
    if (tap.kind === 'empty') {
      clear();
      return;
    }
    if (tap.kind === 'tower') {
      setSelection({ ...EMPTY, towerId: tap.towerId });
      setEvolveOpen(false);
      return;
    }
    if (armed) {
      build(tap.slotId, armed, true);
      return;
    }
    // 준비 문제·마무리 중에는 설치할 수 없다. 메뉴 없이 확대만 되지 않게 그 자리에 이유를 짧게 보인다.
    if (!trading) {
      showFlash(lock ?? '지금은 할 수 없어요', tap.slotId);
      return;
    }
    setSelection({ ...EMPTY, slotId: tap.slotId });
  }, [armed, build, clear, trading, lock, showFlash]);

  // 브리지는 판 하나 동안 같은 객체. Phaser는 매 프레임 selection·magnify를 읽는다.
  const [bridge] = useState(() => new FieldBridgeHandle(controller));
  const keyboardSlotId = fieldFocused ? cursor : null;
  const onCamera = useCallback((v: FieldView) => {
    cameraRef.current = v;
    setCamera(v);
  }, []);
  useLayoutEffect(() => {
    bridge.update({
      selection,
      magnify,
      keyboardSlotId,
      reducedMotion,
      highContrastMap,
      onTap,
      onIcons: setIcons,
      onCamera,
    });
  }, [bridge, selection, magnify, keyboardSlotId, reducedMotion, highContrastMap, onTap, onCamera]);

  const blockReason = useCallback((type: TowerId) => {
    if (!trading) return lock ?? '지금은 할 수 없어요';
    const cost = buildCost(b, type);
    return view.gold < cost ? `골드 ${cost - view.gold} 부족` : null;
  }, [trading, lock, b, view.gold]);

  const { begin: beginDrag, takeClick, ghostRef, ghostType } = useTowerDrag({
    fieldRef,
    viewRef: cameraRef,
    slots: map.slots,
    occupied,
    blockReason,
    onBlocked: reason => showFlash(reason),
    onDrag: (d: FieldDrag | null) => {
      bridge.update({ drag: d });
      if (d && !dragging) {
        setDragging(true);
        setSelection(EMPTY);
        setEvolveOpen(false);
      } else if (!d) setDragging(false);
    },
    onDrop: (type, slotId) => { build(slotId, type, false); },
  });

  const onArm = (type: TowerId) => {
    if (armed === type) {
      clear();
      return;
    }
    setSelection({ ...EMPTY, previewType: type });
    setEvolveOpen(false);
    const reason = blockReason(type);
    if (reason) showFlash(reason);
  };

  /** 키보드·목록으로 고른 뒤 전장 옆 메뉴의 첫 단추로 포커스를 옮긴다(PRD §12.4). */
  const focusOverlay = () => requestAnimationFrame(() => {
    fieldRef.current?.querySelector<HTMLElement>('[data-overlay] button:not([disabled])')?.focus();
  });

  const pickSlot = useCallback((slotId: string) => {
    const tower = view.towers.find(t => t.slotId === slotId);
    onTap(tower ? { kind: 'tower', towerId: tower.id, slotId } : { kind: 'slot', slotId });
  }, [view.towers, onTap]);

  const onFieldKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setCursor(c => nextSlot(map.slots, c, e.key as Arrow));
    } else if ((e.key === 'Enter' || e.key === ' ') && cursor) {
      e.preventDefault();
      const builtHere = view.towers.some(t => t.slotId === cursor);
      pickSlot(cursor);
      if (builtHere || !armed) focusOverlay();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clear();
    }
  };
  const onFieldFocus = () => {
    setFieldFocused(true);
    // 처음 들어오면 선택한 자리, 없으면 첫 자리에서 시작한다.
    setCursor(c => c ?? selection.slotId ?? selectedTower?.slotId ?? map.slots[0]?.id ?? null);
  };

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);
  // 전투 화면에서는 바탕을 짙은 호두나무 작업대로 바꾼다(전장이 주인공).
  useEffect(() => {
    document.body.dataset.screen = 'battle';
    return () => { delete document.body.dataset.screen; };
  }, []);
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
  // 연습이 아닌 판의 첫 판 코치 마크. 그 조작을 한 번 하면 다시 보이지 않는다.
  const mark = practice ? null : currentCoach(view, coachDone);
  const practiceRest = <p className={css.restLine}>연습이 끝났어요. 아래에서 다음 할 일을 골라요.</p>;
  const skip = practice && !practiceDone ? (
    <button type="button" className={css.quietKey} onClick={() => practice.onFinish('home')}>
      연습 건너뛰기
    </button>
  ) : null;

  const onAnswer = useCallback((choice: OptionId) => {
    if (!view.question) return;
    // 금화가 날아오를 자리: 고른 답안 키 가운데. 채점 사건은 다음 틱에 온다.
    const key = document.querySelector<HTMLElement>(`[data-option-id="${choice}"]`)?.getBoundingClientRect();
    answerFrom.current = key ? { x: key.left + key.width / 2, y: key.top + key.height / 2 } : null;
    controller.dispatch({ type: 'answer', encounterId: view.question.encounterId, choice });
  }, [controller, view.question]);
  const onSkip = useCallback(() => {
    if (view.question) controller.dispatch({ type: 'skip', encounterId: view.question.encounterId });
  }, [controller, view.question]);
  const onNext = useCallback(() => {
    if (view.question) controller.dispatch({ type: 'next', encounterId: view.question.encounterId });
  }, [controller, view.question]);

  const towerResult = (r: ReturnType<RunController['dispatch']>, need?: number) => {
    if (r.ok) setFlash(null);
    else showFlash(commandErrorText(r.error, need !== undefined ? { need } : undefined), selectedTower?.slotId ?? null);
    return r.ok;
  };
  const onUpgrade = () => {
    if (!selectedTower) return;
    const cost = upgradeCost(b, selectedTower.type, selectedTower.level);
    towerResult(controller.dispatch(upgradeCommand(selectedTower.id)), cost !== null ? cost - view.gold : undefined);
  };
  const onEvolve = () => {
    if (!selectedTower) return;
    if (!trading && lock) { showFlash(lock, selectedTower.slotId); return; }
    setEvolveOpen(true);
  };
  const onChooseForm = (form: FormId) => {
    if (!selectedTower) return;
    const cost = upgradeCost(b, selectedTower.type, selectedTower.level);
    if (towerResult(controller.dispatch(upgradeCommand(selectedTower.id, form)), cost !== null ? cost - view.gold : undefined)) {
      fxSeq.current += 1;
      setPillar({ id: fxSeq.current, slotId: selectedTower.slotId });
      setEvolveOpen(false);
      setSelection(s => ({ ...s, previewBranch: null }));
    }
  };
  /** 설치 되돌리기: 전액 환불. 시간이 지났으면 엔진이 거절하고 이유를 짧게 보인다. */
  const onUndo = (towerId: number) => {
    const tower = view.towers.find(t => t.id === towerId);
    const r = controller.dispatch(undoBuildCommand(towerId));
    if (!r.ok) {
      showFlash(commandErrorText(r.error), tower?.slotId ?? null);
      return;
    }
    setFlash(null);
    setLastBuilt(null);
    if (selection.towerId === towerId) clear();
    refocusField();
  };
  const onSell = () => {
    if (!selectedTower) return;
    if (towerResult(controller.dispatch({ type: 'sell', towerId: selectedTower.id }))) {
      clear();
      refocusField();
    }
  };
  // 전투는 ‘전투 시작’ 단추로만 시작한다. 전역 Enter로 시작하면 거래 뒤 포커스가 떨어진 상태의 Enter가 전투를 연다.
  const onStart = () => {
    if (view.towers.length === 0 && !confirmEmpty) {
      setConfirmEmpty(true);
      // 확인 상자가 뜨면 누른 단추가 사라진다. 안전한 ‘취소’로 포커스를 옮긴다(반복 Enter로 바로 시작하지 않게).
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-cancel-empty]')?.focus());
      return;
    }
    setConfirmEmpty(false);
    const r = controller.dispatch({ type: 'startBattle' });
    if (!r.ok) showFlash(commandErrorText(r.error));
    else {
      setFlash(null);
      setCoachDone(d => markCoachDone(d, 'start'));
    }
  };

  // 전투는 ‘전투 시작’ 단추로만 시작한다(전역 Enter 단축키 없음). 설치 뒤 포커스가 풀린 상태의 Enter가 전투를 열지 않게 한다(WP-UI).

  // 우측(휴대폰은 전장 아래) 능력치 막대: 고른 타워, 진화 미리보기, 골라 둔 종류, 메뉴에서 짚은 종류 순.
  const detail = selectedTower ? (() => {
    const form = towerForm(selectedTower);
    const cost = upgradeCost(b, selectedTower.type, selectedTower.level);
    const evolving = evolutionChoices(b, selectedTower) !== null;
    const preview = previewForm(b, selectedTower, selection.previewBranch);
    const next = cost === null ? null : evolving ? (preview ? { level: selectedTower.level + 1, form: preview } : null) : { level: selectedTower.level + 1, form };
    return <TowerDetail balance={b} type={selectedTower.type} level={selectedTower.level} form={form} icons={icons} next={next} compact={layout.compactRail} />;
  })() : selection.previewType ? (
    <TowerDetail balance={b} type={selection.previewType} level={1} form="base" icons={icons} compact={layout.compactRail} />
  ) : null;

  const armory = (variant: 'rail' | 'strip') => (
    <Armory
      balance={b}
      towers={towers}
      gold={view.gold}
      armed={armed}
      icons={icons}
      variant={variant}
      compact={variant === 'rail' && layout.compactRail}
      fresh={goldSeen.fresh}
      onArm={onArm}
      onPress={beginDrag}
      takeClick={takeClick}
    />
  );

  // 목록에서 고르면 전장 옆 메뉴의 첫 단추로 포커스를 옮긴다(PRD §12.4).
  const pickFromList = (slotId: string) => {
    pickSlot(slotId);
    focusOverlay();
  };
  const slotList = (
    <SlotList
      ctx={controller.ctx}
      view={view}
      towers={towers}
      onPick={pickFromList}
      selectedSlotId={selection.slotId ?? selectedTower?.slotId ?? null}
    />
  );
  const railFlash = flash && flash.slotId === null ? <p className={css.railFlash} role="status">{flash.text}</p> : null;

  const seamClass = layout.mode === 'R' ? css.seamR : css.buildStack;

  const bottom = practiceDone ? (
    <section className={`${css.build} ${seamClass}`} aria-label="연습 끝">
      <div className={css.buildMain}>
        <p className={css.buildTitle}>연습을 마쳤어요</p>
        <p className={kit.muted}>성문이 다시 가득 찼어요. 문제를 풀어 골드를 모으고, 타워로 성문을 지키면 돼요.</p>
      </div>
      <div className={css.buildSide}>
        <button type="button" className={css.start} onClick={() => practice.onFinish('new')}>
          새 게임 시작
        </button>
        <button type="button" className={css.quietKey} onClick={() => practice.onFinish('again')}>
          연습 다시 하기
        </button>
      </div>
    </section>
  ) : view.phase === 'BUILD' ? (
    <section className={`${css.build} ${seamClass}`} aria-label="전투 준비">
      <div className={css.buildMain}>
        <p className={css.buildTitle}><WaveFlagIcon size={26} boss={view.milestoneWave} />{view.wave}웨이브 준비</p>
        {(() => {
          const next = wavePreview(b, map.id, view.wave);
          const kinds = [...next.kinds, ...(next.boss ? [{ kind: 'boss' as const, count: 1 }] : [])];
          return (
            <ul className={css.roster} aria-label={`다음 적 ${next.total}마리: ${kinds.map(k => `${ENEMY_NAME[k.kind]} ${k.count}`).join(', ')}`}>
              {kinds.map(k => (
                <li key={k.kind} className={css.foe} data-boss={k.kind === 'boss' || undefined} aria-hidden="true">
                  <span className={css.foeArt}>{icons[`enemy.${k.kind}.0`] && <img src={icons[`enemy.${k.kind}.0`]} alt="" draggable={false} />}</span>
                  <span className={css.foeCount}>×{k.count}</span>
                </li>
              ))}
            </ul>
          );
        })()}
        {coach?.at === 'start' ? coachLine('start') : mark === 'start' ? <p className={css.coach} role="status">{COACH_TEXT.start}</p> : null}
      </div>
      <div className={css.buildSide}>
        {confirmEmpty ? (
          <div className={css.confirmBox}>
            <p className={css.confirmText}>타워 없이 시작할까요?</p>
            <div className={css.row}>
              <button type="button" className={css.quietKey} onClick={onStart}>시작</button>
              <button type="button" className={css.quietKey} data-cancel-empty onClick={() => { setConfirmEmpty(false); requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="전투 준비"] button')?.focus()); }}>취소</button>
            </div>
          </div>
        ) : (
          <button type="button" className={css.start} onClick={onStart}>
            <span>전투 시작</span>
            <PlayArrowIcon size={18} />
          </button>
        )}
      </div>
    </section>
  ) : view.question && !paused ? (
    <div className={css.questionWrap}>
      {coachLine('question')}
      <QuestionPanel
        question={view.question}
        stakes={view.stakes}
        wide={layout.wideQuestion}
        seamLock={layout.mode === 'R'}
        twoByTwoMinPx={DEFAULTS.layout.optionGrid.twoByTwoMinCellWidthPx}
        showKeyHints={showKeyHints}
        onAnswer={onAnswer}
        onSkip={onSkip}
        onNext={onNext}
      />
    </div>
  ) : view.phase === 'GAME_OVER' ? (
    <section className={`${css.build} ${css.buildStack}`}>
      <p className={css.buildTitle}>{view.endReason === 'DEFEAT' ? '성문이 무너졌어요.' : '이번 판을 마쳤어요.'}</p>
    </section>
  ) : null;

  // 징집(towers.md §0-2): 웨이브 사이에 큰 카드 3장을 띄운다. 모달이 아니라 문제 풀이를 막지 않는다.
  const recruitChoices = showRecruit(view) ? recruitOffer(view) : null;
  const onRecruit = (type: TowerId) => {
    const r = controller.dispatch(recruitCommand(type));
    if (!r.ok) showFlash(commandErrorText(r.error));
  };
  const recruit = recruitChoices ? (
    <RecruitCard balance={b} choices={recruitChoices} icons={icons} compact={layout.mode === 'S'} onPick={onRecruit} />
  ) : null;

  const field = (
    <div ref={fieldRef} className={css.field} style={{ width: layout.mapW, height: layout.mapH }}>
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
      <div data-overlay>
        <FieldOverlay
          balance={b}
          map={map}
          towers={towers}
          built={view.towers}
          gold={view.gold}
          icons={icons}
          boxW={layout.mapW}
          boxH={layout.mapH}
          camera={camera}
          slotId={trading || selection.slotId === null ? selection.slotId : null}
          tower={selectedTower}
          flash={flash && flash.slotId !== null ? flash : null}
          pillar={pillar}
          onPillarDone={id => setPillar(p => (p?.id === id ? null : p))}
          onBuild={(slotId, type) => build(slotId, type, false)}
          onPreview={type => setSelection(s => (s.slotId ? { ...s, previewType: type } : s))}
          onUpgrade={onUpgrade}
          onEvolve={onEvolve}
          onSell={onSell}
          undo={lastBuilt !== null ? view.towers.find(t => t.id === lastBuilt) ?? null : null}
          onUndo={onUndo}
          onClose={() => {
            clear();
            fieldRef.current?.querySelector<HTMLElement>('[role="application"]')?.focus();
          }}
        />
      </div>
      {band && (
        <WaveBand key={band.id} wave={band.wave} boss={band.boss} bossArt={icons['enemy.boss.0']} onDone={() => setBand(x => (x?.id === band.id ? null : x))} />
      )}
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
      {!coach && mark === 'place' && !hasSelection && !armed && !dragging && (
        <div className={css.coachField}><p className={css.coach} role="status">{COACH_TEXT.place}</p></div>
      )}
      {layout.mode === 'R' && recruit}
    </div>
  );

  const mainStyle: CSSProperties = layout.mode === 'R'
    ? ({
        padding: layout.pad,
        '--map-w': `${layout.mapW}px`,
        '--rail-w': `${layout.railW}px`,
        '--q-h': `${layout.q}px`,
      } as CSSProperties)
    : { padding: layout.pad };

  return (
    <>
      <main
        className={`${css.screen} ${layout.mode === 'R' ? css.modeR : css.modeS}`}
        style={mainStyle}
        inert={paused || evolveOpen}
      >
        <h1 className="sr-only">어휘력 타워 디펜스 · {Math.max(1, view.wave)}웨이브</h1>
        {layout.mode === 'R' ? (
          <>
            {field}
            <aside className={css.rail} style={{ height: layout.mapH }} aria-label="타워 관리">
              <Hud view={view} burning={b.burning} mode="R" compactRail={layout.compactRail} recentDelta={recentDelta} goldRef={goldRef} reducedMotion={reducedMotion} onPause={() => controller.pause('USER')} />
              {notice && <p className={css.hint} role="status">{notice}</p>}
              <div className={`${css.railBody} ${layout.compactRail ? css.railBodyCompact : ''}`}>
                {practiceDone ? (
                  practiceRest
                ) : (
                  <>
                    {skip}
                    {coachLine('panel')}
                    {armory('rail')}
                    {railFlash}
                    {detail}
                    {slotList}
                  </>
                )}
              </div>
            </aside>
            <div className={css.bottom}>{bottom}</div>
          </>
        ) : (
          <>
            <Hud view={view} burning={b.burning} mode="S" recentDelta={recentDelta} goldRef={goldRef} reducedMotion={reducedMotion} onPause={() => controller.pause('USER')} />
            {layout.portraitHint && <p className={css.hint}>세로로 돌리면 더 편해요.</p>}
            {notice && <p className={css.hint} role="status">{notice}</p>}
            {field}
            {practiceDone ? practiceRest : (
              <div className={css.stripRow}>
                {armory('strip')}
                {railFlash}
                {coachLine('panel')}
              </div>
            )}
            {bottom}
            {/* 휴대폰: 징집 카드는 문제판 아래에 둔다(문제가 화면 밖으로 밀리지 않게). */}
            {recruit}
            {!practiceDone && (
              <div className={css.phoneExtras}>
                {skip}
                {slotList}
              </div>
            )}
          </>
        )}
      </main>
      {flights.length > 0 && <CoinFlight flights={flights} onDone={id => setFlights(f => f.filter(x => x.id !== id))} />}
      {ghostType && (
        <div ref={ghostRef} className={css.ghost} aria-hidden="true">
          <TowerShieldPortrait type={ghostType} icons={icons} size={Math.max(44, Math.round(layout.cell * 1.1))} />
        </div>
      )}
      {evolveOpen && selectedTower && evolutionChoices(b, selectedTower) && (
        <EvolveCard
          balance={b}
          tower={selectedTower}
          gold={view.gold}
          icons={icons}
          lock={trading ? null : lock}
          onPreview={form => setSelection(s => ({ ...s, previewBranch: previewMarker(b, selectedTower, form) }))}
          onChoose={onChooseForm}
          onClose={() => {
            setEvolveOpen(false);
            setSelection(s => ({ ...s, previewBranch: null }));
          }}
          restoreFocus={focusOverlay}
        />
      )}
      {paused && view.phase !== 'GAME_OVER' && (
        <PauseOverlay
          reasons={view.pause}
          renderLost={view.renderLost}
          canSave={controller.persist}
          saveError={view.saveStatus === 'error'}
          fontScale={fontScale}
          soundOn={soundOn}
          onResume={() => controller.resume()}
          onFont={onFont}
          onSound={onSound}
          onSaveExit={async () => {
            const ok = await controller.saveAndExit();
            if (ok) onExit('saved');
            return ok;
          }}
          onRetrySave={() => controller.retrySave()}
          onQuit={() => {
            controller.resume();
            controller.dispatch({ type: 'quit' });
          }}
          onLeaveUnsaved={() => onExit('abandon')}
          restoreFocus={() => document.querySelector<HTMLElement>('main button[aria-label="일시정지"]')?.focus()}
        />
      )}
    </>
  );
}
