import type { ReactNode } from 'react';

/**
 * 조작 아이콘 한 세트(ui-rules-v3 §2.2): 24 viewBox, 선 2px, 둥근 끝, 색은 글자색(currentColor)을 따른다.
 * 상태·적 특성은 원화 PNG(kit ArtIcon)를 쓰고, 여기에는 누르는 조작만 둔다.
 */
interface IconProps { size?: number }

function Svg({ size = 22, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      {children}
    </svg>
  );
}

export const PauseIcon = (p: IconProps) => <Svg {...p}><path d="M9 5v14M15 5v14" /></Svg>;
export const PlayIcon = (p: IconProps) => <Svg {...p}><path d="M8 5l11 7-11 7z" fill="currentColor" /></Svg>;
export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M4.2 6.5l2.6 1.5M17.2 16l2.6 1.5M4.2 17.5l2.6-1.5M17.2 8l2.6-1.5" />
    <circle cx="12" cy="12" r="7" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const BackIcon = (p: IconProps) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const SoundOnIcon = (p: IconProps) => <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></Svg>;
export const SoundOffIcon = (p: IconProps) => <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" /></Svg>;
export const GuideIcon = (p: IconProps) => <Svg {...p}><path d="M4 5.5c2.7-1 5.3-1 8 .8 2.7-1.8 5.3-1.8 8-.8v13c-2.7-1-5.3-1-8 .8-2.7-1.8-5.3-1.8-8-.8z" /><path d="M12 6.3v13" /></Svg>;
export const RankingIcon = (p: IconProps) => <Svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" /></Svg>;
export const NoteIcon = (p: IconProps) => <Svg {...p}><path d="M6 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6z" /><path d="M6 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2" /><path d="M13 3.5v7l2-1.5 2 1.5v-7" /></Svg>;
export const RetryIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4v4h4" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const CrossIcon = (p: IconProps) => <Svg {...p}><path d="M7 7l10 10M17 7L7 17" /></Svg>;
export const EditIcon = (p: IconProps) => <Svg {...p}><path d="M15 5l4 4L9 19H5v-4z" /></Svg>;
