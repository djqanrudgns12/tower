import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import defaults from '../../docs/contracts/product.defaults.v0.5.json' with { type: 'json' };
import grade3 from '../../src/content/questions/grade3.json' with { type: 'json' };
import grade3Candidate from '../../src/content/questions/grade3.candidate.json' with { type: 'json' };
import grade3Dev from '../../src/content/questions/grade3.dev.json' with { type: 'json' };

// WP-UI 화면 배치 실측(PRD §12.1·§12.4·§12.5, 시안 1 v3). 계산식을 다시 쓰지 않고 실제 DOM 좌표를 잰다.
// 전용 포트: E2E_PORT=5182 npx playwright test tests/e2e/layout.spec.ts --workers=1

const TOLERANCE = 0.5;
const railGap = defaults.layout.modes.R.railGapPx;
/** 두 칸 문제판 높이 예산(기본 글자). PRD §12.5: 지문·보기가 길면 이 예산을 넘어 늘어날 수 있다. */
const budget = defaults.layout.modes.R.questionBaseHeightPx + defaults.layout.questionFontExtraPx.base;

/** 보기 네 개의 글자 묶음으로 정답 글자를 찾는다(3학년 은행 전체에서 보기 묶음이 겹치지 않음을 확인함). */
const answerBySet = new Map<string, string>();
for (const bank of [grade3, grade3Candidate, grade3Dev]) {
  for (const q of bank.questions) {
    const key = q.options.map(o => o.text).sort().join('|');
    answerBySet.set(key, q.options.find(o => o.id === q.correctOptionId)!.text);
  }
}

interface Rect { x: number; y: number; w: number; h: number }
interface Snapshot {
  options: Rect[];
  panel: Rect;
  cols: string;
  overflowY: number;
  overflowX: number;
}

async function startGame(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.evaluate(() => {
    indexedDB.deleteDatabase('vocabulary-td');
    localStorage.clear();
  });
  await page.reload();
  await page.getByRole('textbox', { name: '닉네임' }).fill('수직선검사');
  // 홈 '새 게임' → 새 게임 창의 '시작'.
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
}

const panelOf = (page: Page) => page.getByRole('region', { name: '어휘 문제' });
const optionsOf = (page: Page) => panelOf(page).getByRole('group', { name: '보기' }).getByRole('button');

/** 문서 좌표(스크롤 포함)로 보기·문제판 상자와 문서 넘침을 잰다. */
async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const abs = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height };
    };
    const panel = document.querySelector('section[aria-label="어휘 문제"]')!;
    const options = [...panel.querySelectorAll('[role="group"][aria-label="보기"] > button')].map(abs);
    const doc = document.documentElement;
    const cols = panel.querySelector('[role="group"][aria-label="보기"]')!.getAttribute('data-cols') ?? '?';
    return { options, panel: abs(panel), cols, overflowY: doc.scrollHeight - window.innerHeight, overflowX: doc.scrollWidth - window.innerWidth };
  });
}

function maxDelta(before: Snapshot, after: Snapshot) {
  let d = 0;
  before.options.forEach((r, i) => {
    const a = after.options[i]!;
    d = Math.max(d, Math.abs(r.x - a.x), Math.abs(r.y - a.y), Math.abs(r.w - a.w), Math.abs(r.h - a.h));
  });
  return d;
}

type Outcome = 'wrong' | 'correct' | 'skip';

