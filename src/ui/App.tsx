import { useCallback, useEffect, useState } from 'react';
import type { RunController } from '../application/RunController';
import {
  loadSettings,
  normalizeSettings,
  saveSettings,
  startNewRun,
  startPractice,
  type FontScale,
  type Settings,
  type StartResult,
} from '../application/session';
import type { DifficultyId } from '../contracts/balance';
import { PILOT_TOWERS } from '../content';
import type { RunState } from '../domain/types';
import { cleanNickname } from './copy';
import { GameScreen } from './game/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ResultScreen } from './screens/ResultScreen';

type Screen =
  | { name: 'home'; initialModal?: 'new' | null; focusNickname?: boolean }
  | { name: 'game'; controller: RunController; practice?: boolean }
  | { name: 'result'; state: RunState };

export function App() {
  const [rawSettings, setSettings] = useState<Settings>(loadSettings);
  const settings: Settings =
    !rawSettings.motionCustomized && (rawSettings.motionMode !== 'full' || rawSettings.reducedMotion)
      ? { ...rawSettings, motionMode: 'full', reducedMotion: false, motionCustomized: false }
      : rawSettings;
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { document.documentElement.dataset.font = settings.fontScale; }, [settings.fontScale]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const base: Settings =
        !prev.motionCustomized && (prev.motionMode !== 'full' || prev.reducedMotion)
          ? { ...prev, motionMode: 'full', reducedMotion: false, motionCustomized: false }
          : prev;
      const next = normalizeSettings(base, patch);
      saveSettings(next);
      return next;
    });
  }, []);

  const open = (result: StartResult) => {
    if (!result.ok) {
      setMessage(result.message);
      setScreen({ name: 'home' });
      return;
    }
    setMessage(result.warning);
    setScreen({ name: 'game', controller: result.controller });
  };

  const startNew = (input: { grade: 3 | 4 | 5 | 6; difficulty: DifficultyId; nickname: string }) => {
    update({ lastGrade: input.grade, lastDifficulty: input.difficulty, lastNickname: input.nickname });
    void startNewRun({ ...input, playerId: settings.playerId }).then(open);
  };

  const startPracticeRun = () => {
    setMessage(null);
    setScreen({ name: 'game', controller: startPractice(settings.playerId), practice: true });
  };

  /** 연습은 기록·결과 화면 없이 끝난다. 새 게임으로 갈 때 별명이 없으면 첫 화면 별명 칸으로 안내한다. */
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
        setMessage('연습을 잘 마쳤어요. 출정 별명을 적고 새 게임을 눌러 보세요.');
        setScreen({ name: 'home', focusNickname: true });
      }
      return;
    }
    setScreen({ name: 'home' });
  };

  const exitGame = (controller: RunController, reason: 'over' | 'abandon') => {
    const final = structuredClone(controller.state) as RunState;
    controller.dispose();
    setScreen(reason === 'over' ? { name: 'result', state: final } : { name: 'home' });
  };

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          message={message}
          settings={settings}
          initialModal={screen.initialModal ?? null}
          focusNicknameOnMount={screen.focusNickname ?? false}
          onClearMessage={() => setMessage(null)}
          onStartNew={startNew}
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
          onFont={(f: FontScale) => update({ fontScale: f })}
          onSound={(on: boolean) => update({ soundOn: on })}
          onExit={reason => (screen.practice ? finishPractice(screen.controller, 'home') : exitGame(screen.controller, reason))}
          {...(screen.practice ? { practice: { onFinish: (next: 'new' | 'again' | 'home') => finishPractice(screen.controller, next) } } : {})}
        />
      );
    case 'result':
      return (
        <ResultScreen
          state={screen.state}
          onAgain={() => setScreen({ name: 'home', initialModal: 'new' })}
          onHome={() => setScreen({ name: 'home' })}
        />
      );
  }
}
