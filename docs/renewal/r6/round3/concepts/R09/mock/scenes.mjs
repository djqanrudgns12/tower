import { tower, enemy, towers, enemies } from './art.mjs';
import { svg, figure, plate, onRoute, quizFields } from './layout.mjs';

const installed = new Map([
  ['garden_u-s02', ['bow', 4, 148]],
  ['garden_u-s09', ['cannon', 1, -83]],
  ['garden_u-s13', ['pulse', 1, 25]],
  ['garden_u-s16', ['ring', 1, 0]],
]);

function board(map) {
  const { center, path, gridLines } = plate(map, { left: 46, top: 20, dx: 56, dy: 43 });
  const points = path.map(pos => pos.join(',')).join(' ');
  const [entryX, entryY] = center(map.entryCell);
  const [gateX, gateY] = center(map.exitCell);
  const slots = map.slots.map(({ id, x, y }) => {
    const at = center([x, y]).join(' ');
    const item = installed.get(id);
    const content = item
      ? `<g data-tower="${item[0]}" transform="rotate(${item[2]}) scale(.53)">${tower(...item.slice(0, 2))}</g>`
      : '<rect x="-17" y="-14" width="34" height="28" rx="3" class="slot"/><path d="M-5 0H5M0-5V5" class="open-slot"/>';
    return `<g data-slot="${id}" transform="translate(${at})">${content}</g>`;
  }).join('');
  const wave = [
    [1, 'shard'], [2.1, 'shell'], [4.25, 'dart'], [6, 'shard'], [9.4, 'golem'],
    [13.3, 'shard'], [17.3, 'shell'], [19.1, 'dart'], [26.6, 'shard'],
    [30.8, 'golem'], [34.7, 'shell'], [38.5, 'dart'],
  ].map(([progress, kind]) =>
    `<g data-enemy="${kind}" transform="${onRoute(path, progress)} scale(.43)">${enemy(kind)}</g>`).join('');
  return svg('0 0 934 430', `
    <path d="${gridLines}" class="grid"/>
    <polyline points="${points}" class="route-bed"/><polyline points="${points}" class="route-core" data-route=""/>
    <path d="M${entryX - 26} ${entryY - 10}l9 10-9 10m8-20 9 10-9 10" class="entry"/>
    <g transform="translate(${gateX + 10} ${gateY})" class="gate">
      <path d="M-10-15H8V15H-10ZM-6-10H4V10H-6ZM-13-17V17M11-17V17"/>
    </g>
    <ellipse cx="522" cy="127.5" rx="85" ry="72" class="range"/>
    <path d="M520 109L509 87M522 111L505 84M510 86L507 82" class="shot"/>
    ${slots}${wave}
  `, { width: 934, height: 430 });
}

const towerIcon = (kind, level = 1, width = 48) => svg('-58 -58 116 116', tower(kind, level), { width });
const enemyIcon = (kind, width) => svg('-62 -58 124 116', enemy(kind), { width, height: width * 116 / 124 });
const title = (heading, context) =>
  `<header class="sheet-head"><h1>${heading}</h1><p>${context}</p></header>`;

export function battleFields(map, question) {
  return {
    ...quizFields(question),
    routeMark: svg('0 0 32 32', '<path d="M6 5h20v8H8v8h18v6H16" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="5" r="2" fill="currentColor"/><rect x="13" y="24" width="6" height="6" fill="currentColor"/>', { width: 31 }),
    map: board(map),
    shop: towers.map(([kind, name, role, gold], i) =>
      `<li><button${i === 0 ? ' class="selected" aria-pressed="true"' : ' aria-pressed="false"'}>${towerIcon(kind)}
      <span><strong>${name}</strong><small>${role}</small></span><b>${gold}</b></button></li>`).join(''),
  };
}

export function towerSheet() {
  const upgradeSteps = [[1, '단일 활대'], [4, '강화 활대 · 지지대'], [7, '이중 활대 · 확장 기단']];
  const evolution = upgradeSteps.map(([level, note]) =>
    figure(towerIcon('bow', level, 240), `<b>Lv${level}</b> ${note}`)).join('');
  const otherTowers = towers.slice(1).map(([kind, name]) => figure(towerIcon(kind, 1, 71), name)).join('');
  const miniature = [
    ...upgradeSteps.map(([level]) => [['bow', level], `석궁 ${level}`]),
    ...towers.slice(1).map(([kind, name]) => [[kind, 1], name]),
  ].map(([args, caption]) => figure(towerIcon(...args), caption)).join('');
  return `<main class="sheet">${title('타워의 형태', '석궁의 세 가지 진화와 포대·파동·감속')}
    <section class="evolution" aria-label="석궁 진화">${evolution}</section>
    <div class="auxiliary">
      <section><h2>다른 타워 · Lv1</h2><div class="other-towers">${otherTowers}</div></section>
      <section><h2>48px에서 보는 실루엣</h2><div class="reading-strip">${miniature}</div></section>
    </div></main>`;
}

export function enemySheet() {
  const units = enemies.slice(0, 4).map(([kind, name, role]) =>
    figure(enemyIcon(kind, 205), `${name}<small>${role}</small>`)).join('');
  const [kind, name, role] = enemies[4];
  return `<main class="sheet">${title('적의 형태', '이동과 방어 성격을 드러내는 외곽선')}
    <div class="roster">
      <section><h2>일반 적</h2><div class="units">${units}</div></section>
      <section class="boss"><h2>보스</h2>${figure(enemyIcon(kind, 305), `${name}<small>${role}</small>`)}</section>
    </div></main>`;
}
