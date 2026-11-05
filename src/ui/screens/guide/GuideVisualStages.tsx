import { useEffect, useMemo, useState, useSyncExternalStore, type FocusEvent } from 'react';
import { DIFFICULTY_IDS, type DifficultyId, type FoeTag, type TowerId } from '../../../contracts/balance';
import { BALANCE } from '../../../content';
import { DIFFICULTY_COPY } from '../../copy';
import { BackIcon, CheckIcon, NoteIcon, PauseIcon, PlayIcon } from '../../icons/ControlIcons';
import { BranchMarkIcon, StatRangeIcon, TowerShieldPortrait, UndoArrowIcon } from '../../icons/GameIcons';
import { ArtIcon, Button, Card, Segmented } from '../../kit';
import css from '../GuideScreen.module.css';
import { useLobbySprites } from '../home/canvasAssets';
import { difficultyReadout } from './difficultyReadout';
import { GUIDE_UI as U } from './guideCopy';
import {
  buildCounterRows,
  buildQuizOutcomeSpecs,
  buildTowerGuideItems,
  GUIDE_WAVE_BEATS,
  sampleGuideWaveLoop,
  type GuideChapterSpec,
  type GuideRowIconId,
  type GuideWaveBeatId,
  type QuizOutcomeId,
} from './guideModel';
import { GuideStageCanvas } from './GuideStageCanvas';

// 장 시연(R5 G2~G7, 2db26f4 GuideVisualStages를 kit 위로 옮김). 고르기는 kit Segmented, 판독 판은 kit Card(머리판)로 그린다.

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const subscribeReduce = (cb: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const readReduce = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(REDUCE_QUERY).matches;

/** OS '동작 줄이기'. 설정의 배경 움직임 단계와 함께 시연 반복을 멈춘다(ui-rules-v4 §7.3). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduce, readReduce, () => false);
}

/** 그림 이름 → 줄 아이콘(장 요약 행, G8). 상태는 원화, 조작은 선 아이콘 한 세트. */
export function GuideRowIcon({ icon }: { icon: GuideRowIconId }) {
  switch (icon) {
    case 'gold': return <ArtIcon name="coin" size={24} />;
    case 'gate': return <ArtIcon name="gate" size={24} />;
    case 'score': return <ArtIcon name="star" size={24} />;
    case 'flame': return <ArtIcon name="flame" size={24} />;
    case 'chest': return <ArtIcon name="chest" size={24} />;
    case 'note': return <NoteIcon size={20} />;
    case 'play': return <PlayIcon size={20} />;
    case 'seal': return <CheckIcon size={20} />;
    case 'pause': return <PauseIcon size={20} />;
    case 'range': return <StatRangeIcon size={20} />;
    case 'branch': return <BranchMarkIcon id="A" size={20} />;
    case 'undo': return <UndoArrowIcon size={20} />;
    case 'key': return <span className={css.miniKey}>1</span>;
  }
}

/** 장 그림. 대체 글이 비면(목차 카드) 꾸밈으로 숨는다. */
export function GuideArt({ chapter, className }: { chapter: GuideChapterSpec; className?: string | undefined }) {
  return <img className={className} src={`${import.meta.env.BASE_URL}${chapter.illustrationUrl}`} alt={chapter.illustrationAlt} draggable={false} />;
}

function useIconUrls(): Record<string, string> {
  const sprites = useLobbySprites();
  return useMemo(() => {
    const rec: Record<string, string> = {};
    for (const [key, val] of sprites) rec[key] = val.url;
    return rec;
  }, [sprites]);
}

/**
 * 저절로 넘어가는 시연(1장 단계·2장 결과)을 잠시 멈춘다: 시연 칸 안에 포커스나 마우스가 있는 동안.
 * 고르기 줄(roving)은 고른 칸에 tabIndex 0을 주므로, 포커스가 든 채로 고른 값이 바뀌면 방향키가 칸을 건너뛴다.
 */
function useHoldWhileInside() {
  const [focus, setFocus] = useState(false);
  const [hover, setHover] = useState(false);
  const handlers = {
    onFocus: () => setFocus(true),
    onBlur: (e: FocusEvent<HTMLDivElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false); },
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
  };
  return [focus || hover, handlers] as const;
}

