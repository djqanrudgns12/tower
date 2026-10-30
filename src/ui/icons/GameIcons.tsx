import type { BranchId, TowerId } from '../../contracts/balance';

/**
 * 시안 1 (왕국 원정대 정통 공방 v3) 전용 단일 선 두께(1.6px) 문장형 벡터 아이콘 및 1:1 방패 초상화.
 * PRD §12.8 준수: 이모지·비정규 유니코드 기호 0, CSS 그라데이션 0, 단색 계단식 명암만 사용한다.
 */
const baseStyle = { display: 'inline-block', verticalAlign: 'middle', flex: 'none' } as const;

export function GateShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={baseStyle} aria-hidden="true">
      <path d="M4 3.5h3v2h2v-2h2v2h2v-2h3v7.2c0 3.8-2.9 6.3-6 7.8-3.1-1.5-6-4-6-7.8V3.5z" fill="#8f5d38" stroke="#362419" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 10.5h4v4.8c-.7.5-1.3.9-2 1.2-.7-.3-1.3-.7-2-1.2v-4.8z" fill="#dfd1b8" stroke="#362419" strokeWidth="1.2" />
    </svg>
  );
}

export function GoldCoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={baseStyle} aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="#ffd859" stroke="#362419" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="5.2" fill="#eab32e" stroke="#6b4225" strokeWidth="1.1" />
      <path d="M10 6.5l1.1 2.2 2.4.3-1.7 1.7.4 2.4L10 12l-2.2 1.1.4-2.4-1.7-1.7 2.4-.3L10 6.5z" fill="#fff6cc" />
    </svg>
  );
}

export function ScoreCrestIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={baseStyle} aria-hidden="true">
      <polygon points="10,2 17,6 17,13.5 10,18 3,13.5 3,6" fill="#235885" stroke="#362419" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="10,4.5 14.6,7.2 14.6,12.3 10,15.2 5.4,12.3 5.4,7.2" fill="#3a7ab0" />
      <path d="M10 6.3l1.1 2.2 2.4.4-1.8 1.6.5 2.4L10 11.7l-2.2 1.2.5-2.4-1.8-1.6 2.4-.4L10 6.3z" fill="#fbf3e4" />
    </svg>
  );
}

export function BurningGemIcon({ active, size = 14 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={baseStyle} aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill={active ? '#ffd859' : '#26170e'} stroke={active ? '#fbf3e4' : '#7a583b'} strokeWidth="1.5" />
      {active && <circle cx="8" cy="8" r="3" fill="#c94b24" />}
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

export function CheckSealIcon({ size = 22, label }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      style={baseStyle}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <rect x="2" y="2" width="18" height="18" rx="4" fill="#2d6336" stroke="#362419" strokeWidth="1.6" />
      <path d="M6.2 11.3l3.2 3.3 6.4-6.8" fill="none" stroke="#fcf7eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrossSealIcon({ size = 22, label }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      style={baseStyle}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <rect x="2" y="2" width="18" height="18" rx="4" fill="#a3352b" stroke="#362419" strokeWidth="1.6" />
      <path d="M7 7l8 8M15 7l-8 8" fill="none" stroke="#fcf7eb" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function LockPadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={baseStyle} aria-hidden="true">
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3.2" y="7" width="9.6" height="7" rx="2" fill="currentColor" />
    </svg>
  );
}

export function PauseBarsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={baseStyle} aria-hidden="true">
      <rect x="5" y="4" width="3.6" height="12" rx="1" fill="currentColor" />
      <rect x="11.4" y="4" width="3.6" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

export function PlayArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={baseStyle} aria-hidden="true">
      <path d="M6 4.2l10 5.8-10 5.8V4.2z" fill="currentColor" />
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

const FIXED_UP_WEAPONS = new Set<TowerId>(['frost', 'lightning']);

/** 1:1 정방형 방패 액자 초상화 (기존 1.25배 세로 왜곡 버그 수정). */
export function TowerShieldPortrait({
  type,
  icons,
  size = 42,
}: {
  type: TowerId;
  icons: Record<string, string>;
  size?: number;
}) {
  const body = icons[`tower.${type}`];
  const weapon = icons[`tower.${type}.weapon`];
  const rotate = FIXED_UP_WEAPONS.has(type) ? undefined : 'rotate(-90deg)';
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: 'none',
        position: 'relative',
        background: 'var(--wood-dark)',
        border: '2px solid var(--wood-collar)',
        outline: '2px solid var(--edge)',
        borderRadius: 'var(--r-input)',
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
