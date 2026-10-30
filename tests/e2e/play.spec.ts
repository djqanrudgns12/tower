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

async function tapCell(page: Page, x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const cell = box.width / 15;
  await page.mouse.click(box.x + (x + 0.5) * cell, box.y + (y + 0.5) * cell);
}

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

test('저장하고 나가기 → 새로고침 → 이어하기: 정지 상태로 같은 골드·성문·타워에서 이어진다(PRD §14)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);
  const slot = garden.slots.find(s => s.x === 8 && s.y === 2)!;
  await tapCell(page, slot.x, slot.y);
  await page.getByRole('option', { name: /궁수탑/ }).click();
  await page.getByRole('button', { name: '설치 · 60골드' }).click();
  await expect(page.getByText('레벨 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '전투 시작' }).click();
  await expect(page.getByText('전투 문제')).toBeVisible();
  await page.waitForTimeout(4000);

  await page.getByRole('button', { name: '일시정지' }).first().click();
  const gold = await page.getByLabel(/^골드 \d+$/).first().getAttribute('aria-label');
  const gate = await page.getByRole('meter', { name: '성문' }).first().getAttribute('aria-valuenow');
  await page.getByRole('button', { name: '저장하고 나가기' }).click();
  // 활성 저장이 있으면 홈은 이어하기를 새 게임보다 앞에 둔다(PRD §12.2).
  const resume = page.getByRole('button', { name: '이어하기 · 하늘바람 · 1웨이브' });
  await expect(resume).toBeVisible();

  await page.reload();
  await resume.click();
  // 이어하기는 정지 상태로 시작하고 문제는 가려져 있다(PRD §14.2, §3.6).
  await expect(page.getByRole('dialog')).toContainText('저장한 곳에서 다시 시작해요');
  await expect(page.getByRole('region', { name: '어휘 문제' })).toHaveCount(0);
  await expect(page.getByLabel(/^골드 \d+$/).first()).toHaveAttribute('aria-label', gold!);
  await expect(page.getByRole('meter', { name: '성문' }).first()).toHaveAttribute('aria-valuenow', gate!);
  await shot(page, 'desktop-restored');
  await page.getByRole('button', { name: '계속하기' }).click();
  await expect(page.getByRole('region', { name: '어휘 문제' })).toBeVisible();
  await expect(page.getByText('전투 문제')).toBeVisible();
  await expect(page.getByText(/빈 자리 19곳/)).toBeVisible();
});

test('자동 저장: 저장하고 나가기 없이 새로고침해도 마지막 저장에서 이어 한다(PRD §14.1)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();
  const gold = await page.getByLabel(/^골드 \d+$/).first().getAttribute('aria-label');
  await page.reload();
  await page.getByRole('button', { name: '이어하기 · 하늘바람 · 1웨이브' }).click();
  await expect(page.getByRole('dialog')).toContainText('저장한 곳에서 다시 시작해요');
  await expect(page.getByLabel(/^골드 \d+$/).first()).toHaveAttribute('aria-label', gold!);
  await page.getByRole('button', { name: '계속하기' }).click();
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();
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

test('사용 설명서 완독 후 새 게임 출정: 설명서는 4장 안내만 두고 바로 본 게임으로 진입한다', async ({ page }) => {
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
  // 별명이 없으면 홈의 출정 별명 칸으로 안내한다.
  await expect(page.getByRole('textbox', { name: '출정 별명' })).toBeFocused();
  // 다시 홈에 오면 연습 권유 대신 ‘연습하기’가 보인다. 연습은 기록·저장에 남지 않는다.
  await expect(page.getByRole('button', { name: '연습하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '처음이라면 연습부터' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /이어하기/ })).toHaveCount(0);
  const stored = await page.evaluate(() => new Promise<{ records: number; run: number }>((resolve, reject) => {
    const req = indexedDB.open('vocabulary-td');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['records', 'run'], 'readonly');
      const records = tx.objectStore('records').count();
      const run = tx.objectStore('run').count();
      tx.oncomplete = () => { db.close(); resolve({ records: records.result, run: run.result }); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }));
  expect(stored).toEqual({ records: 0, run: 0 });
  // 연습은 언제든 건너뛸 수 있다.
  await page.getByRole('button', { name: '연습하기' }).click();
  await page.getByRole('button', { name: '연습 건너뛰기' }).click();
  await expect(page.getByRole('button', { name: '새 게임' })).toBeVisible();
});

test('키보드: 설치·판매로 단추가 사라져도 포커스가 body로 떨어지지 않고, Enter가 전투를 몰래 시작하지 않는다(PRD §12.4)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);
  await tapCell(page, 8, 2);
  await page.getByRole('option', { name: /궁수탑/ }).click();
  await page.getByRole('button', { name: '설치 · 60골드' }).click();
  await expect(page.getByText('레벨 1', { exact: true })).toBeVisible();
  // 설치 단추가 사라지면 그 칸의 타워 정보로 포커스를 옮긴다.
  const panel = page.getByRole('group', { name: '선택한 칸과 타워 정보' });
  await expect(panel).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();
  await expect(page.getByText('전투 문제')).toHaveCount(0);

  // 판매 확인 뒤 선택이 풀리면 전투 시작 단추로 옮긴다(보이는 포커스에서만 Enter가 전투를 연다).
  await page.getByRole('button', { name: /^판매 \(\d+골드\)$/ }).click();
  await page.getByRole('button', { name: /골드에 판매$/ }).click();
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
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
