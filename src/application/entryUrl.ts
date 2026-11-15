import { isGradeAvailable } from '../content';
import { cleanPublicSchoolCode, cleanPublicSchoolName } from '../contracts/lobby';
import type { Settings } from '../persistence/settings';

/** QR·공유 링크 진입 뒤 주소창에서 지워 재진입·새로고침 때 설정을 덮어쓰지 않게 하는 일회성 파라미터. */
const CONSUMABLE_QUERY_KEYS = [
  'grade',
  'school',
  'sc',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'igshid',
  'kakao_agent',
] as const;

export interface ParsedEntryUrl {
  patch: Partial<Settings>;
  cleanedSearch: string;
  changed: boolean;
}

/**
 * 교실 QR·공유 링크 쿼리(`?grade=3&school=서울초등학교&sc=7010057`)를 읽어 설정 변경분과 정리된 쿼리 문자열을 돌려준다.
 * 개발 점검용 `?previewMap`·`?qaRun`은 그대로 보존한다.
 */
export function parseEntrySearchParams(search: string): ParsedEntryUrl {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return { patch: {}, cleanedSearch: '', changed: false };

  const params = new URLSearchParams(raw);
  const patch: Partial<Settings> = {};

  const rawGrade = params.get('grade')?.trim();
  if (rawGrade === '3' || rawGrade === '4' || rawGrade === '5' || rawGrade === '6') {
    const g = Number(rawGrade) as 3 | 4 | 5 | 6;
    if (isGradeAvailable(g)) {
      patch.lastGrade = g;
    }
  }

  const rawSchool = params.get('school');
  if (rawSchool !== null) {
    const cleanedSchool = cleanPublicSchoolName(rawSchool);
    if (cleanedSchool) {
      patch.lastSchoolName = cleanedSchool;
      patch.lastSchoolCode = cleanPublicSchoolCode(params.get('sc'));
    }
  }

  let changed = false;
  for (const key of CONSUMABLE_QUERY_KEYS) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }

  const nextQuery = params.toString();
  return {
    patch,
    cleanedSearch: nextQuery ? `?${nextQuery}` : '',
    changed,
  };
}

/**
 * 앱 첫 마운트 때 현재 주소의 QR·공유 링크 설정을 읽어 오고 주소창에서 일회성 파라미터를 치운다.
 */
export function consumeEntryUrlPatch(): Partial<Settings> | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const { patch, cleanedSearch, changed } = parseEntrySearchParams(window.location.search);
  if (changed && typeof window.history?.replaceState === 'function') {
    try {
      const nextUrl = `${window.location.pathname}${cleanedSearch}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    } catch {
      // 제한된 웹뷰에서 replaceState가 막혀도 게임 시작은 그대로 진행한다.
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * 교실 칠판·학급 알림장용 입장 주소를 만든다.
 */
export function buildClassroomShareUrl(opts: {
  origin?: string;
  pathname?: string;
  grade: 3 | 4 | 5 | 6;
  schoolName?: string;
  schoolCode?: string;
}): string {
  const origin =
    opts.origin ??
    (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://voca.ssamuniverse.com');
  const pathname =
    opts.pathname ??
    (typeof window !== 'undefined' && window.location?.pathname ? window.location.pathname : '/');

  const params = new URLSearchParams();
  params.set('grade', String(opts.grade));
  const school = cleanPublicSchoolName(opts.schoolName);
  if (school) {
    params.set('school', school);
    const code = cleanPublicSchoolCode(opts.schoolCode);
    if (code) params.set('sc', code);
  }
  const qs = params.toString();
  return `${origin.replace(/\/+$/, '')}${pathname.startsWith('/') ? pathname : `/${pathname}`}${qs ? `?${qs}` : ''}`;
}

/**
 * 메신저·알림장 앱 안 브라우저(인앱 웹뷰) 여부를 판별해 앱 이름을 돌려준다. 일반 브라우저면 null.
 */
export function detectInAppBrowser(userAgent?: string): string | null {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return null;
  if (/KAKAOTALK/i.test(ua)) return '카카오톡';
  if (/Classting/i.test(ua)) return '클래스팅';
  if (/\bBAND\//i.test(ua)) return '밴드';
  if (/NAVER\(inapp/i.test(ua)) return '네이버 앱';
  if (/Instagram/i.test(ua)) return '인스타그램';
  if (/FBAN|FBAV/i.test(ua)) return '페이스북';
  if (/\bLine\//i.test(ua)) return '라인';
  return null;
}