/** 보기가 다시 눌릴 수 있을 때까지(새 문제) 기다린다. */
async function waitForFreshQuestion(page: Page) {
  await expect(optionsOf(page).first()).toBeEnabled({ timeout: 8000 });
  // 측정(2단계 레이아웃 효과)이 끝난 프레임 뒤에 잰다.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function submit(page: Page, outcome: Outcome) {
  const panel = panelOf(page);
  if (outcome === 'skip') {
    await panel.getByRole('button', { name: '모르겠어요' }).click();
  } else {
    const texts = await optionsOf(page).allInnerTexts();
    const shown = await panel.locator('[data-option-text]').allInnerTexts();
    const correct = answerBySet.get([...shown].sort().join('|'));
    expect(correct, `은행에서 보기 묶음을 찾지 못함: ${shown.join(' / ')}`).toBeTruthy();
    const index = shown.findIndex(t => (outcome === 'correct' ? t === correct : t !== correct));
    expect(index).toBeGreaterThanOrEqual(0);
    expect(texts.length).toBe(4);
    await optionsOf(page).nth(index).click();
  }
  await expect(optionsOf(page).first()).toBeDisabled();
  // 정답은 ‘정답!’, 오답·모르겠어요는 정답 키가 초록이 되고 해설 한 칸이 보인다(R4 PRD §9.1).
  if (outcome === 'correct') await expect(panel.getByText('정답!')).toBeVisible();
  else {
    await expect(panel.locator('[data-explain]')).toBeVisible();
    await expect(panel.locator('[data-state="correct"]')).toHaveCount(1);
  }
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function advance(page: Page, outcome: Outcome) {
  if (outcome === 'correct') return; // 정답은 1초 뒤 저절로 넘어간다.
  const next = panelOf(page).getByRole('button', { name: '다음 문제' });
  await expect(next).toBeEnabled({ timeout: 8000 });
  await next.click();
}

/** R 모드 수직선: 전장 오른쪽+12px = 레일 왼쪽 = 하단 오른쪽 칸(해설 카드) 왼쪽. */
async function seams(page: Page) {
  return page.evaluate(() => {
    const rail = document.querySelector('aside[aria-label="타워 관리"]')!;
    const field = rail.previousElementSibling!;
    const panel = document.querySelector('section[aria-label="어휘 문제"]')!;
    const main = panel.children[0]!;
    const card = panel.children[1]!;
    return {
      fieldRight: field.getBoundingClientRect().right,
      railLeft: rail.getBoundingClientRect().left,
      cardLeft: card.getBoundingClientRect().left,
      mainRight: main.getBoundingClientRect().right,
    };
  });
}

const VIEWPORTS: Array<{ w: number; h: number; mode: 'R' | 'S' }> = [
  { w: 1440, h: 900, mode: 'R' },
  { w: 1366, h: 650, mode: 'R' },
  { w: 1024, h: 690, mode: 'R' },
  { w: 820, h: 1060, mode: 'S' },
  { w: 390, h: 844, mode: 'S' },
];

for (const vp of VIEWPORTS) {
  test(`${vp.w}×${vp.h} ${vp.mode}: 오답·정답·모르겠어요 제출 전후 보기 위치·문제판 높이 그대로, 문서 넘침 0`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    await startGame(page, vp.w, vp.h);
    await expect(page.getByRole('complementary', { name: '타워 관리' })).toHaveCount(vp.mode === 'R' ? 1 : 0);

    const report: string[] = [];
    for (const outcome of ['wrong', 'correct', 'skip'] as const) {
      await waitForFreshQuestion(page);
      const before = await snapshot(page);
      expect(before.options).toHaveLength(4);
      await submit(page, outcome);
      const after = await snapshot(page);
      const delta = maxDelta(before, after);
      const panelDelta = Math.abs(after.panel.h - before.panel.h) + Math.abs(after.panel.y - before.panel.y);
      // 문제판이 예산 안이면 세로 넘침은 0이어야 한다. 지문·보기 글이 길어 제출 전부터 예산을 넘으면(PRD §12.5 허용)
      // 그 초과분만큼만 넘칠 수 있고, 제출로 넘침이 늘어서는 안 된다.
      const contentOver = vp.mode === 'R' ? Math.max(0, Math.ceil(before.panel.h - budget)) : 0;
      report.push(`${outcome}: 보기Δ=${delta.toFixed(2)} 문제판Δ=${panelDelta.toFixed(2)} 높이=${before.panel.h.toFixed(2)} 열=${before.cols} 보기높이=${before.options[0]!.h.toFixed(2)} 세로넘침=${before.overflowY}/${after.overflowY} 가로넘침=${before.overflowX}/${after.overflowX}${contentOver ? ` 예산초과=${contentOver}` : ''}`);
      expect(delta, `${outcome} 보기 이동`).toBeLessThanOrEqual(TOLERANCE);
      expect(panelDelta, `${outcome} 문제판 높이·위치`).toBeLessThanOrEqual(TOLERANCE);
      expect(after.overflowY, `${outcome} 제출로 늘어난 세로 넘침`).toBeLessThanOrEqual(before.overflowY);
      for (const s of [before, after]) {
        expect(s.overflowY, `${outcome} 문서 세로 넘침`).toBeLessThanOrEqual(contentOver);
        expect(s.overflowX, `${outcome} 문서 가로 넘침`).toBeLessThanOrEqual(0);
      }
      // 같은 문제판 안 보기 네 개는 같은 크기다(PRD §12.5).
      for (const r of after.options) {
        expect(Math.abs(r.w - after.options[0]!.w)).toBeLessThanOrEqual(TOLERANCE);
        expect(Math.abs(r.h - after.options[0]!.h)).toBeLessThanOrEqual(TOLERANCE);
        expect(r.h).toBeGreaterThanOrEqual(defaults.layout.touchMinPx);
      }
      if (vp.mode === 'R') {
        const s = await seams(page);
        const seamDelta = Math.max(Math.abs(s.fieldRight + railGap - s.railLeft), Math.abs(s.railLeft - s.cardLeft), Math.abs(s.fieldRight - s.mainRight));
        report.push(`  수직선Δ=${seamDelta.toFixed(2)} (전장 ${s.fieldRight.toFixed(2)} 레일 ${s.railLeft.toFixed(2)} 카드 ${s.cardLeft.toFixed(2)})`);
        expect(seamDelta, '수직선').toBeLessThanOrEqual(TOLERANCE);
      }
      await advance(page, outcome);
    }
    test.info().annotations.push({ type: 'measure', description: report.join('\n') });
    console.log(`[layout ${vp.w}×${vp.h}]\n${report.join('\n')}`);
    expect(errors).toEqual([]);
  });
}

