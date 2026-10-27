import { useCallback, useEffect, useState } from 'react';
import type { RunController } from '../application/RunController';
import { loadSaved, loadSettings, resumeRun, saveSettings, startNewRun, type FontScale, type LoadResult, type Settings, type StartResult } from '../application/session';
import type { DifficultyId } from '../contracts/balance';
import { PILOT_TOWERS } from '../content';
import type { RunState } from '../domain/types';
import { GameScreen } from './game/GameScreen';
import { GuideScreen } from './screens/GuideScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewGameScreen } from './screens/NewGameScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { ResultScreen } from './screens/ResultScreen';

type Screen =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'game'; controller: RunController }
  | { name: 'result'; state: RunState }
  | { name: 'records' }
  | { name: 'guide' };

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [saved, setSaved] = useState<LoadResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { document.documentElement.dataset.font = settings.fontScale; }, [settings.fontScale]);
  useEffect(() => {
    if (screen.name !== 'home') return;
    let live = true;
    loadSaved().then(r => { if (live) setSaved(r); }, () => { if (live) setSaved({ kind: 'none' }); });
    return () => { live = false; };
  }, [screen.name]);

  const update = useCallback((patch: Partial<Settings>) => setSettings(prev => { const next = { ...prev, ...patch }; saveSettings(next); return next; }), []);

  const open = (result: StartResult) => {
    if (!result.ok) { setMessage(result.message); setScreen({ name: 'home' }); return; }
    setMessage(result.warning);
    setScreen({ name: 'game', controller: result.controller });
  };

  const startNew = (input: { grade: number; difficulty: DifficultyId; nickname: string }) => {
    update({ lastDifficulty: input.difficulty, lastNickname: input.nickname });
    void startNewRun({ ...input, playerId: settings.playerId }).then(open);
  };

  const resume = () => { if (saved?.kind === 'ok') void resumeRun(saved).then(open); };

  const exitGame = (controller: RunController, reason: 'saved' | 'over' | 'abandon') => {
    const final = structuredClone(controller.state) as RunState;
    controller.dispose();
    setScreen(reason === 'over' ? { name: 'result', state: final } : { name: 'home' });
  };

  switch (screen.name) {
    case 'home':
      return <HomeScreen saved={saved} message={message} settings={settings} onNew={() => { setMessage(null); setScreen({ name: 'new' }); }} onResume={resume} onRecords={() => setScreen({ name: 'records' })} onGuide={() => setScreen({ name: 'guide' })} onSettings={update} />;
    case 'new':
      return <NewGameScreen settings={settings} onBack={() => setScreen({ name: 'home' })} onStart={startNew} />;
    case 'game':
      return (
        <GameScreen
          key={screen.controller.state.config.runId} controller={screen.controller} towers={PILOT_TOWERS} notice={message}
          fontScale={settings.fontScale} reducedMotion={settings.reducedMotion} onFont={(f: FontScale) => update({ fontScale: f })}
          onExit={reason => exitGame(screen.controller, reason)}
        />
      );
    case 'result':
      return <ResultScreen state={screen.state} onAgain={() => setScreen({ name: 'new' })} onHome={() => setScreen({ name: 'home' })} />;
    case 'records':
      return <RecordsScreen onBack={() => setScreen({ name: 'home' })} />;
    case 'guide':
      return <GuideScreen onBack={() => setScreen({ name: 'home' })} />;
  }
}
