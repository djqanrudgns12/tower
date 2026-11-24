import type { SVGProps } from 'react';

// R04 시안의 24px 선 아이콘. 현재 글자색을 따르며 의미가 있을 때만 label을 준다.
const shapes = {
  'hud/back': <><path d="M19 12H5M10.5 6.5L5 12L10.5 17.5" /></>,
  'hud/check': <><polyline points="4.5,12.5 9.5,17.5 19.5,6.5" /></>,
  'hud/chest': <><polygon points="3.5,8 6,5 18,5 20.5,8 20.5,19 3.5,19" /><line x1="3.5" y1="10.5" x2="20.5" y2="10.5" /><rect x="10" y="8.5" width="4" height="5" /></>,
  'hud/close': <><path d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5" /></>,
  'hud/cross': <><polygon points="8,3.5 16,3.5 20.5,8 20.5,16 16,20.5 8,20.5 3.5,16 3.5,8" /><path d="M8.5 8.5L15.5 15.5M15.5 8.5L8.5 15.5" /></>,
  'hud/edit': <><polygon points="4,20 5,15.5 16,4.5 19.5,8 8.5,19" /><path d="M13.5 7L17 10.5M5 15.5L8.5 19" /></>,
  'hud/enemies': <><polygon points="8,7 12.5,16 3.5,16" /><path d="M15.5 7.5H20.5M15.5 12H20.5M15.5 16.5H20.5" /></>,
  'hud/gate': <><path d="M3.5 20.5V4H6.5V6.5H10V4H14V6.5H17.5V4H20.5V20.5M7.5 6.5V20.5M16.5 6.5V20.5M7.5 9.5H16.5M9.5 20.5V13L11.5 11H12.5L14.5 13V20.5M12 11V20.5M2.5 20.5H21.5" /></>,
  'hud/gold': <><polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" /><rect x="9" y="9" width="6" height="6" /></>,
  'hud/guide': <><polygon points="3,5 12,6.8 12,19.5 3,17.7" /><polygon points="21,5 12,6.8 12,19.5 21,17.7" /><path d="M5.5 9.5L9.5 10.2M5.5 13L9.5 13.7M5.5 16L8.5 16.5M16.5 9.5V13.5" /><rect x="15.7" y="15.3" width="1.6" height="1.6" fill="currentColor" stroke="none" /></>,
  'hud/lock': <><path d="M8 10V6.5L10 4H14L16 6.5V10" /><polygon points="5,10 19,10 19,18.5 17,20.5 7,20.5 5,18.5" /><line x1="12" y1="14.5" x2="12" y2="17" /><rect x="11" y="13" width="2" height="2" fill="currentColor" stroke="none" /></>,
  'hud/note': <><polygon points="5,3.5 17,3.5 19.5,6 19.5,20.5 5,20.5" /><path d="M13 3.5V9.5L14.5 8L16 9.5V3.5M8 12.5H16M8 15.5H16M8 18H13" /></>,
  'hud/pause': <><rect x="6.5" y="4.5" width="3.5" height="15" /><rect x="14" y="4.5" width="3.5" height="15" /></>,
  'hud/play': <><polygon points="6.5,4.5 19.5,12 6.5,19.5" /></>,
  'hud/qr': <><rect x="3.5" y="3.5" width="6.5" height="6.5" /><rect x="14" y="3.5" width="6.5" height="6.5" /><rect x="3.5" y="14" width="6.5" height="6.5" /><rect x="6" y="6" width="1.5" height="1.5" fill="currentColor" stroke="none" /><rect x="16.5" y="6" width="1.5" height="1.5" fill="currentColor" stroke="none" /><rect x="6" y="16.5" width="1.5" height="1.5" fill="currentColor" stroke="none" /><path d="M14 14H17V17H14M17.5 20.5H20.5V17.5M20.5 14V15.5M14 20.5H15.5" /></>,
  'hud/school': <><polygon points="3,11 12,3.5 21,11" /><circle cx="12" cy="8.2" r="1.2" /><path d="M6.5 11V19.5M12 11V19.5M17.5 11V19.5M3.5 19.5H20.5" /></>,
  'hud/score': <><polygon points="12,2.5 14.8,9.2 21.5,12 14.8,14.8 12,21.5 9.2,14.8 2.5,12 9.2,9.2" /><polygon points="12,8.5 15.5,12 12,15.5 8.5,12" /></>,
  'hud/sell': <><polygon points="5.5,4.5 11.5,4.5 14,7 14,13.5 11.5,16 5.5,16 3,13.5 3,7" /><rect x="7" y="8.5" width="3" height="3.5" /><path d="M18 6V19M14.5 15.5L18 19L21.5 15.5" /></>,
  'hud/settings': <><polygon points="8.5,5.5 15.5,5.5 18.5,8.5 18.5,15.5 15.5,18.5 8.5,18.5 5.5,15.5 5.5,8.5" /><polygon points="10.5,9 13.5,9 15,10.5 15,13.5 13.5,15 10.5,15 9,13.5 9,10.5" /><path d="M12 2.5V5.5M12 18.5V21.5M2.5 12H5.5M18.5 12H21.5M5.2 5.2L7 7M17 17L18.8 18.8M18.8 5.2L17 7M7 17L5.2 18.8" /></>,
  'hud/shuffle': <><path d="M4 7H8.5L15.5 17H20M17.5 14.5L20 17L17.5 19.5M4 17H8.5L10.5 14M13.5 10L15.5 7H20M17.5 4.5L20 7L17.5 9.5" /></>,
  'hud/stat-power': <><polygon points="9.5,12.5 17.5,4.5 19.5,4.5 19.5,6.5 11.5,14.5" /><path d="M6.5 10.5L13.5 17.5M4.5 19.5L9.5 14.5M4 18.5L5.5 20" /></>,
  'hud/stat-range': <><circle cx="12" cy="12" r="7" /><path d="M12 2.5V6.5M12 17.5V21.5M2.5 12H6.5M17.5 12H21.5" /><rect x="11" y="11" width="2" height="2" fill="currentColor" stroke="none" /></>,
  'hud/stat-speed': <><polygon points="8,3.5 16,3.5 20.5,8 20.5,16 16,20.5 8,20.5 3.5,16 3.5,8" /><path d="M12 3.5V5.5M3.5 12H5.5M18.5 12H20.5M12 12L16.5 7.5" /><rect x="11" y="11" width="2" height="2" fill="currentColor" stroke="none" /></>,
  'hud/streak': <><rect x="4" y="15" width="4" height="5" /><rect x="10" y="11" width="4" height="9" /><rect x="16" y="7" width="4" height="13" /><path d="M3 20H21M5 10.5L10.5 6L13.5 7.5L18.5 3" /></>,
  'hud/upgrade': <><path d="M5 20H19M6.5 15L12 9.5L17.5 15M6.5 9.5L12 4L17.5 9.5M12 4.5V17" /></>,
  'hud/wave': <><path d="M5 3.5V20.5M3.5 20.5H7.5" /><polygon points="5,4.5 19.5,4.5 16.5,9 19.5,13.5 5,13.5" /></>,
  'relics/arrow_range': <><polygon points="8.5,4.5 15.5,4.5 19.5,8.5 19.5,15.5 15.5,19.5 8.5,19.5 4.5,15.5 4.5,8.5" /><path d="M12 2.5V7M12 17V21.5M2.5 12H7M17 12H21.5" /><rect x="11" y="11" width="2" height="2" fill="currentColor" stroke="none" /></>,
  'relics/big_blast': <><polygon points="12,8.5 15,10.2 15,13.8 12,15.5 9,13.8 9,10.2" /><path d="M12 2.5V6M12 18V21.5M2.5 12H6M18 12H21.5M5.2 5.2L7.8 7.8M16.2 16.2L18.8 18.8M18.8 5.2L16.2 7.8M7.8 16.2L5.2 18.8" /></>,
  'relics/ember_charm': <><path d="M15 4H8L4 8V16L8 20H16L20 16V9.5M17.5 11L20 8.5L21.5 11" /><polygon points="12,7.5 15.5,11.5 15.5,15 12,17.5 8.5,15 8.5,11.5" /></>,
  'relics/evolve_stone': <><polygon points="12,2.5 20.5,10.5 12,21.5 3.5,10.5" /><polygon points="7,10.5 12,5.5 17,10.5 12,17" /><path d="M12 15.5V8.5M9.5 11L12 8.5L14.5 11" /></>,
  'relics/frost_bead': <><polygon points="12,9 14.6,10.5 14.6,13.5 12,15 9.4,13.5 9.4,10.5" /><path d="M12 3V9M12 15V21M14.6 10.5L19.8 7.5M9.4 13.5L4.2 16.5M14.6 13.5L19.8 16.5M9.4 10.5L4.2 7.5M9.5 5L12 7L14.5 5M9.5 19L12 17L14.5 19" /><rect x="11.2" y="11.2" width="1.6" height="1.6" fill="currentColor" stroke="none" /></>,
  'relics/hero_blade': <><polygon points="12,3 14.5,6 14.5,15.5 9.5,15.5 9.5,6" /><path d="M7.5 15.5H16.5M12 15.5V21M10.5 21H13.5M6.5 8.5L3.5 11.5L6.5 14.5M17.5 8.5L20.5 11.5L17.5 14.5" /></>,
  'relics/lucky_pouch': <><polygon points="6.5,5 17.5,5 20.5,8 20.5,18 17.5,21 6.5,21 3.5,18 3.5,8" /><path d="M9 5V3H15V5M3.5 9.5H20.5" /><polygon points="10.5,12.5 13.5,12.5 15,14 15,16.5 13.5,18 10.5,18 9,16.5 9,14" /></>,
  'relics/quick_spring': <><polyline points="4.5,6.5 13.5,6.5 13.5,17.5 6.5,17.5 6.5,9.5 11,9.5 11,14.5 8.5,14.5" /><polyline points="19,5 16,11.5 20,11.5 17,19" /></>,
  'relics/sky_net': <><path d="M3.5 12.5L7 5.5H17L20.5 12.5M7 5.5L9.5 12.5M17 5.5L14.5 12.5M12 5.5V12.5M5 9.5H19M12 21V14M9 17L12 14L15 17" /></>,
  'relics/tall_pole': <><path d="M12 6.5V21M8.5 21L12 12.5L15.5 21M9.5 18H14.5M8.5 4.5L6.5 6.5V9.5L8.5 11.5M15.5 4.5L17.5 6.5V9.5L15.5 11.5M6 2.5L3 5.5V10.5L6 13.5M18 2.5L21 5.5V10.5L18 13.5" /><rect x="11" y="4" width="2" height="2" fill="currentColor" stroke="none" /></>,
  'relics/trade_seal': <><polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" /><path d="M7.5 9.5H16.5M14.2 7.2L16.5 9.5L14.2 11.8M16.5 14.5H7.5M9.8 12.2L7.5 14.5L9.8 16.8" /></>,
  'relics/wise_book': <><polygon points="3,5.5 12,7 12,19 3,17.5" /><polygon points="21,5.5 12,7 12,19 21,17.5" /><path d="M5.5 10L9.5 10.7M5.5 13.5L9.5 14.2M15 6.5V14L16.5 12.5L18 14V6" /></>,
  'status/burn': <><path d="M12 2.5L16.5 7.5V10.5L19 13V17L15 21H9L5 17V11.5L8.5 8L10 10L12 2.5Z" /><polygon points="12,12 14.5,14.8 14.5,17.5 12,19 9.5,17.5 9.5,14.8" /></>,
  'status/haste': <><path d="M3 8H7.5M2.5 12H9M3 16H7.5M10 6L16 12L10 18M15.5 6L21.5 12L15.5 18" /></>,
  'status/knockback': <><path d="M4.5 4.5V19.5M13 6.5L7.5 12L13 17.5M19 6.5L13.5 12L19 17.5" /></>,
  'status/shred': <><polygon points="4,4.5 10.5,4.5 9.5,8.5 11,11.5 5.5,11.5 4,9.5" /><polygon points="13.5,4.5 20,4.5 20,9.5 18.5,11.5 13,11.5 14.5,8.5" /><path d="M12 13.5V20.5M8.5 17L12 20.5L15.5 17" /></>,
  'status/slow': <><path d="M8 4V20M5 7L8 9.5L11 7M5 17L8 14.5L11 17M4.5 12H11.5M17 5V18.5M13.5 15L17 18.5L20.5 15" /></>,
  'status/stun': <><polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" /><polyline points="13.5,6.5 9,12 15,12 10.5,17.5" /></>,
  'status/vuln': <><path d="M6.5 3.5H17.5L19.5 5.5V12.5L12 20.5L4.5 12.5V5.5Z" /><polyline points="12.5,4 10,9.5 14,12.5 11.5,18" /></>,
  'status/ward': <><polygon points="12,2.5 20,6 20,13.5 12,21.5 4,13.5 4,6" /><polygon points="12,6.5 16.5,8.5 16.5,12.5 12,17 7.5,12.5 7.5,8.5" /></>,
  'traits/armor': <><polygon points="7.5,3 16.5,3 20.5,7 20.5,14 12,21 3.5,14 3.5,7" /><polygon points="8.5,6.5 15.5,6.5 17.5,8.5 17.5,12.5 12,17 6.5,12.5 6.5,8.5" /><line x1="6.5" y1="10.5" x2="17.5" y2="10.5" /></>,
  'traits/fast': <><path d="M3 7.5H9.5M2.5 12H11M3 16.5H9.5" /><polygon points="11.5,5.5 21.5,12 11.5,18.5 14.5,12" /></>,
  'traits/flying': <><polygon points="2.5,7.5 9.5,5.5 12,9.5 14.5,5.5 21.5,7.5 18.5,12.5 12,10.5 5.5,12.5" /><polygon points="6.5,14.5 12,12.5 17.5,14.5 12,19" /></>,
  'traits/regen': <><path d="M5 10V7L7.5 4.5H16.5L19 7V10.5M16.5 8.5L19 11L21.5 8.5M19 14V17L16.5 19.5H7.5L5 17V13.5M2.5 15.5L5 13L7.5 15.5M12 8.5V15.5M8.5 12H15.5" /></>,
  'traits/siege': <><polygon points="3,8.5 13.5,8.5 16.5,11 13.5,13.5 3,13.5" /><polygon points="5,15.5 6,14.5 8,14.5 9,15.5 9,17.5 8,18.5 6,18.5 5,17.5" /><polygon points="10.5,15.5 11.5,14.5 13.5,14.5 14.5,15.5 14.5,17.5 13.5,18.5 11.5,18.5 10.5,17.5" /><path d="M19.5 4.5V19.5M17.5 6.5H19.5M17.5 16.5H19.5M17 11H19.5" /></>,
  'traits/split': <><polygon points="12,3 15,4.7 15,8.3 12,10 9,8.3 9,4.7" /><path d="M10 10.5L6.5 14M14 10.5L17.5 14" /><polygon points="6.5,14.5 9.5,16.2 9.5,19.8 6.5,21.5 3.5,19.8 3.5,16.2" /><polygon points="17.5,14.5 20.5,16.2 20.5,19.8 17.5,21.5 14.5,19.8 14.5,16.2" /></>,
  'traits/swarm': <><polygon points="12,3.5 15.5,7 12,10.5 8.5,7" /><polygon points="6.5,13 10,16.5 6.5,20 3,16.5" /><polygon points="17.5,13 21,16.5 17.5,20 14,16.5" /></>,
  'traits/ward': <><polygon points="12,2.5 21,12 12,21.5 3,12" /><polygon points="12,6.5 16.5,12 12,17.5 7.5,12" /><path d="M12 6.5V17.5M7.5 12H16.5" /></>,
};

export type LineIconName = keyof typeof shapes;

export function LineIcon({ name, size = 20, label, ...props }: Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: LineIconName;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      focusable="false"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {shapes[name]}
    </svg>
  );
}

export function isLineIcon(name: string): name is LineIconName {
  return Object.hasOwn(shapes, name);
}
