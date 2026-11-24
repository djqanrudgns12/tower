export const towers = [
  ['bow', '석궁', '한 발씩 빠르게', 30],
  ['cannon', '포대', '모여 있는 적 공격', 45],
  ['pulse', '파동', '가까운 적 여럿 공격', 50],
  ['ring', '감속', '지나가는 적을 느리게', 40],
];

export const enemies = [
  ['shard', '삼각 파편충', '빠르게 이동'],
  ['shell', '육각 갑충', '피해를 오래 버팀'],
  ['dart', '궤적충', '짧게 가속'],
  ['golem', '쐐기 골렘', '묵직한 전열'],
  ['boss', '겹판 거체', '겹겹이 쌓인 장갑'],
];

const point = (radius, angle) =>
  [Math.cos(angle) * radius, Math.sin(angle) * radius].map(n => n.toFixed(2)).join(',');
const polygon = (sides, radius, angle = 0) =>
  Array.from({ length: sides }, (_, i) => point(radius, angle + i * 2 * Math.PI / sides)).join(' ');
const poly = (sides, radius, cls, angle = 0) =>
  `<polygon points="${polygon(sides, radius, angle)}" class="${cls}"/>`;

export function tower(kind, level = 1) {
  const size = 29 + (level - 1) * 2.4;
  const base = `<circle r="${size + 6}" class="mount"/>`;
  if (kind === 'bow') {
    const arm = 25 + (level - 1) * 2.15;
    const brace = level >= 4 ? '<path d="M-25 11-30 24-13 27M25 11 30 24 13 27" class="metal heavy"/>' : '';
    const spread = level === 7 ? '<path d="M-13 13-28 4-36-8M13 13 28 4 36-8M-8 0V-20M8 0V-20" class="metal heavy"/>' : '';
    const hull = level < 4 ? poly(6, size - 6, 'body') : poly(6, size - 5, 'body', Math.PI / 6);
    const mount = {
      1: base,
      4: poly(6, size + 9, 'mount', Math.PI / 6),
      7: '<path d="M-48-15-31-42H31L48-15V20L25 48H-25L-48 20Z" class="mount"/>',
    }[level] ?? base;
    return `${mount}${hull}${brace}
      <path d="M-${arm} -17 -${arm - 9} -2 0 8 ${arm - 9} -2 ${arm} -17" class="metal heavy"/>
      <path d="M-${arm} -17 0 -7 ${arm} -17" class="metal"/>
      <path d="M-3 15V-23L0 -31 3-23V15Z" class="alloy"/>${spread}
      <path d="M-7 19H7" class="metal"/>`;
  }
  if (kind === 'cannon') {
    return `${base}${poly(6, size - 1, 'body', Math.PI / 6)}
      <path d="M-17 9V-12H17V9L11 18H-11Z" class="metal"/>
      <path d="M-11 7V-28H-3V7ZM3 7V-28H11V7Z" class="alloy"/>
      <path d="M-13-24H-1M1-24H13M-11 13H11" class="metal"/>`;
  }
  if (kind === 'pulse') {
    return `${base}${poly(3, size + 3, 'body', -Math.PI / 2)}
      <path d="M0-19 16 10H-16Z M0-8 7 5H-7Z" class="metal"/>
      <circle cy="-18" r="4" class="alloy"/><circle cx="-16" cy="10" r="4" class="alloy"/>
      <circle cx="16" cy="10" r="4" class="alloy"/><circle r="3" class="alloy"/>`;
  }
  return `${base}${poly(8, size, 'body', Math.PI / 8)}
    <circle r="18" class="metal dotted"/><circle r="10" class="metal"/>
    <path d="M-26 0H-20M20 0H26M0-26V-20M0 20V26" class="metal heavy"/>
    <path d="M0-5 5 0 0 5-5 0Z" class="alloy"/>`;
}

export function enemy(kind) {
  if (kind === 'shard') {
    return `<path d="M-38-10H-18M-42 0H-21M-35 10H-18" class="wake"/>
      <path d="M-21-15 28 0-21 15-11 0Z" class="carapace"/>
      <path d="M-14-8 12 0-14 8-7 0Z" class="plate"/>
      <path d="M-9-19 3-15M-9 19 3 15" class="edge"/>`;
  }
  if (kind === 'shell') {
    return `<path d="M-23-7-33-18M-8-15-17-25M-23 7-33 18M-8 15-17 25M10-14 21-24M10 14 21 24" class="edge heavy"/>
      ${poly(6, 27, 'carapace')}<path d="M-17-12H11L19 0 11 12H-17L-22 0Z" class="plate"/>
      <path d="M-7-12 1 0-7 12M9-12 16 0 9 12" class="dark"/>`;
  }
  if (kind === 'dart') {
    return `<path d="M-45-16H-22M-41 16H-22" class="wake"/>
      <path d="M-24-20-7-23 33-14 39-9H3L-17-12Z M-24 20-7 23 33 14 39 9H3L-17 12Z" class="carapace"/>
      <path d="M-12-14H1L24-10 M-12 14H1L24 10" class="edge"/>
      <path d="M-16 0-9-4H5L13 0 5 4H-9Z" class="plate"/>`;
  }
  if (kind === 'golem') {
    return `<path d="M-18-17-7-25 18-23 24-15 9-8-22-8ZM-18 17-7 25 18 23 24 15 9 8-22 8Z" class="carapace"/>
      <path d="M-26-8-11-15 18-12 31 0 18 12-11 15-26 8Z" class="carapace"/>
      <path d="M-15-8 13-7 23 0 13 7-15 8-22 0Z" class="plate"/>
      <path d="M-4-8 7 0-4 8M7-9 16 0 7 9" class="dark"/>`;
  }
  return `<path d="M-49-20H-27M-55 0H-29M-49 20H-27" class="wake"/>
    <path d="M-26-15-39-30-15-43 7-36 26-24 16-13ZM-26 15-39 30-15 43 7 36 26 24 16 13Z" class="carapace"/>
    <path d="M-33-19-17-26 12-27 36-15 46 0 36 15 12 27-17 26-33 19Z" class="carapace"/>
    <path d="M-22-13-10-19 11-18 32-9 39 0 32 9 11 18-10 19-22 13Z" class="plate"/>
    <path d="M-17-16-5 0-17 16M-1-18 14 0-1 18M15-17 27 0 15 17" class="dark"/>
    <path d="M-28-31-15-36-3-33M-28 31-15 36-3 33" class="edge"/>`;
}
