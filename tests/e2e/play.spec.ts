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
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByRole('textbox').fill('하늘바람');
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

async function tapCell(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const cell = box.width / 15;
  await page.mouse.click(box.x + (x + 0.5) * cell, box.y + (y + 0.5) * cell);
}

test('1440×900: 준비 → 설치 → 전투 → 정지 가림 → 재개', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await shot(page, 'desktop-prep');
  const cell = await page.locator('canvas').boundingBox();
  expect(cell!.width / 15).toBeGreaterThan(70);
  await finishPrep(page);
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();

  const slot = garden.slots.find(s => s.x === 8 && s.y === 2)!;
  await tapCell(page, slot.x, slot.y);
  await expect(page.getByText('어떤 타워를 놓을까요?')).toBeVisible();
  await page.getByRole('option', { name: /궁수탑/ }).click();
  await shot(page, 'desktop-preview');
  await page.getByRole('button', { name: '설치 · 60골드' }).click();
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
  await page.getByRole('button', { name: '계속하기' }).click();
  await expect(page.getByRole('region', { name: '어휘 문제' })).toBeVisible();
});

test('390×844 휴대폰: 가로 넘침 없음, 문제 전체가 보이고 확대 선택이 열린다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newGame(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, 'phone-prep');
  await finishPrep(page);
  await tapCell(page, 8, 2);
  await expect(page.getByRole('button', { name: '전체 지도' })).toBeVisible();
  await shot(page, 'phone-magnify');
  await page.getByRole('button', { name: '전체 지도' }).click();
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
  await expect(page.getByText('어떤 타워를 놓을까요?')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('어떤 타워를 놓을까요?')).toHaveCount(0);
  await page.getByText(/설치 자리 목록/).click();
  await page.getByRole('button', { name: '자리 9 · 가로 9, 세로 3 · 비어 있음' }).click();
  await expect(page.getByText('어떤 타워를 놓을까요?')).toBeInViewport();
  // 목록은 접히고 포커스는 관리 패널의 첫 타워로 간다.
  await expect(page.getByRole('option', { name: /궁수탑/ })).toBeFocused();
  await shot(page, 'desktop-slot-list');
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

test('첫 연습 판: 문제 1개 → 궁수 설치 → 적 3마리 → 회복, 안내는 조작 옆 한 문장(PRD §12.2)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.clear(); });
  await page.reload();
  await page.getByRole('button', { name: '처음이라면 연습부터' }).click();
  await expect(page.getByText('문제를 풀면 골드를 받아요. 알맞은 답을 눌러 보세요.')).toBeVisible();
  await expect(page.getByText('준비 1/1')).toBeVisible();
  await shot(page, 'practice-question');
  await finishPrep(page);
  await expect(page.getByText('길 옆 빈 돌 받침을 눌러 타워 자리를 골라요.')).toBeVisible();
  await tapCell(page, 8, 2);
  await expect(page.getByText('타워를 하나 골라요. 처음에는 빠르게 쏘는 궁수탑이 좋아요.')).toBeVisible();
  await page.getByRole('option', { name: /궁수탑/ }).click();
  await page.getByRole('button', { name: '설치 · 60골드' }).click();
  await expect(page.getByText('‘전투 시작’을 누르면 적 3마리가 길을 따라와요.')).toBeVisible();
  await shot(page, 'practice-start');
  await page.getByRole('button', { name: '전투 시작' }).click();
  await expect(page.getByText('연습을 마쳤어요')).toBeVisible({ timeout: 90_000 });
  await shot(page, 'practice-done');
  await page.getByRole('button', { name: '새 게임 시작' }).click();
  await expect(page.getByRole('textbox')).toBeVisible();
  // 다시 홈에 오면 연습 권유 대신 ‘연습하기’가 보인다. 연습은 기록에 남지 않는다.
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page.getByRole('button', { name: '연습하기' })).toBeVisible();
  await page.getByRole('button', { name: '내 기록' }).click();
  await expect(page.getByText('아직 기록이 없어요')).toBeVisible();
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
