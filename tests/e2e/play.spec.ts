import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import maps from '../../docs/contracts/maps.candidate.v0.4.json' with { type: 'json' };

// 실제 브라우저에서 첫 판 흐름(PRD §18 P1)을 따라간다. 화면 캡처는 test-results/shots에 남긴다.
const garden = maps.maps.find(m => m.id === 'garden_u')!;
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/shots/${name}.png` });

async function newGame(page: Page) {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('vocabulary-td'));
  await page.reload();
  await page.getByRole('textbox', { name: '출정 별명' }).fill('하늘바람');
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByText('준비 1/5')).toBeVisible();
}

/** 첫 보기를 눌러 준비 문제를 끝낸다. 오답이면 4초 해설 뒤 ‘다음 문제’. */
async function finishPrep(page: Page) {
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole('button', { name: '전투 시작' }).isVisible()) return;
    const panel = page.getByRole('region', { name: '어휘 문제' });
    const first = panel.getByRole('group', { name: '보기' }).getByRole('button').first();
    await first.click();
    // 답안은 다음 논리 틱(1/30초)에 채점된다. 채점되어 보기가 잠길 때까지 기다린다.
    await expect(first).toBeDisabled();
    const next = panel.getByRole('button', { name: '다음 문제' });
    if (await next.isVisible({ timeout: 2500 }).catch(() => false) || await panel.getByText('해설을 읽어 주세요').isVisible().catch(() => false)) {
      await expect(next).toBeEnabled({ timeout: 6000 });
      await next.click();
    }
    await page.waitForTimeout(1200);
  }
}

async function cellCenter(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const cell = box.width / 15;
  return { x: box.x + (x + 0.5) * cell, y: box.y + (y + 0.5) * cell };
}

async function tapCell(page: Page, x: number, y: number) {
  const at = await cellCenter(page, x, y);
  await page.mouse.click(at.x, at.y);
}

/** 장착 홈 소켓을 눌러 전장 칸까지 끌어 놓는다(ui-rules-v2 §4). 칸 가장자리 근처에 놓아도 자석으로 붙는다. */
async function dragTower(page: Page, name: RegExp, x: number, y: number, offset = { dx: 0, dy: 0 }) {
  const socket = (await page.getByRole('listbox', { name: '타워 장착 홈' }).getByRole('option', { name }).boundingBox())!;
  const to = await cellCenter(page, x, y);
  await page.mouse.move(socket.x + socket.width / 2, socket.y + socket.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + offset.dx, to.y + offset.dy, { steps: 12 });
  await page.mouse.up();
}

const towerCount = (page: Page, n: number) => expect(page.getByRole('application', { name: new RegExp(`타워 ${n}개`) })).toBeVisible();

test('1440×900: 준비 → 설치 → 전투 → 정지 가림 → 재개', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await shot(page, 'desktop-prep');
  const cell = await page.locator('canvas').boundingBox();
  expect(cell!.width / 15).toBeGreaterThan(70);
  await finishPrep(page);
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();

  // 끌어 놓기: 칸 가운데에서 0.4칸 벗어나 놓아도 가장 가까운 빈 자리에 바로 설치된다(확인 단계 없음).
  const slot = garden.slots.find(s => s.x === 8 && s.y === 2)!;
  const cellPx = (await page.locator('canvas').boundingBox())!.width / 15;
  await dragTower(page, /궁수탑/, slot.x, slot.y, { dx: cellPx * 0.4, dy: -cellPx * 0.3 });
  await towerCount(page, 1);
  await shot(page, 'desktop-dragged');
  // 타워를 먼저 고르고 빈 자리를 누르면 바로 설치된다. 골드가 남으면 같은 타워가 계속 골라져 있다.
  await page.getByRole('listbox', { name: '타워 장착 홈' }).getByRole('option', { name: /궁수탑/ }).click();
  await expect(page.getByRole('option', { name: /궁수탑/ })).toHaveAttribute('aria-selected', 'true');
  const second = garden.slots.find(s => s.x === 5 && s.y === 4)!;
  await tapCell(page, second.x, second.y);
  await towerCount(page, 2);
  // 설치된 타워를 누르면 옆에 도구 묶음(강화·판매)이 뜨고, 능력치 막대가 보인다.
  await tapCell(page, slot.x, slot.y);
  await expect(page.getByRole('group', { name: '궁수탑 레벨 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^강화 \d+골드$/ })).toBeVisible();
  await expect(page.getByText('레벨 1', { exact: true })).toBeVisible();
  await shot(page, 'desktop-built');

  await page.getByRole('button', { name: '전투 시작' }).click();
  await expect(page.getByText('전투 문제')).toBeVisible();
  await page.waitForTimeout(6000);
  await shot(page, 'desktop-battle');

  await page.getByRole('button', { name: '일시정지' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // 정지 중에는 문제·보기가 DOM에서 빠진다(PRD §3.6).
  await expect(page.getByRole('region', { name: '어휘 문제' })).toHaveCount(0);
  await shot(page, 'desktop-paused');
  // 소리(PRD §11.5): 정지 화면에서 끄고 켤 수 있고, 기기 설정에 남는다. 합성 소리는 오류 없이 켜져 있어야 한다.
  const soundToggle = page.getByRole('checkbox', { name: '소리' });
  await expect(soundToggle).toBeChecked();
  await soundToggle.uncheck();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary-td.settings') ?? '{}').soundOn)).toBe(false);
  await soundToggle.check();
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: '계속하기' }).click();
  await expect(page.getByRole('region', { name: '어휘 문제' })).toBeVisible();
});

test('일시정지 및 새로고침: 이어하기·저장하고 나가기 없이 깔끔하게 종료된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);

  await page.getByRole('button', { name: '일시정지' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: '저장하고 나가기' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: '새 게임' })).toBeVisible();
  await expect(page.getByRole('button', { name: /이어하기/ })).toHaveCount(0);
});

test('390×844 휴대폰: 가로 넘침 없음, 문제 전체가 보이고 확대 선택이 열린다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newGame(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, 'phone-prep');
  await finishPrep(page);
  await shot(page, 'phone-build');
  // 빈 자리를 먼저 누르면 확대되고 그 자리 옆에 작은 고르기 메뉴가 뜬다. 고르면 바로 설치된다.
  await tapCell(page, 8, 2);
  await expect(page.getByRole('button', { name: '전체 지도' })).toBeVisible();
  const menu = page.getByRole('group', { name: '이 자리에 놓을 타워' });
  await expect(menu).toBeVisible();
  await shot(page, 'phone-magnify');
  await menu.getByRole('button', { name: /궁수탑/ }).click();
  await towerCount(page, 1);
  await expect(page.getByRole('button', { name: '전체 지도' })).toHaveCount(0);
  const after = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(after).toBeLessThanOrEqual(0);
  await shot(page, 'phone-built');
});

test('키보드: 전장 화살표·Enter로 자리를 고르고, 설치 자리 목록으로도 고른다(PRD §12.4)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);
  const field = page.getByRole('application', { name: /전장/ });
  await field.focus();
  // 첫 자리(가로 1, 세로 1)에서 오른쪽으로 한 칸 → 가로 4, 세로 1.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('자리 2 · 가로 4, 세로 1 · 비어 있음', { exact: true }).first()).toBeAttached();
  // 전장에 포커스가 있을 때 숫자 키는 문제 답이 아니다. Enter로 자리를 고른다.
  await page.keyboard.press('Enter');
  const menu = page.getByRole('group', { name: '이 자리에 놓을 타워' });
  await expect(menu).toBeVisible();
  // 메뉴의 첫 타워로 포커스가 가고, Esc는 메뉴를 닫고 전장으로 돌아간다.
  await expect(menu.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(field).toBeFocused();
  await page.getByText(/설치 자리 목록/).click();
  await page.getByRole('button', { name: '자리 9 · 가로 9, 세로 3 · 비어 있음' }).click();
  await expect(menu).toBeInViewport();
  // 목록은 접히고 포커스는 메뉴의 첫 타워로 간다. 엔터로 바로 설치한다.
  await expect(menu.getByRole('button', { name: /궁수탑/ })).toBeFocused();
  await shot(page, 'desktop-slot-list');
  await page.keyboard.press('Enter');
  await towerCount(page, 1);
});

test('WebGL 문맥 손실: 멈추고, 화면이 돌아온 뒤 계속하면 같은 문제로 이어진다(PRD §12.7)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  const stem = await page.getByRole('region', { name: '어휘 문제' }).locator('p').first().innerText();
  // 잃은 문맥에서는 확장을 다시 얻을 수 없으므로 처음 얻은 것을 window에 둔다.
  const lose = (restore: boolean) => page.evaluate(r => {
    const w = window as unknown as { loseExt?: WEBGL_lose_context };
    if (!w.loseExt) {
      const canvas = document.querySelector('canvas')!;
      const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext;
      w.loseExt = gl.getExtension('WEBGL_lose_context')!;
    }
    if (r) w.loseExt.restoreContext(); else w.loseExt.loseContext();
  }, restore);
  await lose(false);
  await expect(page.getByRole('dialog')).toContainText('화면을 다시 그리는 중이에요');
  await expect(page.getByRole('button', { name: '계속하기' })).toHaveAttribute('aria-disabled', 'true');
  // 막힌 ‘계속’은 눌러도 풀리지 않는다(aria-disabled라 Playwright 기본 클릭은 기다리므로 강제로 누른다).
  await page.getByRole('button', { name: '계속하기' }).click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible();
  await lose(true);
  await expect(page.getByRole('dialog')).toContainText('화면이 잠시 꺼졌다가 돌아왔어요');
  await page.getByRole('button', { name: '계속하기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '어휘 문제' }).locator('p').first()).toHaveText(stem);
  await shot(page, 'desktop-context-restored');
});

test('사용 설명서 완독 후 새 게임 출정: 연습 판 버튼 없이 4장 안내에 집중하고 바로 본 게임으로 진입한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.clear(); });
  await page.reload();

  await page.getByRole('button', { name: '사용 설명서' }).click();
  const guide = page.getByRole('dialog', { name: '사용 설명서' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('button', { name: '연습 판 해 보기' })).toHaveCount(0);
  await expect(guide.getByRole('button', { name: '처음으로' })).toHaveCount(0);

  await guide.getByRole('button', { name: '다음 장' }).click();
  await expect(guide.locator('footer')).toContainText('2 / 4');
  await guide.getByRole('button', { name: '다음 장' }).click();
  await expect(guide.locator('footer')).toContainText('3 / 4');
  await guide.getByRole('button', { name: '다음 장' }).click();
  await expect(guide.locator('footer')).toContainText('4 / 4');
  await guide.getByRole('button', { name: '닫기' }).click();
  await expect(guide).toHaveCount(0);

  await page.getByRole('textbox', { name: '출정 별명' }).fill('작전교범수호자');
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByText('준비 1/5')).toBeVisible();
});

test('1366×650 크롬북: R 모드와 칸 크기', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 650 });
  await newGame(page);
  await expect(page.getByRole('complementary', { name: '타워 관리' })).toBeVisible();
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width / 15).toBeGreaterThanOrEqual(44);
  await shot(page, 'chromebook-prep');
});

test('접근성: 홈·준비 화면 axe 위반 없음(캔버스 제외)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const home = await new AxeBuilder({ page }).analyze();
  expect(home.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await newGame(page);
  const game = await new AxeBuilder({ page }).exclude('canvas').analyze();
  expect(game.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test('3~6학년 1,000+ 문항 준비 표시 및 고학년·고난이도 새 게임 진입 검증', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('vocabulary-td'));
  await page.reload();
  await page.getByRole('textbox', { name: '출정 별명' }).fill('어휘수호대');
  await page.getByRole('button', { name: '새 게임' }).click();

  const dialog = page.getByRole('dialog', { name: '새 게임 출정 설정' });
  await expect(dialog).toBeVisible();
  const gradeGroup = dialog.getByRole('radiogroup', { name: '학년' });
  for (const g of [3, 4, 5, 6]) {
    const btn = gradeGroup.getByRole('radio', { name: new RegExp(`^${g}학년`) });
    await expect(btn).toBeEnabled();
    await expect(btn).toContainText(/문제 준비됨 · 1,\d{3}문항/);
  }

  // 6학년 + 아주 어려움 선택 후 시작하여 실제 고학년 문항 패널 및 접근성·가로 넘침 이상 없음 확인
  await gradeGroup.getByRole('radio', { name: /^6학년/ }).click();
  await dialog.getByRole('radiogroup', { name: '난이도' }).getByRole('radio', { name: /^아주 어려움/ }).click();

  const newGameA11y = await new AxeBuilder({ page }).analyze();
  expect(newGameA11y.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByText('준비 1/5')).toBeVisible();
  await expect(page.getByRole('region', { name: '어휘 문제' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, 'grade6-crazy-prep');
});
