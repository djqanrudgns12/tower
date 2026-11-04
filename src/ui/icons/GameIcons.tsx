import type { BranchId, TowerId } from '../../contracts/balance';

/**
 * 게임 그림 아이콘(금화·진화 갈래 표식·능력치·도구 키)과 1:1 방패 초상화. 누르는 조작 아이콘은 ControlIcons 한 세트다.
 * PRD §12.8 준수: 이모지·비정규 유니코드 기호 0, CSS 그라데이션 0, 단색 계단식 명암만 사용한다.
 */
const baseStyle = { display: 'inline-block', verticalAlign: 'middle', flex: 'none' } as const;

export function GoldCoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={baseStyle} aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="#ffd859" stroke="#362419" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="5.2" fill="#eab32e" stroke="#6b4225" strokeWidth="1.1" />
      <path d="M10 6.5l1.1 2.2 2.4.3-1.7 1.7.4 2.4L10 12l-2.2 1.1.4-2.4-1.7-1.7 2.4-.3L10 6.5z" fill="#fff6cc" />
    </svg>
  );
}

export function BranchMarkIcon({ id, size = 22 }: { id: BranchId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={baseStyle} aria-hidden="true">
      {id === 'A' ? (
        <>
          <circle cx="11" cy="11" r="8.5" fill="#235885" stroke="#362419" strokeWidth="2.2" />
          <circle cx="11" cy="11" r="3.6" fill="#fbf3e4" />
        </>
      ) : (
        <>
          <polygon points="11,2 20,11 11,20 2,11" fill="#a3352b" stroke="#362419" strokeWidth="2.2" strokeLinejoin="round" />
          <polygon points="11,6.8 15.2,11 11,15.2 6.8,11" fill="#fbf3e4" />
        </>
      )}
    </svg>
  );
}

export function ChevronDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={baseStyle} aria-hidden="true">
      <path d="M2.2 4.2L6 8l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 능력치 막대 아이콘: 공격력(검), 공격 속도(과녁), 사거리(조준). 한 선 두께 1.6px, currentColor. */
export function StatPowerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={baseStyle} aria-hidden="true">
      <path d="M3 13l7.2-7.2M10.2 5.8l2.6-2.6 .3 2.9-2.9-.3zM2.5 10.6l2.9 2.9M4.3 12.4l-1.6 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatSpeedIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={baseStyle} aria-hidden="true">
      <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.8V8l2.4 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatRangeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={baseStyle} aria-hidden="true">
      <circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 1.6v3M8 11.4v3M1.6 8h3M11.4 8h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 도구 키 아이콘(강화·진화·판매·되돌리기): 한 세트, 18 viewBox에 선 2px·둥근 끝, 색은 글자색(currentColor)을 따른다(ui-rules-v4 C6). */
const toolStroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 강화: 위 화살표. */
export function UpgradeArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={baseStyle} aria-hidden="true">
      <path d="M9 15V4M4.5 8.2L9 3.6l4.5 4.6" {...toolStroke} />
    </svg>
  );
}

/** 판매: 동전을 내려놓는다. */
export function SellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={baseStyle} aria-hidden="true">
      <circle cx="9" cy="6.8" r="4.2" {...toolStroke} />
      <path d="M3 15h12M9 11v4" {...toolStroke} />
    </svg>
  );
}

/** 진화: 별빛(큰 별 윤곽 + 작은 반짝임). */
export function EvolveIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={baseStyle} aria-hidden="true">
      <path d="M8 2.5l1.5 3.8 3.8 1.5-3.8 1.5L8 13.1l-1.5-3.8-3.8-1.5 3.8-1.5L8 2.5z" {...toolStroke} />
      <path d="M14.5 11.5v4M12.5 13.5h4" {...toolStroke} />
    </svg>
  );
}

/** 되돌리기: 왼쪽으로 굽은 화살표. 설치 직후 되돌리기 칩용. */
export function UndoArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={baseStyle} aria-hidden="true">
      <path d="M6.5 4.2L3 7.6l3.5 3.4M3.4 7.6h7.1a4.4 4.4 0 010 8.8H8" {...toolStroke} />
    </svg>
  );
}

const FIXED_UP_WEAPONS = new Set<TowerId>(['frost', 'lightning']);

/** 1:1 정방형 방패 액자 초상화 (기존 1.25배 세로 왜곡 버그 수정). */
export function TowerShieldPortrait({
  type,
  icons,
  size = 42,
  bare = false,
}: {
  type: TowerId;
  icons: Record<string, string>;
  /** 정사각 한 변(px). 'fill'이면 담는 칸을 가득 채운다(칸 쪽이 정사각을 정한다). */
  size?: number | 'fill';
  /** 액자 없이 그림만(장착 홈 소켓처럼 바깥이 이미 홈일 때). */
  bare?: boolean;
}) {
  const body = icons[`tower.${type}`];
  const weapon = icons[`tower.${type}.weapon`];
  const rotate = FIXED_UP_WEAPONS.has(type) ? undefined : 'rotate(-90deg)';
  return (
    <span
      style={{
        width: size === 'fill' ? '100%' : size,
        height: size === 'fill' ? '100%' : size,
        flex: 'none',
        position: 'relative',
        ...(bare ? {} : { background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }),
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {body && (
        <img
          src={body}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            width: '90%',
            height: '90%',
            top: '5%',
            left: '5%',
            objectFit: 'contain',
          }}
        />
      )}
      {weapon && (
        <img
          src={weapon}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            width: '64%',
            height: '64%',
            top: '6%',
            left: '18%',
            objectFit: 'contain',
            ...(rotate ? { transform: rotate } : {}),
          }}
        />
      )}
    </span>
  );
}
