// 환경설정은 기기에 따로 저장하며 전투 판정에 영향을 주지 않는다(PRD §2, §17.1).
export type FontScale = 'base' | 'large' | 'xlarge';
export interface Settings { fontScale: FontScale; reducedMotion: boolean; lastDifficulty: string; lastNickname: string; playerId: string }

const KEY = 'vocabulary-td.settings';

const defaults = (): Settings => ({
  fontScale: 'base',
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  lastDifficulty: 'Normal',
  lastNickname: '',
  playerId: crypto.randomUUID(),
});

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* 저장소 차단 시 기본값으로 진행한다 */ }
  const fresh = defaults();
  saveSettings(fresh);
  return fresh;
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 차단된 저장소 */ }
}