test('1366×650 크롬북: R 모드 압축 HUD는 두 줄이고, 가로로 넘치지 않는다', async ({ page }) => {
  await startGame(page, 1366, 650);
  const rail = page.getByRole('complementary', { name: '타워 관리' });
  const rows = await rail.evaluate(aside => {
    const hud = aside.firstElementChild!;
    const tops = new Set<number>();
    for (const row of hud.children) tops.add(Math.round(row.getBoundingClientRect().top));
    // 두 번째 줄(골드·점수·연속 정답) 칸이 한 줄에 나란히 있고 칸 안 글자가 줄바꿈되지 않는다.
    const cells = [...hud.children[1]!.children].map(c => ({ top: Math.round(c.getBoundingClientRect().top), wrapped: c.scrollHeight > c.clientHeight + 1 }));
    return { rowCount: hud.children.length, distinctTops: tops.size, cells, hudH: hud.getBoundingClientRect().height };
  });
  console.log(`[compact HUD 1366×650] ${JSON.stringify(rows)}`);
  expect(rows.rowCount).toBe(2);
  expect(rows.distinctTops).toBe(2);
  expect(rows.cells.length).toBeGreaterThanOrEqual(3);
  expect(new Set(rows.cells.map(c => c.top)).size).toBe(1);
  expect(rows.cells.every(c => !c.wrapped)).toBe(true);
  // 세로 넘침은 문제 글 길이에 따라 위 제출 전후 시험에서 잰다. 여기서는 HUD 두 줄이 가로로 넘치지 않는지만 본다.
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflowX).toBeLessThanOrEqual(0);
  const hudRight = await rail.evaluate(aside => aside.firstElementChild!.getBoundingClientRect().right - aside.getBoundingClientRect().right);
  expect(hudRight).toBeLessThanOrEqual(TOLERANCE);
});

