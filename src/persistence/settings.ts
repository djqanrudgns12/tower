// 환경설정은 기기에 따로 저장하며 전투 판정에 영향을 주지 않는다(PRD §2, §17.1).
export type FontScale = 'base' | 'large' | 'xlarge';
export type MotionMode = 'full' | 'simple' | 'minimal';
export type VolumeStepBgm = 0 | 0.1 | 0.2 | 0.35 | 0.5;
export type VolumeStepSfx = 0 | 0.2 | 0.4 | 0.6 | 0.8;

export const BGM_STEPS: readonly VolumeStepBgm[] = [0, 0.1, 0.2, 0.35, 0.5];
export const SFX_STEPS: readonly VolumeStepSfx[] = [0, 0.2, 0.4, 0.6, 0.8];

export interface Settings {
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
  reducedMotion: false,
  lastDifficulty: 'Normal',
  lastNickname: '',
  playerId: crypto.randomUUID(),
  practiceSeen: false,
  soundOn: true,
  lastGrade: 3,
  bgmVolume: 0.2,
  sfxVolume: 0.4,
  motionMode: 'full',
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
      // Windows 시각 효과(창 애니메이션 꺼짐)로 인해 사용자 선택 없이 'minimal'로 굳어진 기존 저장본을 기본 연출('full')로 복구한다.
      const sanitized: Partial<Settings> = parsed.motionCustomized
        ? parsed
        : { ...parsed, motionMode: 'full', reducedMotion: false, motionCustomized: false };
      const loaded = normalizeSettings(base, sanitized);
      if (!parsed.motionCustomized && (parsed.motionMode !== 'full' || parsed.reducedMotion === true)) {
        saveSettings(loaded);
      }
      return loaded;
    }
  } catch { /* 저장소 차단 시 기본값으로 진행한다 */ }
  saveSettings(base);
  return base;
}

export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 차단된 저장소 */ }
}
