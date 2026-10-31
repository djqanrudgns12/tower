import type { BranchId, DifficultyId, TowerId } from '../contracts/balance';
import { cleanPublicNickname } from '../contracts/lobby';
import type { CommandError } from '../domain/run';
import type { PauseReason } from '../domain/types';

// 학생에게 보이는 문구는 모두 이 표에서 나온다(PRD §2.3, §12.6). 해요체, 짧게, 느낌표는 화면당 하나.
export const DIFFICULTY_COPY: Record<DifficultyId, { label: string; hint: string }> = {
  Easy: { label: '쉬움', hint: '적이 약하고 기본 낱말 위주예요' },
  Normal: { label: '보통', hint: '처음이라면 추천해요' },
  Hard: { label: '어려움', hint: '적이 세고 속담·방언도 나와요' },
  Crazy: { label: '아주 어려움', hint: '성문이 약하고 심화·방언이 많아요' },
};

export const TOWER_COPY: Record<TowerId, { role: string; good: string }> = {
  archer: { role: '빠르게 쏘는 화살', good: '처음 놓기 좋아요' },
  crossbow: { role: '멀리서 세게 쏘는 쇠뇌', good: '단단한 적에게 좋아요' },
  cannon: { role: '터져서 여러 마리', good: '적이 몰린 곳에 좋아요' },
  mage: { role: '마법으로 쏘는 구슬', good: '껍질이 단단한 적에게 좋아요' },
  frost: { role: '맞은 적을 느리게', good: '다른 타워와 함께 쓰면 좋아요' },
  lightning: { role: '여러 적에게 튀는 번개', good: '적이 줄지어 올 때 좋아요' },
  flame: { role: '앞쪽 여러 적을 태워요', good: '길 가까이 놓으면 좋아요' },
  spear: { role: '아주 빠르게 찌르는 창', good: '길 바로 옆에 좋아요' },
  guardian: { role: '강한 기사 한 명', good: '한 기만 놓을 수 있어요' },
  banner: { role: '주변 타워를 돕는 깃발', good: '강한 타워 옆에 좋아요' },
  // 리뉴얼 신규 10종(docs/renewal/catalog/towers.md §1 역할 한 줄). 화면 문구는 R1이 다듬는다.
  sling: { role: '적 사이를 통통 튀는 돌팔매', good: '초반에 싸게 놓기 좋아요' },
  ballista: { role: '긴 직선을 꿰뚫는 창', good: '곧은 길 끝에 좋아요' },
  falcon: { role: '하늘 적을 낚아채는 매', good: '날아오는 적에게 좋아요' },
  mortar: { role: '먼 길 너머로 쏘는 곡사포', good: '길에서 조금 먼 칸에 좋아요' },
  hwacha: { role: '불화살을 쏟아붓는 화차', good: '적이 몰려올 때 좋아요' },
  roller: { role: '길을 거슬러 구르는 통나무', good: '곧은 길 출구 쪽에 좋아요' },
  alchemist: { role: '길 위에 남는 물약', good: '길목에 놓으면 좋아요' },
  wind: { role: '돌풍으로 뒤로 밀쳐요', good: '다른 타워 앞에 좋아요' },
  trap: { role: '길 위에 덫을 깔아요', good: '성문 가까이 좋아요' },
  bell: { role: '울림으로 적을 약하게', good: '교차로 가운데 좋아요' },
};

export const PAUSE_COPY: Record<PauseReason, string> = {
  USER: '잠시 멈췄어요.',
  HIDDEN: '화면을 떠나서 멈췄어요.',
  PERFORMANCE: '기기가 잠시 느려져서 멈췄어요.',
  RESTORED: '저장한 곳에서 다시 시작해요. 준비되면 계속을 눌러 주세요.',
  CONTEXT_LOST: '화면이 잠시 꺼졌다가 돌아왔어요. 준비되면 계속을 눌러 주세요.',
  STORAGE: '아직 저장되지 않았어요.',
  OWNERSHIP: '다른 창에서 이 게임을 하고 있어요.',
  NUMERIC_LIMIT: '이 판은 숫자가 너무 커져 더 진행할 수 없어요. 지금까지의 기록은 남아 있어요.',
};

export const RENDER_WAIT = '화면을 다시 그리는 중이에요. 잠시만 기다려 주세요.';

export function commandErrorText(error: CommandError, extra?: { need?: number }): string {
  switch (error) {
    case 'NOT_ENOUGH_GOLD': return extra?.need ? `골드 ${extra.need} 부족` : '골드가 부족해요';
    case 'WRONG_PHASE': return '지금은 할 수 없어요';
    case 'SLOT_TAKEN': return '이미 타워가 있어요';
    case 'MAX_LEVEL': return '최고 레벨이에요';
    case 'FORM_REQUIRED': return '진화할 길을 먼저 골라요';
    case 'NEXT_NOT_READY': return '해설을 조금 더 읽어 주세요';
    case 'PAUSED': return '멈춘 동안에는 할 수 없어요';
    default: return '다시 해 주세요';
  }
}

export const BRANCH_MARK: Record<BranchId, string> = { A: '동그라미 길', B: '마름모 길' };

export const fmtDamage = (milli: number) => {
  const v = milli / 1000;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
export const fmtSeconds = (ticks: number) => {
  const v = ticks / 30;
  return `${Number.isInteger(v) ? v : Number(v.toFixed(2))}초마다`;
};
export const fmtCells = (milli: number) => `${(milli / 1000).toFixed(milli % 1000 === 0 ? 0 : 1)}칸`;
export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
export const fmtNumber = (n: number) => (n < 0 ? `−${Math.abs(n).toLocaleString('ko-KR')}` : n.toLocaleString('ko-KR'));

/** 홈 별명 입력과 공개 제출은 같은 규칙을 쓴다: NFC·NFKC, 제어문자 제거, 2~12글자, 전화번호·이메일·주소 차단(PRD §2.1). */
export function cleanNickname(raw: string): { value: string; error: string | null } {
  return cleanPublicNickname(raw);
}

/** 받침에 따라 ‘로/으로’(ㄹ 받침은 ‘로’). */
export function withRo(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const jong = code % 28;
  return `${word}${jong === 0 || jong === 8 ? '로' : '으로'}`;
}
