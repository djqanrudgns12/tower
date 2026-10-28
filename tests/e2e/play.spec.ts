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
  await expect(page.getByText('레벨 1')).toBeVisible();
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