/** 1장(G2): 준비·설치·전투·회복 4박 수비 캔버스. 칸을 누르면 그 박에 고정되고, 다시 누르면 순환으로 돌아간다. 칸 안에 포커스·마우스가 있으면 멈춘다. */
function Chapter1Stage({ animate, highContrastMap }: { animate: boolean; highContrastMap: boolean }) {
  const [pinned, setPinned] = useState<GuideWaveBeatId | null>(null);
  const [autoBeat, setAutoBeat] = useState<GuideWaveBeatId>(2);
  const [hold, holdHandlers] = useHoldWhileInside();

  useEffect(() => {
    if (!animate || pinned !== null || hold) return undefined;
    const sync = () => setAutoBeat(sampleGuideWaveLoop(320, 100, performance.now(), true, null).beat);
    sync();
    const timer = window.setInterval(sync, 400);
    return () => window.clearInterval(timer);
  }, [animate, pinned, hold]);

  const beat: GuideWaveBeatId = pinned ?? (animate ? autoBeat : 2);
  const readout = sampleGuideWaveLoop(320, 100, 1250, false, beat);
  // 멈춘 동안은 캔버스도 지금 박에 묶어 고르기 줄과 어긋나지 않게 한다(그 박 안의 움직임은 계속).
  const canvasBeat = pinned ?? (hold && animate ? autoBeat : null);

  return (
    <div className={css.pane} {...holdHandlers}>
      <div className={css.canvasBox}>
        <GuideStageCanvas mode="wave_loop" animate={animate} highContrastMap={highContrastMap} pinnedBeat={canvasBeat} className={css.stageCanvas} />
        <span className={css.tagLeft}>{readout.statusTag}</span>
        <span className={css.tagRight}>{readout.goldTag}</span>
      </div>
      <Segmented<`${GuideWaveBeatId}`>
        label={U.beatGroup}
        className={`${css.wrapTiny} ${css.autoSeg}`}
        options={GUIDE_WAVE_BEATS.map(b => ({ value: `${b.id}`, label: b.label }))}
        value={`${beat}`}
        onChange={v => {
          const next = Number(v) as GuideWaveBeatId;
          setPinned(prev => (prev === next ? null : next));
        }}
      />
    </div>
  );
}

/** 2장(G3): 결과마다 골드·점수·성문 메모와 연속 정답 칸. 움직임이 켜져 있고 아무것도 고르지 않았으면 2.4초마다 다음 결과로 넘어간다(칸 안에 포커스·마우스가 있으면 멈춤). */
function Chapter2Stage({ animate }: { animate: boolean }) {
  const outcomes = useMemo(() => buildQuizOutcomeSpecs(), []);
  const streak = BALANCE.burning.streak;
  const [selected, setSelected] = useState<QuizOutcomeId | null>(null);
  const [autoIdx, setAutoIdx] = useState(0);
  const [hold, holdHandlers] = useHoldWhileInside();

  useEffect(() => {
    if (!animate || selected !== null || hold) return undefined;
    const timer = window.setInterval(() => setAutoIdx(i => (i + 1) % outcomes.length), 2400);
    return () => window.clearInterval(timer);
  }, [animate, selected, hold, outcomes.length]);

  const active = (selected ? outcomes.find(o => o.id === selected) : outcomes[animate ? autoIdx : outcomes.length - 1]) ?? outcomes[0]!;

  return (
    <div className={css.pane} {...holdHandlers}>
      <Segmented<QuizOutcomeId> label={U.outcomeGroup} className={`${css.wrap4} ${css.autoSeg}`} options={outcomes.map(o => ({ value: o.id, label: o.label }))} value={active.id} onChange={setSelected} />
      <Card material="plaque" pad="sm" className={css.hudSim} data-outcome={active.id}>
        <span className={css.hudRow}>
          <span className={css.hudGold}><ArtIcon name="coin" size={22} />{active.goldText}</span>
          <span className={css.hudItem}><ArtIcon name="star" size={20} />{active.scoreText}</span>
          <span className={css.hudItem} role="img" aria-label={`연속 정답 ${active.litCount}/${streak}칸, ${active.gateNote}`}>
            {Array.from({ length: streak }, (_, i) => (
              <ArtIcon key={i} name="flame" size={20} className={i < active.litCount ? css.lit : css.unlit} />
            ))}
            <span aria-hidden="true">{active.gateNote}</span>
          </span>
        </span>
        <span className={css.hudNote}>{active.summary}</span>
      </Card>
    </div>
  );
}

