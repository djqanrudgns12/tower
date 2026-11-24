import { tower, enemy, bossSection, towers, enemies } from './art.mjs';
import { svg, figure, plate, onRoute, quizFields } from '../../R09/mock/layout.mjs';

const installed = new Map([
  ['garden_u-s03', ['bow', 4, 180]],
  ['garden_u-s09', ['gear', 1, 180]],
  ['garden_u-s12', ['piston', 1, -54]],
  ['garden_u-s16', ['coil', 1, 0]],
]);

function board(map) {
  const left = 55;
  const top = 27;
  const { center, right, bottom, path, gridLines } = plate(map, { left, top, dx: 52, dy: 41 });
  const points = path.map(pos => pos.join(',')).join(' ');
  const [entryX, entryY] = center(map.entryCell);
  const [gateX, gateY] = center(map.exitCell);
  const slots = map.slots.map(({ id, x, y }) => {
    const item = installed.get(id);
    const at = center([x, y]).join(' ');
    const bracket = `<path d="M-18-7v-8h9m18 0h9v8m0 14v8h-9m-18 0h-9V7" class="slot${item ? ' slot-mounted' : ''}"/>`;
    const content = item
      ? `<g data-tower="${item[0]}" transform="rotate(${item[2]}) scale(.49)">${tower(...item.slice(0, 2))}</g>`
      : '<path d="M-4 0H4M0-4V4" class="slot"/>';
    return `<g data-slot="${id}" transform="translate(${at})">${bracket}${content}</g>`;
  }).join('');
  const wave = [
    [1.2, 'crawler'], [3, 'roller'], [5.5, 'cutter'], [7.3, 'crawler'], [9.5, 'vault'],
    [14.1, 'crawler'], [17.3, 'vault'], [18.65, 'cutter'], [22.2, 'roller'],
    [29.2, 'crawler'], [34.3, 'cutter'], [38.15, 'roller'],
  ].map(([progress, kind]) =>
    `<g data-enemy="${kind}" transform="${onRoute(path, progress)} scale(.45)">${enemy(kind)}</g>`).join('');
  const widthTicks = `M${left} 11H${right}M${left} 7v12M${right} 7v12`;
  const heightTicks = `M23 ${top}V${bottom}M18 ${top}H34M18 ${bottom}H34`;
  return svg('0 0 881 419', `
    <defs><pattern id="minor-grid" width="13" height="10.25" patternUnits="userSpaceOnUse" x="${left}" y="${top}">
      <path d="M0 10.25V0H13" class="minor-grid"/>
    </pattern></defs>
    <rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="url(#minor-grid)"/>
    <path d="${gridLines}" class="grid"/>
    <path d="${widthTicks}${heightTicks}M46 19h-9v9m806-9h9v9M46 404h-9v-9m806 9h9v-9" class="frame-mark"/>
    <polyline points="${points}" class="route-edge"/><polyline points="${points}" class="route-body"/>
    <polyline points="${points}" class="route-axis" data-route=""/>
    <path d="M${entryX - 27} ${entryY - 8}l8 8-8 8m7-16 8 8-8 8" class="entry"/>
    <g transform="translate(${gateX + 8} ${gateY})" class="gate">
      <path d="M-8-13h16v26H-8ZM-11-16H11v3H-11ZM-11 13H11v3H-11ZM-5-9l10 18M5-9-5 9"/>
    </g>
    <ellipse cx="497" cy="129.5" rx="83" ry="55" class="range"/>
    <path d="M497 149V164M494 161l3 4 3-4" class="trajectory"/>
    ${slots}${wave}
  `, { width: 881, height: 419 });
}

const towerIcon = (kind, level = 1, width = 48) => svg('-54 -54 108 108', tower(kind, level), { width });
const title = (heading, context) =>
  `<header class="sheet-head"><h1>${heading}</h1><p>${context}</p></header>`;

