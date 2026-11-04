import { useCallback, useEffect, useState } from 'react';
import { mapPreviewFromLocation } from '../application/mapPreview';
import type { RunController } from '../application/RunController';
import {
  bestWaveFor,
  CORRUPT_SAVE_NOTICE,
  loadSaved,
  loadSettings,
  normalizeSettings,
  NO_SAVE_NOTICE,
  resumeBlocker,
  resumeRun,
  reviewNoteItems,
  saveSettings,
  saveSupported,
  startNewRun,
  startPractice,
  type FontScale,
  type LoadResult,
  type ReviewDelta,
  type Settings,
  type StartResult,
} from '../application/session';
import type { DifficultyId } from '../contracts/balance';
import { PILOT_TOWERS, reviewQuestions } from '../content';
import type { RunState } from '../domain/types';
import { cleanNickname } from './copy';
import { GameScreen } from './game/GameScreen';
import { HomeScreen, type ResumeOffer } from './screens/HomeScreen';
import { buildNoteEntries, NoteScreen } from './screens/NoteScreen';
import { ResultScreen } from './screens/ResultScreen';

type Screen =
  | { name: 'home'; initialModal?: 'new' | null; focusNickname?: boolean }
  // bestWave: 판을 열 때 읽은 이 기기의 최고 기록(그 판 전까지, 판 안에서 바뀌지 않는다). 연습·기록 없음은 null.
  | { name: 'game'; controller: RunController; practice?: boolean; bestWave?: number | null }
  | { name: 'result'; state: RunState; reviewDelta: ReviewDelta | null; previousBest: number | null }
  | { name: 'note'; back: Exclude<Screen, { name: 'note' | 'game' }> };