test('제출 뒤 화면 회전(R 1024×690 ↔ S 820×1060)에서 보기 배치를 다시 재고, 돌아오면 같은 자리로 온다', async ({ page }) => {
  await startGame(page, 1024, 690);
  await waitForFreshQuestion(page);
  await submit(page, 'wrong');
  const r1 = await snapshot(page);

  await page.setViewportSize({ width: 820, height: 1060 });
  await expect(page.getByRole('complementary', { name: '타워 관리' })).toHaveCount(0);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const s = await page.evaluate(({ minCell, maxLines }) => {
    const group = document.querySelector('section[aria-label="어휘 문제"] [role="group"][aria-label="보기"]') as HTMLElement;
    const cols = group.getAttribute('data-cols');
    const texts = [...group.querySelectorAll<HTMLElement>('[data-option-text]')];
    const lineHeight = Number.parseFloat(getComputedStyle(texts[0]!).lineHeight);
    const buttons = [...group.querySelectorAll<HTMLElement>(':scope > button')];
    const gap = Number.parseFloat(getComputedStyle(group).columnGap) || 0;
    return {
      cols,
      cellOk: cols === '1' || (group.clientWidth - gap) / 2 >= minCell,
      // 굵은 글자(정답)까지 포함해 모든 보기 글자가 상자 안에 들어오고, 2열이면 2줄 이하다.
      textFits: buttons.every(b => b.scrollHeight <= b.clientHeight + 1),
      linesOk: cols === '1' || texts.every(t => t.scrollHeight <= Math.max(t.clientHeight, lineHeight * maxLines + 2)),
      sameSize: buttons.every(b => Math.abs(b.offsetHeight - buttons[0]!.offsetHeight) <= 0.5 && Math.abs(b.offsetWidth - buttons[0]!.offsetWidth) <= 0.5),
      overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  }, { minCell: defaults.layout.optionGrid.twoByTwoMinCellWidthPx, maxLines: defaults.layout.optionGrid.twoByTwoMaxLines });
  console.log(`[rotate] R=${r1.cols} → S=${JSON.stringify(s)}`);
  expect(s.cellOk).toBe(true);
  expect(s.textFits).toBe(true);
  expect(s.linesOk).toBe(true);
  expect(s.sameSize).toBe(true);
  expect(s.overflowX).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 1024, height: 690 });
  await expect(page.getByRole('complementary', { name: '타워 관리' })).toHaveCount(1);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const r2 = await snapshot(page);
  expect(r2.cols).toBe(r1.cols);
  expect(maxDelta(r1, r2)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(r2.panel.h - r1.panel.h)).toBeLessThanOrEqual(TOLERANCE);
});

test('모달 포커스: 열면 내용의 첫 요소, 키보드로 설정을 바꿔도 제자리, 닫으면 연 버튼으로 복귀', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const settingsBtn = page.locator('#settingsBtn');
  await settingsBtn.click();
  const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
  await expect(settingsDialog).toBeVisible();
  // R4 kit Modal: 첫 포커스는 머리줄의 닫기가 아니라 내용의 첫 조작 요소다(설정은 첫 줄 '전체 소리' switch).
  await expect(settingsDialog.getByRole('switch', { name: '전체 소리' })).toBeFocused();

  // 키보드로 항목을 바꿔 부모가 다시 렌더돼도(onClose가 새 함수) 포커스가 그 라디오에 남는다. 탭이 없으므로 같은 목록에서 바로 찾는다.
  const large = settingsDialog
    .getByRole('radiogroup', { name: '글자 크기', exact: true })
    .getByRole('radio', { name: '글자 크게', exact: true });
  await large.focus();
  await page.keyboard.press('Space');
  await expect(large).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-font', 'large');
  await expect(large).toBeFocused();
  // switch도 키보드(Space)로 바꾸고 포커스가 남는다.
  const contrast = settingsDialog.getByRole('switch', { name: '전장 길·받침 고대비 윤곽선' });
  await contrast.focus();
  const before = await contrast.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  await expect(contrast).not.toHaveAttribute('aria-checked', before!);
  await expect(contrast).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(settingsDialog).toHaveCount(0);
  await expect(settingsBtn).toBeFocused();

  const openRanking = page
    .getByRole('complementary', { name: '랭킹', exact: true })
    .getByRole('button', { name: '전체 보기' });
  await openRanking.click();
  const rankingDialog = page.getByRole('dialog', { name: /전체 랭킹/ });
  await expect(rankingDialog).toBeVisible();
  await expect(rankingDialog.getByRole('button', { name: '닫기' })).toBeFocused();
  await rankingDialog.getByRole('button', { name: '닫기' }).click();
  await expect(rankingDialog).toHaveCount(0);
  await expect(openRanking).toBeFocused();
});

