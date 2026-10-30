// 환경설정은 기기에 따로 저장하며 전투 판정에 영향을 주지 않는다(PRD §2, §17.1).
export type FontScale = 'base' | 'large' | 'xlarge';
export type MotionMode = 'full' | 'simple' | 'minimal';
export type VolumeStepBgm = 0 | 0.1 | 0.2 | 0.35 | 0.5;
export type VolumeStepSfx = 0 | 0.2 | 0.4 | 0.6 | 0.8;

export const BGM_STEPS: readonly VolumeStepBgm[] = [0, 0.1, 0.2, 0.35, 0.5];
export const SFX_STEPS: readonly VolumeStepSfx[] = [0, 0.2, 0.4, 0.6, 0.8];

export const SETTINGS_CHANGED_EVENT = 'vocabulary-td.settingsChanged';

export interface Settings {
  /** 공개 기록은 명시적으로 켠 기기에서만 통신한다. 구 저장본은 false. */
  shareRecords?: boolean;
  fontScale: FontScale;
  /** motionMode === 'minimal'의 파생 호환 필드(PRD §17.1). */
  reducedMotion: boolean;
  lastDifficulty: string;
  lastNickname: string;
  playerId: string;
  /** 첫 연습 판을 마치거나 건너뛰었다(하위 호환 유지). */
  practiceSeen: boolean;
  /** 소리 켜기(PRD §11.5 음소거). 전투 판정과 무관하다. */
  soundOn: boolean;
  /** 마지막으로 고른 학년(3~6). */
  lastGrade: 3 | 4 | 5 | 6;
  /** 배경 음악 크기 단계(기본 0.2). */
  bgmVolume: VolumeStepBgm;
  /** 효과음 크기 단계(기본 0.4). */
  sfxVolume: VolumeStepSfx;
  /** 배경 움직임 단계: 전체('full') · 바람/낙엽만('simple') · 정지('minimal'). */
  motionMode: MotionMode;
  /** 사용자가 환경설정에서 배경 움직임 단계를 직접 선택했는지 여부. */
  motionCustomized?: boolean;
  /** 전장 길·돌 받침 고대비 보조 윤곽선 표시. */
  highContrastMap: boolean;
  /** 문제 보기(1~4) 단축키 번호 배지 표시. */
  showKeyHints: boolean;
}

const KEY = 'vocabulary-td.settings';

function nearestStep<T extends number>(steps: readonly T[], value: unknown, fallback: T): T {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  let best = steps[0]!;
  let bestDiff = Math.abs(value - best);
  for (const s of steps) {
    const diff = Math.abs(value - s);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return best;
}

function normalizeGrade(value: unknown): 3 | 4 | 5 | 6 {
  return value === 3 || value === 4 || value === 5 || value === 6 ? value : 3;
}

function normalizeFontScale(value: unknown): FontScale {
  return value === 'base' || value === 'large' || value === 'xlarge' ? value : 'base';
}

const defaults = (): Settings => ({
  fontScale: 'base',
  shareRecords: false,
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  lastDifficulty: 'Normal',
  lastNickname: '',
  playerId: crypto.randomUUID(),
  practiceSeen: false,
  soundOn: true,
  lastGrade: 3,
  bgmVolume: 0.2,
  sfxVolume: 0.4,
  motionMode: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'minimal' : 'full',
  motionCustomized: false,
  highContrastMap: false,
  showKeyHints: true,
});

/** v1 저장본과 부분 패치를 정규화하고 motionMode ↔ reducedMotion을 일치시킨다. */
export function normalizeSettings(base: Settings, raw: Partial<Settings>): Settings {
  let motionMode: MotionMode = base.motionMode;
  if (raw.motionMode === 'full' || raw.motionMode === 'simple' || raw.motionMode === 'minimal') {
    motionMode = raw.motionMode;
  } else if (typeof raw.reducedMotion === 'boolean') {
    motionMode = raw.reducedMotion ? 'minimal' : (base.motionMode === 'minimal' ? 'full' : base.motionMode);
  }
  const reducedMotion = motionMode === 'minimal';
  const motionCustomized =
    typeof raw.motionCustomized === 'boolean' ? raw.motionCustomized : Boolean(base.motionCustomized);
  return {
    shareRecords: typeof raw.shareRecords === 'boolean' ? raw.shareRecords : (base.shareRecords ?? false),
    fontScale: raw.fontScale !== undefined ? normalizeFontScale(raw.fontScale) : base.fontScale,
    reducedMotion,
    lastDifficulty: typeof raw.lastDifficulty === 'string' && raw.lastDifficulty ? raw.lastDifficulty : base.lastDifficulty,
    lastNickname: typeof raw.lastNickname === 'string' ? raw.lastNickname : base.lastNickname,
    playerId: typeof raw.playerId === 'string' && raw.playerId ? raw.playerId : base.playerId,
    practiceSeen: typeof raw.practiceSeen === 'boolean' ? raw.practiceSeen : base.practiceSeen,
    soundOn: typeof raw.soundOn === 'boolean' ? raw.soundOn : base.soundOn,
    lastGrade: raw.lastGrade !== undefined ? normalizeGrade(raw.lastGrade) : base.lastGrade,
    bgmVolume: raw.bgmVolume !== undefined ? nearestStep(BGM_STEPS, raw.bgmVolume, base.bgmVolume) : base.bgmVolume,
    sfxVolume: raw.sfxVolume !== undefined ? nearestStep(SFX_STEPS, raw.sfxVolume, base.sfxVolume) : base.sfxVolume,
    motionMode,
    motionCustomized,
    highContrastMap: typeof raw.highContrastMap === 'boolean' ? raw.highContrastMap : base.highContrastMap,
    showKeyHints: typeof raw.showKeyHints === 'boolean' ? raw.showKeyHints : base.showKeyHints,
  };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return normalizeSettings(base, parsed);
    }
  } catch { /* 저장소 차단 시 기본값으로 진행한다 */ }
  saveSettings(base);
  return base;
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 차단된 저장소 */ }
  if (typeof window !== 'undefined') queueMicrotask(() => window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT)));
}

/** 저장소 접근 실패도 동의 없음으로 취급한다. 인증·RPC·Presence의 공통 입구다. */
export function isRecordSharingEnabled(): boolean {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>).shareRecords === true; } catch { return false; }
}
