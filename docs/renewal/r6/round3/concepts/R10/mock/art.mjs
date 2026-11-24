export const towers = [
  ['bow', '석궁', '단일 공격', 30],
  ['gear', '톱니 포탑', '다수 공격', 45],
  ['piston', '압력 포대', '넓은 범위', 50],
  ['coil', '감속 코일', '이동 감속', 40],
];

export const enemies = [
  ['crawler', '쐐기 갑충', '낮은 날개판 · 빠른 이동'],
  ['roller', '궤도 갑충', '넓은 궤도 · 느린 이동'],
  ['cutter', '집게 갑충', '긴 집게 · 짧은 돌진'],
  ['vault', '장갑 갑충', '넓은 등판 · 높은 방어'],
  ['boss', '중장갑 거체', '삼중 외판 · 중복 구동축'],
];

function gear(teeth, outer, inner) {
  const points = Array.from({ length: teeth }, (_, i) =>
    [.1, .35, .65, .9].map((offset, n) => {
      const angle = (i + offset) * 2 * Math.PI / teeth;
      const r = n === 1 || n === 2 ? outer : inner;
      return `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
    })).flat();
  return `<polygon class="outline" points="${points.join(' ')}"/>`;
}

const bolts = (points, radius = 2.3) => points
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${radius}" class="fine-line"/>`).join('');

const hatch = (count, x, y, step = 5) => Array.from({ length: count }, (_, i) =>
  `M${x + i * step} ${y}l7-7`).join('');

function crossbow(level) {
  const width = 28 + (level - 1) * 2.2;
  const extraFrames = [
    '<path d="M-24 12H24V23H-24Z" class="outline"/>',
    '<path d="M-36 7H36V25H21L16 31H-16L-21 25H-36Z" class="outline"/><path d="M-29 14H29M-29 21H29" class="fine-line"/>',
    '<path d="M-46 4H46V19L34 31H-34L-46 19Z" class="outline"/><path d="M-38 11h76v7l-9 7h-58l-9-7Z" class="fine-line"/>',
  ];
  const frameIndex = level === 1 ? 0 : level === 4 ? 1 : 2;
  const wing = level === 7 ? '<path d="M-41-22-35-11-14 7M41-22 35-11 14 7M-14-8V12M14-8V12" class="outline open"/>' : '';
  const supports = level >= 4 ? `<path d="${hatch(4, -32, 23)}${hatch(4, 10, 23)}" class="fine-line"/>` : '';
  return `${extraFrames[frameIndex]}
    <path d="M-20-1V-14H20V-1L13 15H-13Z" class="outline"/>
    <path d="M-${width} -25 -${width - 6} -10 -10 3H10L${width - 6}-10 ${width}-25 ${width - 5}-26 ${width - 10}-13 8-2H-8L-${width - 10}-13 -${width - 5}-26Z" class="outline"/>
    <path d="M-${width} -24 0-9 ${width}-24M0-40V31" class="fine-line axis"/>
    <path d="M-5-25 0-36 5-25V17H-5Z" class="outline"/><path d="M0-26V14M-10 12H10" class="fine-line"/>
    ${wing}${supports}${bolts([[-16, 18], [16, 18], [-12, -8], [12, -8]])}`;
}

export function tower(kind, level = 1) {
  if (kind === 'bow') return crossbow(level);
  if (kind === 'gear') {
    return `<rect x="-28" y="-25" width="56" height="51" rx="5" class="outline"/>
      ${gear(10, 25, 21)}<circle r="15" class="fine-line"/>
      <path d="M-8 9V-23H8V9L4 13H-4Z" class="outline"/>
      <path d="M-8-18H8M0-16V8" class="fine-line"/>${bolts([[-23, -20], [23, -20], [-23, 21], [23, 21]])}`;
  }
  if (kind === 'piston') {
    return `<path d="M-33-17-21-27H21L33-17V18L22 26H-22L-33 18Z" class="outline"/>
      <rect x="-24" y="-10" width="48" height="28" rx="3" class="fine-line"/>
      <path d="M-17 7V-30H-7V7ZM7 7V-30H17V7Z" class="outline"/>
      <path d="M-17-23H-7M7-23H17M-17-16H-7M7-16H17M-17-9H-7M7-9H17M0-23V19" class="fine-line"/>
      ${bolts([[-25, 18], [25, 18], [0, 13]])}`;
  }
  return `<path d="M-29-29H29V29H-29Z" class="outline"/>
    <circle r="22" class="outline"/><circle r="14" class="fine-line"/>
    <path d="M-29 0H29M0-29V29M-12-6-8-6-4 6 0-6 4 6 8-6 12-6" class="fine-line"/>
    <path d="M-8-23H8M-8 23H8" class="outline open"/>
    ${bolts([[-23, -23], [23, -23], [-23, 23], [23, 23]])}`;
}

function legs(tracks) {
  return tracks.map(([outerX, outerY, innerX, innerY]) =>
    `<path d="M${innerX} ${-innerY} ${outerX - 5} ${-outerY + 4} ${outerX} ${-outerY}
      M${innerX} ${innerY} ${outerX - 5} ${outerY - 4} ${outerX} ${outerY}" class="enemy-outline open"/>`).join('');
}

export const bossSection = `<path d="M-45 0-36-12H36L45 0H-45Z" class="enemy-outline"/>
  <path d="M-35 0-25-24H25L35 0Z" class="enemy-outline"/>
  <path d="M-17-12V-20H17V-12Z" class="enemy-fine"/>
  <path d="M-29-5h58${hatch(9, -22, 0)}" class="enemy-fine"/>
  <circle cx="-32" cy="-4" r="4" class="enemy-fine"/><circle cx="32" cy="-4" r="4" class="enemy-fine"/>`;

export function enemy(kind) {
  if (kind === 'crawler') {
    return `${legs([[-23, 23, -18, 9], [1, 28, -3, 11], [19, 24, 12, 8]])}
      <path d="M-29-11-18-17 27-6 34 0 27 6-18 17-29 11Z" class="enemy-outline"/>
      <path d="M-20-11 21-4 28 0 21 4-20 11-23 0Z M-12-9-5 0-12 9M3-6 10 0 3 6" class="enemy-fine"/>`;
  }
  if (kind === 'roller') {
    return `<path d="M-28-13V13H29V-13Z" class="enemy-outline"/>
      <rect x="-32" y="-25" width="65" height="12" rx="6" class="enemy-outline"/>
      <rect x="-32" y="13" width="65" height="12" rx="6" class="enemy-outline"/>
      <path d="M-26-21H27M-26 21H27M-24-8H22L29 0 22 8H-24Z" class="enemy-fine"/>
      <circle r="8" class="enemy-fine"/><circle r="3" class="enemy-fine"/>`;
  }
  if (kind === 'cutter') {
    return `${legs([[-27, 21, -16, 10], [-9, 25, -5, 11]])}
      <path d="M-28-7-16-15 9-13 24 0 9 13-16 15-28 7Z" class="enemy-outline"/>
      <path d="M14-10 34-24 44-23 40-17 24-4ZM14 10 34 24 44 23 40 17 24 4Z" class="enemy-outline"/>
      <path d="M-24 0H24M-12-10V10M-5-10V10" class="enemy-fine"/>`;
  }
  if (kind === 'vault') {
    return `${legs([[-33, 25, -20, 9], [-8, 33, -4, 21], [14, 28, 10, 18]])}
      <path d="M-30-12-19-27H15L29-15 34 0 29 15 15 27H-19L-30 12Z" class="enemy-outline"/>
      <path d="M-23-12-15-20H12L23-11V11L12 20H-15L-23 12Z" class="enemy-fine"/>
      <path d="M-15-14H0L12-6V6L0 14H-15Z" class="enemy-fine"/>`;
  }
  return `${legs([[-46, 38, -29, 18], [-20, 47, -16, 27], [9, 45, 5, 25], [36, 35, 25, 20]])}
    <path d="M-43-13-32-28 2-37 35-23 49-11V11L35 23 2 37-32 28-43 13Z" class="enemy-outline"/>
    <path d="M-36-10-25-22 0-30 29-17 41-9V9L29 17 0 30-25 22-36 10Z" class="enemy-fine"/>
    <path d="M-26-8-16-16 1-20 25-10 34 0 25 10 1 20-16 16-26 8Z" class="enemy-outline"/>
    <path d="M-15-12-8 0-15 12M-1-17 9 0-1 17M15-12 23 0 15 12M-42 0H45" class="enemy-fine axis"/>
    <circle cx="-26" cy="-14" r="3" class="enemy-fine"/><circle cx="-26" cy="14" r="3" class="enemy-fine"/>
    <circle cx="26" cy="-13" r="3" class="enemy-fine"/><circle cx="26" cy="13" r="3" class="enemy-fine"/>`;
}