test('전체 랭킹 탭: 방향키·Home·End가 선택과 포커스를 함께 옮긴다(roving tabindex)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page
    .getByRole('complementary', { name: '랭킹', exact: true })
    .getByRole('button', { name: '전체 보기' })
    .click();
  const dialog = page.getByRole('dialog', { name: /전체 랭킹/ });
  const tablist = dialog.getByRole('tablist', { name: '랭킹 분류' });
  const tabs = tablist.getByRole('tab');
  const count = await tabs.count();
  expect(count).toBeGreaterThanOrEqual(3);

  await expect(tablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0');
  await expect(tabs.first()).toHaveAttribute('tabindex', '-1');

  await page.keyboard.press('End');
  await expect(tabs.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(count - 1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.first()).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.nth(count - 1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.first()).toBeFocused();
});

test('새 게임 학년·난이도 radiogroup: 방향키가 선택과 포커스를 함께 옮긴다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('textbox', { name: '닉네임' }).fill('방향키검증');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 게임' });
  await expect(dialog).toBeVisible();

  const grades = dialog.getByRole('radiogroup', { name: '학년', exact: true });
  const radios = grades.getByRole('radio');
  const checked = grades.locator('[role="radio"][aria-checked="true"]');
  await expect(grades.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
  await checked.focus();
  const startIndex = await radios.evaluateAll(els => els.findIndex(el => el.getAttribute('aria-checked') === 'true'));
  // 공개 은행이 없는 학년은 꺼져 있고 방향키가 건너뛴다(PRD §9.3). 켜진 학년이 하나뿐이면 제자리에 남는다.
  const enabledCount = await radios.evaluateAll(els => els.filter(el => el.getAttribute('aria-disabled') !== 'true').length);
  await page.keyboard.press('ArrowRight');
  const nextIndex = await radios.evaluateAll(els => els.findIndex(el => el.getAttribute('aria-checked') === 'true'));
  await expect(radios.nth(nextIndex)).toBeEnabled();
  await expect(radios.nth(nextIndex)).toBeFocused();
  await expect(radios.nth(nextIndex)).toHaveAttribute('tabindex', '0');
  if (enabledCount > 1) {
    expect(nextIndex).not.toBe(startIndex);
    await expect(radios.nth(startIndex)).toHaveAttribute('tabindex', '-1');
  } else {
    expect(nextIndex).toBe(startIndex);
  }

  const diffs = dialog.getByRole('radiogroup', { name: '난이도', exact: true });
  await diffs.locator('[role="radio"][aria-checked="true"]').focus();
  await page.keyboard.press('Home');
  await expect(diffs.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
  await expect(diffs.getByRole('radio').first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(diffs.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(diffs.getByRole('radio').nth(1)).toBeFocused();
  await expect(diffs.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
});

/** 보이는 글자의 최소 계산 글자 크기와, 누르는 요소의 실제 누름 영역(elementFromPoint로 잰 가로·세로) 최소값. */
async function floors(page: Page, scope: string) {
  return page.evaluate(sel => {
    const root = document.querySelector(sel) ?? document.body;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.clipPath !== 'inset(50%)' && !el.closest('.sr-only, [aria-hidden="true"]');
    };
    let minFont = Infinity; let fontAt = '';
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el) || el.closest('svg, canvas')) continue;
      const hasText = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (!hasText) continue;
      const fs = Number.parseFloat(getComputedStyle(el).fontSize);
      if (fs < minFont) { minFont = fs; fontAt = `${el.tagName}.${el.className}:${el.textContent!.trim().slice(0, 12)}`; }
    }
    const hitSpan = (el: Element, axis: 'x' | 'y') => {
      // 화면 아래로 걸친 단추는 스크롤하면 다 누를 수 있다. 보이는 부분만 재지 않도록 먼저 화면 안으로 옮긴다.
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let lo = 0, hi = 0;
      const hit = (d: number) => {
        const t = axis === 'x' ? document.elementFromPoint(cx + d, cy) : document.elementFromPoint(cx, cy + d);
        return !!t && (t === el || el.contains(t));
      };
      while (lo < 60 && hit(-(lo + 1))) lo++;
      while (hi < 60 && hit(hi + 1)) hi++;
      return lo + hi + 1;
    };
    let minTouch = Infinity; let touchAt = '';
    for (const el of root.querySelectorAll('button, [role="tab"], [role="radio"], a[href], input, select, summary')) {
      if (!visible(el) || (el as HTMLButtonElement).disabled) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      if (!top || !(top === el || el.contains(top))) continue; // 다른 층에 가려진 요소(대화상자 뒤 배경)는 뺀다.
      const size = Math.min(hitSpan(el, 'x'), hitSpan(el, 'y'));
      if (size < minTouch) { minTouch = size; touchAt = `${el.tagName}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 12)}`; }
    }
    // 하한을 맞추느라 대화상자 안에 스크롤이 새로 생기거나 가로로 넘치지 않았는지 함께 본다.
    const scrollers = [...root.querySelectorAll<HTMLElement>('*')].filter(el => {
      const o = getComputedStyle(el).overflowY;
      return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    }).map(el => `${el.className}:${el.scrollHeight - el.clientHeight}`);
    return { minFont, fontAt, minTouch, touchAt, scrollers, overflowX: document.documentElement.scrollWidth - innerWidth };
  }, scope);
}

