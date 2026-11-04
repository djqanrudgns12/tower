import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { runnerImport } from 'vite';
import type { TowerId } from '../../src/contracts/balance';
import type * as QaStatesModule from '../../tools/qa/states';
import maps from '../../docs/contracts/maps.candidate.v0.4.json' with { type: 'json' };

// 실제 브라우저에서 첫 판 흐름(PRD §18 P1)을 따라간다. 화면 캡처는 test-results/shots에 남긴다.
const garden = maps.maps.find(m => m.id === 'garden_u')!;
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/shots/${name}.png` });

async function newGame(page: Page) {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('vocabulary-td'));
  await page.reload();
  await page.getByRole('textbox', { name: '닉네임' }).fill('하늘바람');
  // 홈 '새 게임' → 새 게임 창의 '시작'.
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
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
  const socket = (await page.getByRole('listbox', { name: '타워 칸' }).getByRole('option', { name }).boundingBox())!;
  const to = await cellCenter(page, x, y);
  await page.mouse.move(socket.x + socket.width / 2, socket.y + socket.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + offset.dx, to.y + offset.dy, { steps: 12 });
  await page.mouse.up();
}

const towerCount = (page: Page, n: number) => expect(page.getByRole('application', { name: new RegExp(`타워 ${n}개`) })).toBeVisible();
/** 전투 중 문제 카드의 국면 태그(R4 PRD §9.1: 준비·전투·대장 태그 하나). 1웨이브는 ‘전투’다. */
const battleTag = (page: Page) => page.getByRole('region', { name: '어휘 문제' }).getByText('전투', { exact: true });

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
  await page.getByRole('listbox', { name: '타워 칸' }).getByRole('option', { name: /궁수탑/ }).click();
  await expect(page.getByRole('option', { name: /궁수탑/ })).toHaveAttribute('aria-selected', 'true');
  const second = garden.slots.find(s => s.x === 5 && s.y === 4)!;
  await tapCell(page, second.x, second.y);
  await towerCount(page, 2);
  // 설치된 타워를 누르면 옆에 도구 묶음(강화·판매)이 뜨고, 능력치 막대가 보인다.
  await tapCell(page, slot.x, slot.y);
  await expect(page.getByRole('group', { name: '궁수탑 레벨 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^강화 \d+ 골드$/ })).toBeVisible();
  await expect(page.getByText('레벨 1', { exact: true })).toBeVisible();
  await shot(page, 'desktop-built');

  await page.getByRole('button', { name: '전투 시작' }).click();
  await expect(battleTag(page)).toBeVisible();
  await page.waitForTimeout(6000);
  await shot(page, 'desktop-battle');

  await page.getByRole('button', { name: '일시정지' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // 정지 중에는 문제·보기가 DOM에서 빠진다(PRD §3.6).
  await expect(page.getByRole('region', { name: '어휘 문제' })).toHaveCount(0);
  await shot(page, 'desktop-paused');
  // 소리(PRD §11.5): 정지 화면에서 끄고 켤 수 있고, 기기 설정에 남는다. 합성 소리는 오류 없이 켜져 있어야 한다.
  const soundToggle = page.getByRole('switch', { name: '소리' });
  await expect(soundToggle).toBeChecked();
  await soundToggle.uncheck();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary-td.settings') ?? '{}').soundOn)).toBe(false);
  await soundToggle.check();
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: '계속하기' }).click();
  await expect(page.getByRole('region', { name: '어휘 문제' })).toBeVisible();
});

test('이어하기 없음: 정지 메뉴에 저장이 없고, 새로고침하면 그 판은 기록 없이 사라져 홈으로 온다(PRD §14.1)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);
  await page.getByRole('button', { name: '일시정지' }).first().click();
  const pause = page.getByRole('dialog');
  // 정지 메뉴: 계속하기·글자 크기·소리·이번 판 끝내기만 있다.
  await expect(pause.getByRole('button', { name: '계속하기' })).toBeVisible();
  await expect(pause.getByRole('button', { name: '이번 판 끝내기' })).toBeVisible();
  await expect(pause.getByText(/저장|이어/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: '새 게임', exact: true })).toBeVisible();
  await expect(page.getByText(/이어하기|저장된 판/)).toHaveCount(0);
  // 진행 중 판을 담던 옛 저장소(run)는 없고, 끝내지 않은 판은 기록되지 않는다.
  const stored = await page.evaluate(() => new Promise<{ stores: string[]; records: number }>((resolve, reject) => {
    const req = indexedDB.open('vocabulary-td');
    req.onsuccess = () => {
      const db = req.result;
      const stores = [...db.objectStoreNames];
      const count = db.transaction('records', 'readonly').objectStore('records').count();
      count.onsuccess = () => { db.close(); resolve({ stores, records: count.result }); };
      count.onerror = () => reject(count.error);
    };
    req.onerror = () => reject(req.error);
  }));
  expect(stored).toEqual({ stores: ['records', 'syncQueue'], records: 0 });
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
  // 설치 자리 목록은 평소 숨어 있고(R4 PRD §3 #10) 키보드 포커스가 닿으면 나타난다. 엔터로 펼친다.
  const summary = page.locator('summary', { hasText: '설치 자리 목록' });
  const clip = () => summary.evaluate(el => getComputedStyle(el.closest('details')!).clipPath);
  expect(await clip()).toBe('inset(50%)');
  await summary.focus();
  expect(await clip()).toBe('none');
  await expect(summary).toBeInViewport();
  await page.keyboard.press('Enter');
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
  // 문제 줄은 국면 태그·준비 점과 지문을 한 줄에 둔다. 줄바꿈이 끼는 innerText 대신 글자 그대로(textContent)를 비교한다.
  const stem = (await page.getByRole('region', { name: '어휘 문제' }).locator('p').first().textContent())!;
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

test('사용 설명서 완독 후 새 게임 시작: 설명서는 그림 카드와 자세히 안내만 두고 바로 본 게임으로 진입한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.clear(); });
  await page.reload();

  await page.getByRole('button', { name: '사용 설명서', exact: true }).click();
  const guide = page.getByRole('dialog', { name: '사용 설명서' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('button', { name: '연습 판 해 보기' })).toHaveCount(0);
  await expect(guide.getByRole('button', { name: '처음으로' })).toHaveCount(0);

  // 옛 '다음 장' 쪽 넘김 대신, 카드 5장을 위에서 아래로 읽으며 '자세히'를 모두 펼쳐 본다.
  await expect(guide.locator('article')).toHaveCount(5);
  const more = guide.getByRole('button', { name: '자세히' });
  await expect(more).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await more.nth(i).click();
    await expect(more.nth(i)).toHaveAttribute('aria-expanded', 'true');
  }
  await guide.getByRole('button', { name: '닫기' }).click();
  await expect(guide).toHaveCount(0);

  await page.getByRole('textbox', { name: '닉네임' }).fill('작전교범수호자');
  // 홈 '새 게임' → 새 게임 창의 '시작'.
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
});

test('첫 연습 판: 문제 1개 → 궁수 설치 → 적 3마리 → 회복, 안내는 조작 옆 한 문장(PRD §12.2)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.clear(); });
  await page.reload();
  await page.getByRole('button', { name: '처음이라면 연습부터' }).click();
  await expect(page.getByText('문제를 풀면 골드를 받아요. 알맞은 답을 눌러 보세요.')).toBeVisible();
  await expect(page.getByRole('img', { name: '준비 1/1' })).toBeVisible();
  await shot(page, 'practice-question');
  await finishPrep(page);
  // 새 화면(ui-rules-v2 §4): 끌어 놓기 안내 → 빈 받침을 누르면 받침 옆 메뉴 안내 → 고르면 바로 설치.
  await expect(page.getByText('궁수탑을 끌어다 길 옆 빈 돌 받침에 놓아요.')).toBeVisible();
  await tapCell(page, 8, 2);
  await expect(page.getByText('받침 옆 작은 메뉴에서 타워를 골라요. 처음에는 궁수탑이 좋아요.')).toBeVisible();
  await page.getByRole('group', { name: '이 자리에 놓을 타워' }).getByRole('button', { name: /궁수탑/ }).click();
  await towerCount(page, 1);
  await expect(page.getByText('‘전투 시작’을 누르면 적 3마리가 길을 따라와요.')).toBeVisible();
  await shot(page, 'practice-start');
  await page.getByRole('button', { name: '전투 시작' }).click();
  await expect(page.getByText('연습을 마쳤어요')).toBeVisible({ timeout: 90_000 });
  await shot(page, 'practice-done');
  await page.getByRole('button', { name: '새 게임 시작' }).click();
  // 닉네임이 없으면 홈의 닉네임 칸으로 안내한다.
  await expect(page.getByRole('textbox', { name: '닉네임' })).toBeFocused();
  // 다시 홈에 오면 연습 권유 대신 ‘연습하기’가 보인다. 연습은 기록에 남지 않는다.
  await expect(page.getByRole('button', { name: '연습하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '처음이라면 연습부터' })).toHaveCount(0);
  const records = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const req = indexedDB.open('vocabulary-td');
    req.onsuccess = () => {
      const db = req.result;
      const count = db.transaction('records', 'readonly').objectStore('records').count();
      count.onsuccess = () => { db.close(); resolve(count.result); };
      count.onerror = () => reject(count.error);
    };
    req.onerror = () => reject(req.error);
  }));
  expect(records).toBe(0);
  // 연습은 언제든 건너뛸 수 있다.
  await page.getByRole('button', { name: '연습하기' }).click();
  await page.getByRole('button', { name: '연습 건너뛰기' }).click();
  await expect(page.getByRole('button', { name: '새 게임', exact: true })).toBeVisible();
});

test('키보드: 설치·판매로 단추가 사라져도 포커스가 body로 떨어지지 않고, Enter가 전투를 몰래 시작하지 않는다(PRD §12.4)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);
  await tapCell(page, 8, 2);
  await page.getByRole('group', { name: '이 자리에 놓을 타워' }).getByRole('button', { name: /궁수탑/ }).click();
  await towerCount(page, 1);
  // 설치 메뉴가 사라지면 포커스를 전장으로 옮긴다(화살표로 다음 자리를 고를 수 있게).
  const field = page.getByRole('application', { name: /전장/ });
  await expect(field).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();
  await expect(battleTag(page)).toHaveCount(0);
  await page.keyboard.press('Escape');

  // 되돌리기 창(3초)이 지나면 도구 묶음의 판매가 보인다. 판매 확인 뒤 도구 묶음이 사라지면 다시 전장으로 옮긴다.
  await expect(page.getByRole('button', { name: /^설치 되돌리기/ })).toHaveCount(0, { timeout: 6000 });
  await tapCell(page, 8, 2);
  const tools = page.getByRole('group', { name: '궁수탑 레벨 1' });
  await tools.getByRole('button', { name: /^판매 \+\d+ 골드$/ }).click();
  await tools.getByRole('button', { name: /^판매 확인 \+\d+ 골드$/ }).click();
  await towerCount(page, 0);
  await expect(field).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await expect(battleTag(page)).toHaveCount(0);
});

test('설치 되돌리기: 설치 직후 그 타워 위 칩을 누르면 전액 환불되고, 3초가 지나면 칩이 사라진다(ui-rules-v2 §4)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await newGame(page);
  await finishPrep(page);
  const goldOf = async () => Number((await page.getByLabel(/^골드 \d+$/).first().getAttribute('aria-label'))!.replace(/\D/g, ''));
  const gold0 = await goldOf();
  await tapCell(page, 8, 2);
  await page.getByRole('group', { name: '이 자리에 놓을 타워' }).getByRole('button', { name: /궁수탑/ }).click();
  await towerCount(page, 1);
  const undo = page.getByRole('button', { name: /^설치 되돌리기 \+\d+ 골드$/ });
  await expect(undo).toBeVisible();
  await shot(page, 'desktop-undo');
  await undo.click();
  await towerCount(page, 0);
  await expect.poll(goldOf).toBe(gold0);
  // 다시 놓고 기다리면 칩이 사라지고 타워는 남는다.
  await tapCell(page, 8, 2);
  await page.getByRole('group', { name: '이 자리에 놓을 타워' }).getByRole('button', { name: /궁수탑/ }).click();
  await expect(undo).toBeVisible();
  await expect(undo).toHaveCount(0, { timeout: 6000 });
  await towerCount(page, 1);
});

test('1366×650 크롬북: R 모드와 칸 크기', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 650 });
  await newGame(page);
  await expect(page.getByRole('complementary', { name: '타워 관리' })).toBeVisible();
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width / 15).toBeGreaterThanOrEqual(44);
  await shot(page, 'chromebook-prep');
  // 압축 레일: 타워 칸(가진 4종 + 잠긴 칸 1, 4칸씩 2줄)과 고른 타워 요약(역할 낱말 + 아이콘·숫자 칩)이 레일 안에 스크롤 없이 들어간다.
  await finishPrep(page);
  const rail = page.getByRole('complementary', { name: '타워 관리' });
  await rail.getByRole('listbox', { name: '타워 칸' }).getByRole('option', { name: /서리탑/ }).click();
  const detail = rail.getByRole('region', { name: '서리탑 능력치' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('느리게', { exact: true })).toBeVisible();
  await expect(detail.getByRole('listitem')).toHaveCount(3);
  const fit = await rail.evaluate(aside => {
    const body = aside.lastElementChild as HTMLElement;
    const sockets = [...aside.querySelectorAll('[role="listbox"] > *')].map(el => el.getBoundingClientRect());
    return { over: body.scrollHeight - body.clientHeight, cells: sockets.length, rows: new Set(sockets.map(r => Math.round(r.top))).size, sameH: sockets.every(r => Math.abs(r.height - sockets[0]!.height) <= 0.5) };
  });
  await shot(page, 'chromebook-detail');
  expect(fit).toEqual({ over: 0, cells: 5, rows: 2, sameH: true });
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

test('학년 단추는 공동검수를 통과한 공개 은행만 시작할 수 있고, 가장 높은 공개 학년의 아주 어려움으로 진입한다(PRD §9.3·§12.2)', async ({ page }) => {
  // 공개 은행(grade<N>.json, status=published)만 게임에 싣는다. 후보 은행은 수량과 상관없이 "문제 준비 중"이다.
  const published = new Map<number, number>();
  for (const g of [3, 4, 5, 6]) {
    const file = path.resolve(import.meta.dirname, `../../src/content/questions/grade${g}.json`);
    if (!existsSync(file)) continue;
    const bank = JSON.parse(readFileSync(file, 'utf8')) as { status: string; questions: unknown[] };
    if (bank.status === 'published') published.set(g, bank.questions.length);
  }
  expect(published.size).toBeGreaterThan(0);

  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('vocabulary-td'));
  await page.reload();
  await page.getByRole('textbox', { name: '닉네임' }).fill('어휘수호대');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: '새 게임' });
  await expect(dialog).toBeVisible();
  const gradeGroup = dialog.getByRole('radiogroup', { name: '학년' });
  for (const g of [3, 4, 5, 6]) {
    if (!published.has(g)) {
      // 공개 은행이 없는 학년은 잠금 아이콘과 '문제 준비 중' 이름으로 읽히고, 눌러도 고를 수 없으며 이유를 한 줄로 알린다.
      const btn = gradeGroup.getByRole('radio', { name: `${g}학년, 문제 준비 중`, exact: true });
      await expect(btn).toBeDisabled();
      await btn.click({ force: true });
      await expect(dialog.getByRole('status').filter({ hasText: '문제 준비 중이에요' })).toBeVisible();
      await expect(btn).toHaveAttribute('aria-checked', 'false');
    } else {
      const btn = gradeGroup.getByRole('radio', { name: `${g}학년`, exact: true });
      await expect(btn).toBeEnabled();
    }
  }

  const top = Math.max(...published.keys());
  await gradeGroup.getByRole('radio', { name: `${top}학년`, exact: true }).click();
  await dialog.getByRole('radiogroup', { name: '난이도' }).getByRole('radio', { name: '아주 어려움', exact: true }).click();

  const newGameA11y = await new AxeBuilder({ page }).analyze();
  expect(newGameA11y.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await dialog.getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
  await expect(page.getByRole('region', { name: '어휘 문제' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, `grade${top}-crazy-prep`);
});

type QaStates = typeof QaStatesModule;
let qaStates: Promise<QaStates> | null = null;
/** 화면 점검 장비의 장면 상태 만들기(tools/qa/states.ts)를 vite로 읽는다. 제품 엔진으로 상태를 만든다. */
const loadQaStates = () => (qaStates ??= runnerImport<QaStates>(path.join(process.cwd(), 'tools/qa/states.ts'), { configFile: false, logLevel: 'error' }).then(r => r.module));

/**
 * 새 타워 고르기가 열린 상태 fixture: 앱은 아직 시범 3종이라 실제 판에서 새 타워 고르기가 열리지 않으므로, 장면 상태
 * 'recruit-fixture'(리뉴얼 전 10종 사용 가능, 시작 4종 장착, 후보 3종)를 개발 전용 QA 장면 로더(`/?qaRun=1`)로 열고 계속한다.
 */
async function openRecruitFixture(page: Page, offers: TowerId[]) {
  const states = await loadQaStates();
  const { state } = states.buildScene('recruit-fixture', { offers });
  await page.goto('/');
  await page.evaluate(({ key, json }) => { indexedDB.deleteDatabase('vocabulary-td'); sessionStorage.setItem(key, json); }, { key: states.QA_RUN_KEY, json: JSON.stringify(state) });
  await page.goto(`/?${states.QA_RUN_PARAM}=1`);
  await page.getByRole('dialog').getByRole('button', { name: '계속하기' }).click();
}

for (const [w, h, name] of [[1440, 900, 'desktop'], [390, 844, 'phone']] as const) {
  test(`${w}×${h} 새 타워: 카드 3장 전체가 고르기 버튼 하나, 막이 문제 카드까지 덮고, 고르면 타워 칸에 들어온다(R4 PRD §9.2)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openRecruitFixture(page, ['crossbow', 'flame', 'banner']);
    const recruit = page.getByRole('dialog', { name: '새 타워' });
    await expect(recruit).toBeVisible();
    // 라디오 + 공통 확정 단추 대신 카드 전체를 한 번 눌러 바로 고른다.
    await expect(recruit.getByRole('radio')).toHaveCount(0);
    const picks = recruit.getByRole('button', { name: /고르기$/ });
    await expect(picks).toHaveCount(3);
    // 카드는 원화·이름·한 줄 역할·상성 아이콘만 둔다: 능력치 막대(dl)와 하늘·땅 표시 줄이 없다.
    await expect(recruit.locator('dl')).toHaveCount(0);
    await expect(recruit.getByText('하늘 적 공격')).toHaveCount(0);
    // 꼭 고르는 창: 닫기가 없고 Esc로 닫히지 않는다. 포커스는 창 안에서 시작한다.
    await expect(recruit.getByRole('button', { name: '닫기' })).toHaveCount(0);
    await expect(picks.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(recruit).toBeVisible();
    // 막이 전장과 문제 카드까지 덮는다: 문제 카드가 있는 본문은 inert라 보기를 누를 수 없다.
    const options = page.getByRole('region', { name: '어휘 문제' }).getByRole('group', { name: '보기' }).getByRole('button');
    await expect(options.first()).toBeAttached();
    expect(await page.evaluate(() => document.querySelector('main')!.inert)).toBe(true);
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflowX).toBeLessThanOrEqual(0);
    // 카드 3장이 창 안에서 다 보인다(휴대폰은 카드가 세로로 쌓인다).
    for (let i = 0; i < 3; i++) await expect(picks.nth(i)).toBeInViewport();
    await shot(page, `recruit-${name}`);
    await recruit.getByRole('button', { name: '석궁탑 고르기' }).click();
    await expect(recruit).toHaveCount(0);
    const armory = page.getByRole('listbox', { name: '타워 칸' });
    await expect(armory.getByRole('option')).toHaveCount(5);
    await expect(armory.getByRole('option', { name: /석궁탑/ })).toBeVisible();
    // 창이 닫히면 문제 카드로 돌아와 바로 답할 수 있다.
    expect(await page.evaluate(() => document.querySelector('main')!.inert)).toBe(false);
    await expect(options.first()).toBeEnabled();
  });
}
