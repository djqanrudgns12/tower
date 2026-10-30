import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// 전투 화면 배치 실측(WP-UI·ui-rules-v2 §2·§3). 계산식이 아니라 실제 DOM 상자로 확인한다.
// 전용 포트로 돌린다: E2E_PORT=5191 npx playwright test tests/e2e/layout.spec.ts --workers=1

async function newGame(page: Page) {
  await page.goto('/');
  await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.removeItem('vocabulary-td.coach'); });
  await page.reload();
  await page.getByRole('textbox', { name: '출정 별명' }).fill('하늘바람');
  await page.getByRole('button', { name: '새 게임' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.getByText('준비 1/5')).toBeVisible();
}

const panel = (page: Page) => page.getByRole('region', { name: '어휘 문제' });
const options = (page: Page) => panel(page).getByRole('group', { name: '보기' }).getByRole('button');

async function boxes(page: Page) {
  return options(page).evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
}

const maxDelta = (a: number[][], b: number[][]) => Math.max(...a.flatMap((row, i) => row.map((v, j) => Math.abs(v - b[i]![j]!))));

async function overflow(page: Page) {
  return page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
}

/** 보이는 글자의 가장 작은 크기와, 보이는 조작부의 가장 작은 변(px). sr-only·캔버스는 뺀다. */
async function minimums(page: Page) {
  return page.locator('main').evaluate(main => {
    // 화면 읽기 전용(sr-only)·포커스 때만 보이는 보조 목록처럼 잘라 숨긴 조상이 있으면 보이지 않는 것으로 본다.
    const clipped = (el: Element | null): boolean => {
      for (let n = el; n && n !== main; n = n.parentElement) if (getComputedStyle(n).clipPath === 'inset(50%)') return true;
      return false;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden' && !clipped(el);
    };
    let font = Infinity;
    let touch = Infinity;
    let smallest = '';
    for (const el of main.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim().length > 0);
      if (hasText) font = Math.min(font, Number.parseFloat(getComputedStyle(el).fontSize));
      if (el.matches('button, [role="option"], summary, input, a[href]')) {
        const r = el.getBoundingClientRect();
        const side = Math.min(r.width, r.height);
        if (side < touch) { touch = side; smallest = el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName; }
      }
    }
    return { font, touch, smallest };
  });
}

/** 정답·오답·모르겠어요 어느 쪽이든 제출 전후 보기 위치·크기와 문제판 높이가 그대로다. */
async function submitWithoutShift(page: Page, how: 'first' | 'skip') {
  await expect(options(page).first()).toBeEnabled();
  const before = await boxes(page);
  const h0 = (await panel(page).boundingBox())!.height;
  if (how === 'first') await options(page).first().click();
  else await panel(page).getByRole('button', { name: '모르겠어요' }).click();
  await expect(options(page).first()).toBeDisabled();
  await page.waitForTimeout(300);
  const after = await boxes(page);
  const h1 = (await panel(page).boundingBox())!.height;
  expect(maxDelta(before, after)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(h1 - h0)).toBeLessThanOrEqual(0.5);
}

/** 다음 보기가 열리거나 준비가 끝날 때까지 기다린다. 오답·모르겠어요는 해설 뒤 ‘다음 문제’를 누른다. */
async function nextQuestion(page: Page) {
  for (let i = 0; i < 60; i++) {
    if (await page.getByRole('button', { name: '전투 시작' }).isVisible()) return;
    // 기기가 느려 멈춤 층이 뜨면(PERFORMANCE) 계속한다. 멈춘 동안 문제는 DOM에서 빠지므로 기다리지 않고 짧게 묻는다.
    const resume = page.getByRole('button', { name: '계속하기' });
    if (await resume.isVisible()) await resume.click();
    if (await options(page).first().isEnabled({ timeout: 300 }).catch(() => false)) return;
    const next = panel(page).getByRole('button', { name: '다음 문제' });
    if (await next.isEnabled({ timeout: 300 }).catch(() => false)) await next.click();
    await page.waitForTimeout(300);
  }
}