/** 홈에 보일 저장 상태. 이어할 수 있으면 이어하기 단추, 아니면 이유 한 줄(손상·버전 변경·저장 불가). */
function resumeOffer(saved: LoadResult | null): { offer: ResumeOffer | null; notice: string | null } {
  if (!saveSupported()) return { offer: null, notice: NO_SAVE_NOTICE };
  if (!saved || saved.kind === 'none') return { offer: null, notice: null };
  if (saved.kind === 'corrupt') return { offer: null, notice: CORRUPT_SAVE_NOTICE };
  const blocked = resumeBlocker(saved);
  if (blocked) return { offer: null, notice: blocked };
  return { offer: { nickname: saved.state.config.nickname, wave: Math.max(1, saved.state.wave) }, notice: null };
}

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // 개발 빌드에서만 `?previewMap=<맵 id>`로 그 맵의 전투 화면을 바로 연다(R3 P3). 운영 빌드에서는 이 분기가 통째로 빠진다.
  const [screen, setScreen] = useState<Screen>(() => {
    const preview = import.meta.env.DEV ? mapPreviewFromLocation(settings.playerId) : null;
    return preview ? { name: 'game', controller: preview } : { name: 'home' };
  });
  const [saved, setSaved] = useState<LoadResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // 기록 지우기 뒤 오답 노트 개수를 다시 읽게 App을 다시 그린다(noteItems는 렌더 때 저장소에서 읽는다).
  const [, setNoteTick] = useState(0);

  useEffect(() => { document.documentElement.dataset.font = settings.fontScale; }, [settings.fontScale]);
  // 홈에 올 때마다 저장을 다시 읽는다. 저장소를 열 수 없으면 이어하기를 보이지 않는다.
  useEffect(() => {
    if (screen.name !== 'home') return undefined;
    let live = true;
    loadSaved().then(r => { if (live) setSaved(r); }, () => { if (live) setSaved({ kind: 'none' }); });
    return () => { live = false; };
  }, [screen.name]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = normalizeSettings(prev, patch);
      saveSettings(next);
      return next;
    });
  }, []);

  const { offer, notice: savedNotice } = resumeOffer(saved);

  const open = (result: StartResult) => {
    if (!result.ok) {
      setMessage(result.message);
      setScreen({ name: 'home' });
      return;
    }
    setMessage(result.warning);
    // 최고 기록 선(prd-r4 §7.2-F): 같은 학년·난이도의 이 기기 기록 중 최고를 판을 열 때 한 번만 읽는다. 읽지 못하면 기록 없음으로 둔다.
    const { grade, difficulty } = result.controller.state.config;
    void bestWaveFor(grade, difficulty).then(bestWave => setScreen({ name: 'game', controller: result.controller, bestWave }));
  };

  // 홈에서 이어하기와 새 게임을 함께 보이고 학생이 새 게임을 골랐으므로 이전 저장을 바꾼다(PRD §12.2).
  const startNew = (input: { grade: 3 | 4 | 5 | 6; difficulty: DifficultyId; nickname: string }) => {
    update({ lastGrade: input.grade, lastDifficulty: input.difficulty, lastNickname: input.nickname });
    void startNewRun({ ...input, playerId: settings.playerId, replaceSaved: true }).then(open);
  };

  const resume = () => {
    if (saved?.kind !== 'ok') return;
    setMessage(null);
    void resumeRun(saved).then(open);
  };

  const startPracticeRun = () => {
    setMessage(null);
    setScreen({ name: 'game', controller: startPractice(settings.playerId), practice: true });
  };

  /** 연습은 기록·결과 화면 없이 끝난다. 마치거나 건너뛰면 홈의 연습 권유를 그만 보인다. */
  const finishPractice = (controller: RunController, next: 'new' | 'again' | 'home') => {
    controller.dispose();
    update({ practiceSeen: true });
    if (next === 'again') {
      startPracticeRun();
      return;
    }
    if (next === 'new') {
      // 이어할 판이 있으면 새 게임 창을 바로 열지 않고 홈에서 이어하기·새 게임을 고르게 한다.
      if (offer) {
        setMessage('연습을 잘 마쳤어요. 저장된 판을 이어하거나 새 게임을 골라 보세요.');
        setScreen({ name: 'home' });
      } else if (cleanNickname(settings.lastNickname).error === null) {
        setScreen({ name: 'home', initialModal: 'new' });
      } else {
        setMessage('연습을 잘 마쳤어요. 닉네임을 적고 새 게임을 눌러 보세요.');
        setScreen({ name: 'home', focusNickname: true });
      }
      return;
    }
    setScreen({ name: 'home' });
  };

  const exitGame = (controller: RunController, reason: 'saved' | 'over' | 'abandon', previousBest: number | null) => {
    const final = structuredClone(controller.state) as RunState;
    // 판이 끝날 때 오답 노트에 담은 수(prd-r4 §6.1). 기록 쓰기가 아직 안 끝났으면 null이라 결과의 노트 줄을 숨긴다.
    const reviewDelta = controller.getView().reviewDelta;
    controller.dispose();
    setScreen(reason === 'over' ? { name: 'result', state: final, reviewDelta, previousBest } : { name: 'home' });
  };

  const noteGrade = screen.name === 'result' ? screen.state.config.grade : settings.lastGrade;
  const noteItems = screen.name === 'home' || screen.name === 'note' ? reviewNoteItems(noteGrade) : [];

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          message={message}
          settings={settings}
          resume={offer}
          savedNotice={savedNotice}
          initialModal={screen.initialModal ?? null}
          focusNicknameOnMount={screen.focusNickname ?? false}
          onOpenNote={() => setScreen({ name: 'note', back: { name: 'home' } })}
          noteCount={noteItems.length}
          onHistoryCleared={() => setNoteTick(t => t + 1)}
          onClearMessage={() => setMessage(null)}
          onStartNew={startNew}
          onResume={resume}
          onPractice={startPracticeRun}
          onSettings={update}
        />
      );
    case 'game':
      return (
        <GameScreen
          key={screen.controller.state.config.runId}
          controller={screen.controller}
          towers={PILOT_TOWERS}
          notice={message}
          fontScale={settings.fontScale}
          reducedMotion={settings.reducedMotion}
          soundOn={settings.soundOn}
          bgmVolume={settings.bgmVolume}
          sfxVolume={settings.sfxVolume}
          highContrastMap={settings.highContrastMap}
          showKeyHints={settings.showKeyHints}
          bestWave={screen.bestWave ?? null}
          onFont={(f: FontScale) => update({ fontScale: f })}
          onSound={(on: boolean) => update({ soundOn: on })}
          onExit={reason => (screen.practice ? finishPractice(screen.controller, 'home') : exitGame(screen.controller, reason, screen.bestWave ?? null))}
          {...(screen.practice ? { practice: { onFinish: (next: 'new' | 'again' | 'home') => finishPractice(screen.controller, next) } } : {})}
        />
      );
    case 'result':
      return (
        <ResultScreen
          state={screen.state}
          reviewDelta={screen.reviewDelta}
          previousBest={screen.previousBest}
          onOpenNote={() => setScreen({ name: 'note', back: screen })}
          onAgain={() => setScreen({ name: 'home', initialModal: 'new' })}
          onHome={() => setScreen({ name: 'home' })}
        />
      );
    case 'note':
      return <NoteScreen entries={buildNoteEntries(noteItems, reviewQuestions(noteGrade))} onBack={() => setScreen(screen.back)} />;
  }
}
