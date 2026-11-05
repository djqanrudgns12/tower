// 이모지·유니코드 특수문자 없이 모든 환경에서 똑같이 보이는 공예 아이콘 및 정품 UI 원화 래퍼(PRD §12.8).

interface SvgProps {
  className?: string | undefined;
}

/** public/assets/ui 아래 정품 WebP 원화 아이콘을 꾸밈 요소(aria-hidden)로 그린다. */
export function HomeUiArt({ file, className }: { file: string; className?: string | undefined }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/ui/${file}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
    />
  );
}

export function GearIcon({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M8.6 2.5h2.8l.4 2.1a5.8 5.8 0 0 1 1.4.8l2-.8 1.4 2.4-1.6 1.4c.1.5.1 1.1 0 1.6l1.6 1.4-1.4 2.4-2-.8a5.8 5.8 0 0 1-1.4.8l-.4 2.1H8.6l-.4-2.1a5.8 5.8 0 0 1-1.4-.8l-2 .8-1.4-2.4 1.6-1.4a5.8 5.8 0 0 1 0-1.6L3.4 7l1.4-2.4 2 .8a5.8 5.8 0 0 1 1.4-.8l.4-2.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="9.8" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function BookIcon({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M3 4.5C3 3.7 3.7 3 4.5 3H9c.6 0 1 .4 1 1v12.5c-.6-.4-1.3-.5-2-.5H4.5C3.7 16 3 15.3 3 14.5v-10zm14 0c0-.8-.7-1.5-1.5-1.5H11c-.6 0-1 .4-1 1v12.5c.6-.4 1.3-.5 2-.5h3.5c.8 0 1.5-.7 1.5-1.5v-10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RecordIcon({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <rect x="4" y="3" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 7.5h6M7 10.5h6M7 13.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NoteIcon({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path d="M5.5 3h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-9z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5.5 3A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 3v5.5l1.5-1.2 1.5 1.2V3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function TrophyIcon({ className }: SvgProps = {}) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M6 3.5h8v4.2a4 4 0 0 1-8 0V3.5zm0 1.5H3.8v1.5a2.6 2.6 0 0 0 2.2 2.5m8-4h2.2v1.5A2.6 2.6 0 0 1 14 9m-4 2.8v3.2m-3 1.5h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: SvgProps = {}) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path d="M10 3.5L5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: SvgProps = {}) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShuffleIcon({ className }: SvgProps = {}) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path
        d="M2.5 4.5h2.7c1.6 0 2.6 1.5 3.6 3.5 1 2 2 3.5 3.6 3.5h1.6m-2-2l2 2-2 2M2.5 11.5h2.7c.9 0 1.6-.5 2.2-1.3M10.4 5.8c.6-.8 1.3-1.3 2.2-1.3H14m-2-2l2 2-2 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PencilIcon({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M13.6 3.6a1.8 1.8 0 0 1 2.5 2.5l-8.8 8.8-3.6.9.9-3.6 8.8-8.8zM11.8 5.4l2.5 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SchoolIcon({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M3 8.2L10 4l7 4.2V16H3V8.2zm4.8 7.8v-4.2h4.4V16M10 7.2h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PracticeTargetIcon({ className }: SvgProps = {}) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="10" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}