for (const [w, h, mode] of [[1440, 900, 'R'], [1366, 650, 'R'], [1024, 690, 'R'], [820, 1060, 'S'], [390, 844, 'S']] as const) {
  test(`${w}×${h}: 제출 흔들림 0, 넘침 0, 하한(13px·44px)${mode === 'R' ? ', 수직선 잠금' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await newGame(page);

    const o = await overflow(page);
    expect(o.x).toBeLessThanOrEqual(0);
    expect(o.y).toBeLessThanOrEqual(0);

    if (mode === 'R') {
      // 전장 오른쪽 + 12px = 레일 왼쪽 = 하단 오른쪽 열 왼쪽.
      const field = (await page.locator('canvas').boundingBox())!;
      const rail = (await page.getByRole('complementary', { name: '타워 관리' }).boundingBox())!;
      const side = (await panel(page).locator('[data-feedback]').boundingBox())!;
      expect(Math.abs(field.x + field.width + 12 - rail.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(rail.x - side.x)).toBeLessThanOrEqual(0.5);
      // 하단 판 바깥 오른쪽 끝 = 레일 바깥 오른쪽 끝.
      const board = (await panel(page).boundingBox())!;
      expect(Math.abs(rail.x + rail.width - (board.x + board.width))).toBeLessThanOrEqual(0.5);
    }
    if (w === 1366) {
      // 압축 상태 바는 두 줄(성문 줄 + 골드·점수·웨이브 줄)이다.
      const meter = (await page.getByRole('meter', { name: '성문' }).boundingBox())!;
      const gold = (await page.getByLabel(/^골드 \d+/).first().boundingBox())!;
      expect(gold.y).toBeGreaterThan(meter.y + meter.height / 2);
      expect(gold.y - meter.y).toBeLessThan(56);
    }

    const m = await minimums(page);
    expect(m.font).toBeGreaterThanOrEqual(13);
    expect(m.touch, m.smallest).toBeGreaterThanOrEqual(44);

    await submitWithoutShift(page, 'first');
    expect((await overflow(page)).y).toBeLessThanOrEqual(0);
    await nextQuestion(page);
    await submitWithoutShift(page, 'skip');
    expect((await overflow(page)).y).toBeLessThanOrEqual(0);
  });
}

test('1440×900: 설치 뒤 도구 묶음·능력치 막대도 13px·44px 하한을 지킨다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  for (let i = 0; i < 12 && !(await page.getByRole('button', { name: '전투 시작' }).isVisible()); i++) {
    if (await options(page).first().isEnabled({ timeout: 300 }).catch(() => false)) await options(page).first().click();
    await page.waitForTimeout(200);
    await nextQuestion(page);
  }
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();
  await page.getByRole('listbox', { name: '타워 장착 홈' }).getByRole('option', { name: /궁수탑/ }).click();
  const box = (await page.locator('canvas').boundingBox())!;
  const cell = box.width / 15;
  await page.mouse.click(box.x + 8.5 * cell, box.y + 2.5 * cell);
  await expect(page.getByRole('application', { name: /타워 1개/ })).toBeVisible();
  await page.mouse.click(box.x + 8.5 * cell, box.y + 2.5 * cell);
  await expect(page.getByRole('group', { name: '궁수탑 레벨 1' })).toBeVisible();
  // 도구 묶음 등장(크기 0.94→1, 180ms)이 끝난 뒤 잰다.
  await page.waitForTimeout(400);
  const m = await minimums(page);
  expect(m.font).toBeGreaterThanOrEqual(13);
  expect(m.touch, m.smallest).toBeGreaterThanOrEqual(44);
  const o = await overflow(page);
  expect([o.x, o.y].every(v => v <= 0)).toBe(true);
  // 장착 홈·도구 묶음·능력치 막대가 보이는 상태의 접근성 위반 0(캔버스 제외).
  const axe = await new AxeBuilder({ page }).exclude('canvas').analyze();
  expect(axe.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test('정지 화면: 열면 첫 단추에 한 번 포커스, Tab은 안에서만 돌고, 닫으면 연 단추로 돌아간다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  const pause = page.getByRole('button', { name: '일시정지' });
  await pause.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '계속하기' })).toBeFocused();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  // 글자 크기를 키보드로 바꿔도 포커스가 그 자리에 남는다.
  await dialog.getByRole('radio', { name: '크게', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('radio', { name: '크게', exact: true })).toBeFocused();
  await dialog.getByRole('radio', { name: '보통', exact: true }).check();
  await dialog.getByRole('button', { name: '계속하기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(pause).toBeFocused();
});