/** 3장(G4): 시작 타워의 사거리(밝은 흙길)·비용 배지와 레벨 진화 두 갈래. 사거리 그림은 고를 때만 다시 그린다. */
function Chapter3Stage({ highContrastMap }: { highContrastMap: boolean }) {
  const towers = useMemo(() => buildTowerGuideItems(), []);
  const icons = useIconUrls();
  const [towerId, setTowerId] = useState<TowerId>(() => towers[0]?.id ?? 'archer');
  const t = towers.find(x => x.id === towerId) ?? towers[0]!;

  return (
    <div className={css.pane}>
      <Segmented<TowerId>
        label={U.towerGroup}
        className={css.wrap4}
        options={towers.map(x => ({ value: x.id, label: <><TowerShieldPortrait type={x.id} icons={icons} size={24} bare />{x.label}</> }))}
        value={t.id}
        onChange={setTowerId}
      />
      <div className={css.towerRow}>
        <div className={css.canvasBox}>
          <GuideStageCanvas mode="range_demo" animate={false} highContrastMap={highContrastMap} towerId={t.id} rangeMilli={t.rangeMilli} className={css.stageCanvas} />
          <span className={css.tagLeft}>{`${t.label} · ${t.costGold}골드`}</span>
          <span className={css.tagRight}>{`사거리 ${t.rangeCellsText}`}</span>
        </div>
        <ul className={css.branches}>
          <li><BranchMarkIcon id="A" size={20} /><span><strong>{t.branchATitle}</strong><span>{t.branchASummary}</span></span></li>
          <li><BranchMarkIcon id="B" size={20} /><span><strong>{t.branchBTitle}</strong><span>{t.branchBSummary}</span></span></li>
        </ul>
      </div>
    </div>
  );
}

const KEYS = ['1', '2', '3', '4'] as const;
type QuizKey = (typeof KEYS)[number];

/** 4장(G5): 난이도 판독 한 줄(새 게임 창과 같은 difficultyReadout)과 실제 숫자키에 눌리는 1~4 키. */
function Chapter4Stage() {
  const [difficulty, setDifficulty] = useState<DifficultyId>('Normal');
  const [pressed, setPressed] = useState<QuizKey>('1');
  const r = difficultyReadout(difficulty);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if ((KEYS as readonly string[]).includes(e.key)) setPressed(e.key as QuizKey);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={css.pane}>
      <Segmented<DifficultyId> label={U.difficultyGroup} className={css.wrap4} options={DIFFICULTY_IDS.map(id => ({ value: id, label: DIFFICULTY_COPY[id].label }))} value={difficulty} onChange={setDifficulty} />
      <p className={css.readout} data-readout>
        <span className={css.readItem}><ArtIcon name="gate" size={20} />{r.parts[0]}</span>
        <span className={css.readItem}><ArtIcon name="coin" size={20} />{r.parts[1]}</span>
        <span className={css.readScope} data-advanced={r.advanced}>{r.parts[2]}</span>
      </p>
      <div className={css.keyRow}>
        <span className={css.keycaps} role="group" aria-label={U.keyGroup}>
          {KEYS.map(k => (
            <Button key={k} variant="secondary" art={false} still className={css.keycap} aria-pressed={pressed === k} onClick={() => setPressed(k)}>
              {k}<span className="sr-only">번 보기</span>
            </Button>
          ))}
        </span>
        <span className={css.keyHint} aria-live="polite">{U.keyHint(pressed)}</span>
      </div>
    </div>
  );
}

/** 5장(G7): 적 특성 아이콘을 고르면 그 특성을 잘 잡는 타워(계약 strongVs, 20종)가 보인다. */
function Chapter5Stage() {
  const rows = useMemo(() => buildCounterRows(), []);
  const icons = useIconUrls();
  const [tag, setTag] = useState<FoeTag>(() => rows[0]?.tag ?? 'flyer');
  const row = rows.find(r => r.tag === tag) ?? rows[0];
  if (!row) return null;

  return (
    <div className={css.pane}>
      <span className={css.paneHead}>{U.traitHead}</span>
      <Segmented<FoeTag>
        label={U.traitGroup}
        className={css.traitSeg}
        options={rows.map(r => ({ value: r.tag, label: <ArtIcon name={r.icon} size={28} />, ariaLabel: r.enemy }))}
        value={row.tag}
        onChange={setTag}
      />
      <div className={css.counter} data-counter={row.tag}>
        <span className={css.counterEnemy}><ArtIcon name={row.icon} size={28} />{row.enemy}</span>
        <span className={css.counterLead}><BackIcon size={16} />{U.counterLead}</span>
        <ul className={css.counterTowers} aria-label={`${row.enemy} · ${U.counterLead}`}>
          {row.towers.map(x => (
            <li key={x.id}><TowerShieldPortrait type={x.id} icons={icons} size={24} bare />{x.label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 장 시연 칸: 왼쪽 그림 + 오른쪽 시연. */
export function GuideVisualStage({ chapter, animate, highContrastMap }: { chapter: GuideChapterSpec; animate: boolean; highContrastMap: boolean }) {
  return (
    <div className={css.stage} data-chapter={chapter.id}>
      <GuideArt chapter={chapter} className={css.stageArt} />
      {chapter.id === 1 && <Chapter1Stage animate={animate} highContrastMap={highContrastMap} />}
      {chapter.id === 2 && <Chapter2Stage animate={animate} />}
      {chapter.id === 3 && <Chapter3Stage highContrastMap={highContrastMap} />}
      {chapter.id === 4 && <Chapter4Stage />}
      {chapter.id === 5 && <Chapter5Stage />}
    </div>
  );
}