test('13px·44px 하한: 홈·새 게임·전체 랭킹·설정·사용 설명서(접힘·펼침)·오답 노트(1366×650)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 650 });
  await page.goto('/');
  const results: Record<string, Awaited<ReturnType<typeof floors>>> = {};
  results.home = await floors(page, 'body');

  await page.getByRole('textbox', { name: '닉네임' }).fill('하한검사');
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  results.newGame = await floors(page, '[role="dialog"]');
  await page.keyboard.press('Escape');

  await page.getByRole('complementary', { name: '랭킹', exact: true }).getByRole('button', { name: '전체 보기' }).click();
  results.ranking = await floors(page, '[role="dialog"]');
  await page.keyboard.press('Escape');

  await page.locator('#settingsBtn').click();
  results.settings = await floors(page, '[role="dialog"]');
  await page.keyboard.press('Escape');

  await page.locator('#guideBtn').click();
  const guide = page.getByRole('dialog', { name: '사용 설명서' });
  results.guide = await floors(page, '[role="dialog"]');
  // 탭 대신 카드의 '자세히'를 모두 펼친 상태에서도 글자·누름 하한을 지킨다.
  const more = guide.getByRole('button', { name: '자세히' });
  for (let i = 0; i < (await more.count()); i++) await more.nth(i).click();
  results.guideOpen = await floors(page, '[role="dialog"]');
  await page.keyboard.press('Escape');

  // 오답 노트(빈 상태): 홈의 '오답 노트' 단추로 들어간다.
  await page.getByRole('button', { name: '오답 노트' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '오답 노트' })).toBeVisible();
  results.note = await floors(page, 'body');

  console.log(`[floors] ${JSON.stringify(results, null, 1)}`);
  for (const [name, r] of Object.entries(results)) {
    expect(r.minFont, `${name} 최소 글자 ${r.fontAt}`).toBeGreaterThanOrEqual(13);
    expect(r.minTouch, `${name} 최소 누름 영역 ${r.touchAt}`).toBeGreaterThanOrEqual(defaults.layout.touchMinPx);
    expect(r.overflowX, `${name} 가로 넘침`).toBeLessThanOrEqual(0);
  }
});

// ── R1 전투 화면 리뉴얼 수용 시험(ui-rules-v2 §2·§3·§4). 위 WP-UI 실측과 같은 요구를 새 화면 구조(장착 홈·도구 묶음)에서 잰다.

async function newGame(page: Page) {
  await page.goto('/');
  await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.removeItem('vocabulary-td.coach'); });
  await page.reload();
  await page.getByRole('textbox', { name: '닉네임' }).fill('하늘바람');
  // 홈 '새 게임' → 새 게임 창의 '시작'.
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
}

const panel = (page: Page) => page.getByRole('region', { name: '어휘 문제' });
const options = (page: Page) => panel(page).getByRole('group', { name: '보기' }).getByRole('button');

async function boxes(page: Page) {
  return options(page).evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
}

const boxDelta = (a: number[][], b: number[][]) => Math.max(...a.flatMap((row, i) => row.map((v, j) => Math.abs(v - b[i]![j]!))));

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
  expect(boxDelta(before, after)).toBeLessThanOrEqual(0.5);
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
  await page.getByRole('listbox', { name: '타워 칸' }).getByRole('option', { name: /궁수탑/ }).click();
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