export function battleFields(map, question) {
  return {
    ...quizFields(question),
    routeMark: svg('0 0 35 35', '<path d="M4 10v-6h6m15 0h6v6m0 15v6h-6m-15 0H4v-6M8 11h18v6H10v6h16m-3-3 3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.25"/>', { width: 32 }),
    map: board(map),
    mapWidth: map.gridWidth,
    mapHeight: map.gridHeight,
    shop: towers.map(([kind, name, role, price], i) =>
      `<li><button${i === 0 ? ' class="selected" aria-pressed="true"' : ' aria-pressed="false"'}>${towerIcon(kind)}
      <span><strong>${name}</strong><small>${role}</small></span><b>${price}</b></button></li>`).join(''),
  };
}

function crossbowDrawing(level, width) {
  const edge = width / 2;
  const dim = `M${-edge} 28V49M${edge} 28V49M${-edge} 45H${edge}M${-edge - 2} 47l4-4M${edge - 2} 47l4-4`;
  return svg('-83 -61 166 120', `
    <path d="M-72 0H72M0-52V36" class="fine-line axis"/>
    ${tower('bow', level)}
    <path d="${dim}M-74-45h9m-9 0v9m148-9h-9m9 0v9" class="dimension"/>
  `, { width: 269, height: 200 });
}

export function towerSheet() {
  const upgradeSteps = [[1, 56, '단일 활대', '기본 레일'], [4, 72, '보강 활대', '지지대와 이중 가이드'], [7, 92, '이중 활대', '넓어진 기단과 보조 레일']];
  const evolution = upgradeSteps.map(([level, width, name, note]) => figure(`
    ${crossbowDrawing(level, width)}
    <span class="measure">${width} 단위</span><span class="part-note">${note}</span>`,
    `<b>Lv${level}</b>${name}`)).join('');
  const otherTowers = towers.slice(1).map(([kind, name]) => figure(towerIcon(kind, 1, 63), name)).join('');
  const miniature = [
    ...upgradeSteps.map(([level]) => [['bow', level], `석궁 ${level}`]),
    ...towers.slice(1).map(([kind, name]) => [[kind, 1], name]),
  ].map(([args, caption]) => figure(towerIcon(...args), caption)).join('');
  return `<main class="sheet">${title('타워 조립도', '평면도 · 석궁 계열과 다른 타워의 설치면')}
    <section class="evolution drawing-board" aria-label="석궁 진화">${evolution}</section>
    <div class="auxiliary">
      <section><h2>기타 장치 · Lv1</h2><div class="other-towers drawing-board">${otherTowers}</div></section>
      <section><h2>48px에서 보는 실루엣</h2><div class="reading-strip drawing-board">${miniature}</div></section>
    </div></main>`;
}

function enemyPlan(kind) {
  return svg('-71 -48 142 96', `
    <path d="M-63 0H63M0-42V42" class="fine-line axis"/>
    ${enemy(kind)}
  `, { width: 216, height: 150 });
}

export function enemySheet() {
  const units = enemies.slice(0, 4).map(([kind, name, role]) =>
    figure(enemyPlan(kind), `${name}<small>${role}</small>`)).join('');
  const [kind, name, role] = enemies[4];
  const plan = svg('-78 -64 156 128', `
    <path d="M-65 0H65M0-56V56" class="fine-line axis"/>
    <path d="M-67-51h10m-10 0v10m134-10h-10m10 0v10M-67 51h10m-10 0v-10m134 10h-10m10 0v-10" class="dimension"/>
    ${enemy(kind)}
    <path d="M-57-4V4m114-8v8" class="dimension"/>
  `, { width: 341, height: 272 });
  const section = svg('-55 -32 110 40', bossSection, { width: 126, height: 52 });
  return `<main class="sheet">${title('기계 갑충 도면', '일반 적 4종 · 보스 평면과 단면')}
    <div class="roster">
      <section class="drawing-board"><h2>일반 적 · 평면</h2><div class="units">${units}</div></section>
      <section class="drawing-board boss"><h2>보스 · 평면</h2>
        <figure><div class="boss-plan">${plan}</div>
          <figcaption>${name}<small>${role}</small></figcaption>
          <div class="boss-section">${section}<span>중앙 단면 · 겹친 장갑과 구동축</span></div>
        </figure>
      </section>
    </div></main>`;
}
