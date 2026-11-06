import { useCallback, useEffect, useState } from 'react';
import { mapPreviewFromLocation } from '../application/mapPreview';
import { qaRunFromLocation } from '../application/qaRun';
import type { RunController } from '../application/RunController';
import {
  bestWaveFor,
  loadSettings,
  normalizeSettings,
  reviewNoteItems,
  saveSettings,
  startNewRun,
  startPractice,
  type FontScale,
  type ReviewDelta,
  type Settings,
} from '../application/session';
import type { DifficultyId } from '../contracts/balance';
import { PILOT_TOWERS, reviewQuestions } from '../content';
import type { RunState } from '../domain/types';
import { cleanNickname } from './copy';
import { GameScreen } from './game/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { buildNoteEntries, NoteScreen } from './screens/NoteScreen';
import { ResultScreen } from './screens/ResultScreen';
import { useGradeContent } from './useGradeContent';

type Screen =
  | { name: 'home'; initialModal?: 'new' | null; focusNickname?: boolean }
  // bestWave: 판을 열 때 읽은 이 기기의 최고 기록(그 판 전까지, 판 안에서 바뀌지 않는다). 연습·기록 없음은 null.
  | { name: 'game'; controller: RunController; practice?: boolean; bestWave?: number | null }
  | { name: 'result'; state: RunState; reviewDelta: ReviewDelta | null; previousBest: number | null }
  | { name: 'note'; back: Exclude<Screen, { name: 'note' | 'game' }> };

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // 개발 빌드에서만 `?previewMap=<맵 id>`(R3 P3 맵 미리보기)나 `?qaRun=1`(화면 점검 장면)로 전투 화면을 바로 연다.
  // 운영 빌드에서는 이 분기가 통째로 빠진다.
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    void Promise.resolve().then(() => mapPreviewFromLocation(settings.playerId) ?? qaRunFromLocation()).then(controller => {
      if (!controller) return;
      if (cancelled) controller.dispose();
      else setScreen({ name: 'game', controller });
    }).catch(() => { if (!cancelled) setMessage('점검 장면을 불러오지 못했어요.'); });
    return () => { cancelled = true; };
  }, [settings.playerId]);
  // 기록 지우기 뒤 오답 노트 개수를 다시 읽게 App을 다시 그린다(noteItems는 렌더 때 저장소에서 읽는다).
  const [, setNoteTick] = useState(0);

  useEffect(() => { document.documentElement.dataset.font = settings.fontScale; }, [settings.fontScale]);
  // 움직임 단계(full·simple·minimal). CSS는 'minimal'에서 반복·위치 움직임을 멈춘다(ui-rules-v4 §7.3, global.css·kit).
  useEffect(() => { document.documentElement.dataset.motion = settings.motionMode; }, [settings.motionMode]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = normalizeSettings(prev, patch);
      saveSettings(next);
      return next;
    });
  }, []);

  const startNew = (input: { grade: 3 | 4 | 5 | 6; difficulty: DifficultyId; nickname: string }) => {
    update({ lastGrade: input.grade, lastDifficulty: input.difficulty, lastNickname: input.nickname });
    const result = startNewRun({ ...input, playerId: settings.playerId });
    if (!result.ok) {
      setMessage(result.message);
      setScreen({ name: 'home' });
      return;
    }
    setMessage(null);
    // 최고 기록 선(prd-r4 §7.2-F): 같은 학년·난이도의 이 기기 기록 중 최고를 판을 열 때 한 번만 읽는다. 읽지 못하면 기록 없음으로 둔다.
    void bestWaveFor(input.grade, input.difficulty).then(bestWave => setScreen({ name: 'game', controller: result.controller, bestWave }));
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
      if (cleanNickname(settings.lastNickname).error === null) {
        setScreen({ name: 'home', initialModal: 'new' });
      } else {
        setMessage('연습을 잘 마쳤어요. 닉네임을 적고 새 게임을 눌러 보세요.');
        setScreen({ name: 'home', focusNickname: true });
      }
      return;
    }
    setScreen({ name: 'home' });
  };

  const exitGame = (controller: RunController, reason: 'over' | 'abandon', previousBest: number | null) => {
    const final = structuredClone(controller.state) as RunState;
    // 판이 끝날 때 오답 노트에 담은 수(prd-r4 §6.1). 기록 쓰기가 아직 안 끝났으면 null이라 결과의 노트 줄을 숨긴다.
    const reviewDelta = controller.getView().reviewDelta;
    controller.dispose();
    setScreen(reason === 'over' ? { name: 'result', state: final, reviewDelta, previousBest } : { name: 'home' });
  };

  const noteGrade = screen.name === 'result' ? screen.state.config.grade : settings.lastGrade;
  const noteContent = useGradeContent(noteGrade);
  const noteItems = screen.name === 'home' || screen.name === 'note' ? reviewNoteItems(noteGrade) : [];

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          message={message}
          settings={settings}
          initialModal={screen.initialModal ?? null}
          focusNicknameOnMount={screen.focusNickname ?? false}
          onOpenNote={() => setScreen({ name: 'note', back: { name: 'home' } })}
          noteCount={noteItems.length}
          onHistoryCleared={() => setNoteTick(t => t + 1)}
          onClearMessage={() => setMessage(null)}
          onStartNew={startNew}
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
      return <NoteScreen entries={buildNoteEntries(noteItems, reviewQuestions(noteGrade))} loading={noteContent.status === 'loading' || noteContent.status === 'unloaded'} loadError={noteContent.status === 'error'} onRetry={noteContent.retry} onBack={() => setScreen(screen.back)} />;
  }
}
