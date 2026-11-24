import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../../../../../../../', import.meta.url);
const conceptsRoot = new URL('../../', import.meta.url);
const [id, mode, ...selection] = process.argv.slice(2);

assert(['R09', 'R10'].includes(id), '시안 ID를 R09 또는 R10으로 지정하세요.');
assert(!mode || ['--html', '--only'].includes(mode), '지원 옵션은 --html, --only입니다.');

const readJson = async relative =>
  JSON.parse(await readFile(new URL(relative, root), 'utf8'));
const source = new URL(`${id}/mock/`, conceptsRoot);
const [contract, bank, style, battle, scenes, font] = await Promise.all([
  readJson('docs/contracts/maps.candidate.v0.4.json'),
  readJson('src/content/questions/grade3.json'),
  readFile(new URL('style.css', source), 'utf8'),
  readFile(new URL('battle.html', source), 'utf8'),
  import(new URL('scenes.mjs', source)),
  readFile(new URL('./noto-sans-kr-scene.woff2', import.meta.url)),
]);
const map = contract.maps.find(item => item.id === 'garden_u');
const question = bank.questions.find(item => item.id === 'g3-argon-0001');
const fields = scenes.battleFields(map, question);
const fontFace = `@font-face{font-family:"Noto Sans KR";src:url(data:font/woff2;base64,${font.toString('base64')}) format("woff2");font-weight:100 900;font-display:block}`;
const views = new Map([
  ['a-battle', battle.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key])],
  ['b-towers', scenes.towerSheet()],
  ['c-enemies', scenes.enemySheet()],
]);

function document(body) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>어휘력 타워 디펜스 · ${id}</title><style>${fontFace}\n${style}</style>${body}</html>`;
}

assert(!mode || (selection.length && selection.every(name => views.has(name))),
  '화면 이름은 a-battle, b-towers, c-enemies 중 하나입니다.');

if (mode === '--html') {
  assert.equal(selection.length, 1, 'HTML은 한 화면씩 내보냅니다.');
  process.stdout.write(document(views.get(selection[0])));
} else {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const name of mode === '--only' ? selection : views.keys()) {
      const body = views.get(name);
      await page.setContent(document(body));
      await page.evaluate(() => document.fonts.ready);
      const actual = await page.evaluate(() => {
        const points = document.querySelector('[data-route]')?.points;
        return {
          font: [...document.fonts].map(face => face.status),
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          clipped: [...document.querySelectorAll('.answers button, .shop button, figcaption')]
            .filter(node => node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight)
            .map(node => node.innerText),
          points: points ? Array.from(points, p => [p.x, p.y]) : null,
          slots: [...document.querySelectorAll('[data-slot]')].map(element => {
            const { e, f } = element.transform.baseVal.getItem(0).matrix;
            return [element.dataset.slot, e, f];
          }),
          installed: new Set([...document.querySelectorAll('[data-tower]')].map(element => element.dataset.tower)).size,
          enemies: document.querySelectorAll('[data-enemy]').length,
          answers: [...document.querySelectorAll('.answers button span')].map(element => element.textContent),
          skipped: document.querySelector('.skip')?.textContent.trim().startsWith('모르겠어요'),
          scaleWidths: [...document.querySelectorAll('.reading-strip svg')].map(element => element.getBoundingClientRect().width),
          roster: document.querySelectorAll('.roster figure').length,
        };
      });
      assert.deepEqual(actual.font, ['loaded']);
      assert.equal(actual.overflow, false, `${id}/${name}이 화면 밖으로 넘칩니다.`);
      assert.deepEqual(actual.clipped, []);
      if (name === 'a-battle') {
        const [originX, originY] = actual.points[0];
        const stepX = actual.points[1][0] - originX;
        const stepY = actual.points.find(([, y]) => y !== originY)[1] - originY;
        const [entryX, entryY] = map.entryCell;
        const cell = ([x, y]) => [(x - originX) / stepX + entryX, (y - originY) / stepY + entryY];
        assert.deepEqual(actual.points.map(cell), map.pathCells);
        assert.deepEqual(actual.slots.map(([key, x, y]) => [key, ...cell([x, y])]),
          map.slots.map(({ id, x, y }) => [id, x, y]));
        assert.equal(actual.installed, 4);
        assert.equal(actual.enemies, 12);
        assert.deepEqual(actual.answers, question.options.map(option => option.text));
        assert.equal(actual.skipped, true);
      }
      if (name === 'b-towers') assert.deepEqual(actual.scaleWidths, Array(6).fill(48));
      if (name === 'c-enemies') assert.equal(actual.roster, 5);
      assert.deepEqual(errors, []);
      const png = await page.screenshot({ animations: 'disabled' });
      const output = fileURLToPath(new URL(`../${name}.webp`, source));
      execFileSync('cwebp', ['-quiet', '-q', '90', '-sharp_yuv', '-o', output, '--', '-'], { input: png });
      console.log(`${id}/${name}.webp · 1280×720`);
    }
  } finally {
    await browser.close();
  }
}
