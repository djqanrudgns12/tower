import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './tower-browser';

// 오답 노트(R4 L·U3, prd-r4 §6.1·§10.1·§10.2): 한 판을 끝내면 틀리거나 넘긴 낱말이 이 기기 노트에 담기고,
// 결과 화면의 '노트 보기'와 홈의 '오답 노트' 단추로 같은 노트 화면에 들어간다. 노트는 localStorage에만 있다.

const NOTE_EMPTY = '틀린 낱말이 여기 모여요';

async function freshHome(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.clear(); });
  await page.reload();
}

/** 새 판을 시작해 첫 준비 문제 화면까지 간다. */
async function startRun(page: Page, nickname: string) {
  await page.getByRole('textbox', { name: '닉네임' }).fill(nickname);
  await page.getByRole('button', { name: '새 게임', exact: true }).click();
  await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
}

/** 멈춤 창에서 '이번 판 끝내기 → 끝내기'를 눌러 결과 화면으로 간다(점수 기록 + 오답 노트 반영). */
async function endRun(page: Page) {
  await page.getByRole('button', { name: '일시정지' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '이번 판 끝내기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '끝내기', exact: true }).click();
  // 결과 화면의 첫 줄(틀린 낱말이 없으면 '틀린 낱말' 창은 아예 없으므로 결과 창 아래 '다시 하기'로 기다린다).
  await expect(page.getByRole('button', { name: '다시 하기' })).toBeVisible({ timeout: 15_000 });
}

/** 첫 준비 문제를 '모르겠어요'로 넘긴다. 정답 키와 해설이 열리고 그 낱말 하나가 노트에 담길 몫이 된다. */
async function skipFirstQuestion(page: Page) {
  const panel = page.getByRole('region', { name: '어휘 문제' });
  await panel.getByRole('button', { name: '모르겠어요' }).click();
  await expect(panel.locator('[data-explain]')).toBeVisible();
  await expect(panel.locator('[data-state="correct"]')).toHaveCount(1);
}

const noteStored = (page: Page) => page.evaluate(() => {
  const raw = localStorage.getItem('vocabulary-td.reviewNote.v1');
  return raw === null ? null : (JSON.parse(raw) as { items: Record<string, { lemma: string }> });
});

test('오답 노트가 비어 있으면: 홈 단추에 개수가 없고, 화면은 책 그림과 안내 두 줄이며, 뒤로·Esc로 홈에 돌아온다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await freshHome(page);

  // 개수 배지가 없는 단추: 이름이 '오답 노트' 그대로다.
  const noteBtn = page.getByRole('button', { name: '오답 노트', exact: true });
  await expect(noteBtn).toBeVisible();
  await expect(page.getByRole('button', { name: /오답 노트 \d+개/ })).toHaveCount(0);

  await noteBtn.click();
  const title = page.getByRole('heading', { level: 1, name: '오답 노트' });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  await expect(page.getByText(NOTE_EMPTY)).toBeVisible();
  // 빈 화면에는 개수 줄·졸업 안내·낱말 카드가 없다.
  await expect(page.getByText(/^낱말 \d+개$/)).toHaveCount(0);
  await expect(page.getByText('다른 판에서 2번 맞히면 졸업해요')).toHaveCount(0);
  await expect(page.getByRole('listitem')).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.screenshot({ path: 'test-results/shots/note-empty.png' });

  // O1: 양피지 공책이 lg(860×580) 고정 규격으로 바탕 한가운데에 정돈되어 놓인다.
  await expect(page.locator('img[src*="note.empty"]')).toBeVisible();
  const book = (await page.locator('main > div').first().boundingBox())!;
  expect(Math.round(book.width), '공책 대형 고정 폭').toBe(860);
  expect(Math.round(book.height), '공책 대형 고정 높이').toBe(580);
  expect(book.x, '공책 왼쪽 여백').toBeGreaterThanOrEqual(200);
  expect(book.y + book.height, '공책 아래쪽').toBeLessThanOrEqual(900);

  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '어휘력 타워 디펜스' })).toBeVisible();
  // Esc도 같은 뒤로다.
  await noteBtn.click();
  await expect(page.getByText(NOTE_EMPTY)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: '어휘력 타워 디펜스' })).toBeVisible();
  expect(await noteStored(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('한 판 끝내기 → 결과의 노트 줄과 노트 보기 → 오답 노트에 그 낱말 → 홈 단추에 개수 → 새로고침 뒤에도 남는다', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await freshHome(page);
  await startRun(page, '오답노트검증');
  await skipFirstQuestion(page);
  await endRun(page);

  // 결과: 넘긴 낱말 하나가 '틀린 낱말' 창에 있고, 노트 줄이 '새로 담은 낱말 1'과 '노트 보기'를 보인다.
  const words = page.locator('ul[data-content] > li');
  await expect(words).toHaveCount(1);
  const lemma = ((await words.first().getByRole('button').innerText()).split('\n')[0] ?? '').trim();
  expect(lemma.length).toBeGreaterThan(0);
  await expect(page.getByText('새로 담은 낱말 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/외운 낱말/)).toHaveCount(0);
  const openNote = page.getByRole('button', { name: '노트 보기' });
  await expect(openNote).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '홈', exact: true })).toBeVisible();
  // 낱말 카드는 눌러야 해설이 펼쳐진다.
  const wordBtn = words.first().getByRole('button');
  await expect(wordBtn).toHaveAttribute('aria-expanded', 'false');
  await wordBtn.click();
  await expect(wordBtn).toHaveAttribute('aria-expanded', 'true');
  await wordBtn.click();
  const resultAxe = await new AxeBuilder({ page }).analyze();
  expect(resultAxe.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.screenshot({ path: 'test-results/shots/result-with-note.png' });

  // R1: '이번 판 기록'은 접혀 있다가 누르면 푼 문제·모르겠어요·만난 낱말이 나온다(첫 문제를 넘겼으니 0·1·1개). 퍼센트·숙련도는 어디에도 없다.
  const log = page.getByRole('button', { name: '이번 판 기록' });
  await expect(log).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('푼 문제')).toBeHidden();
  await log.click();
  await expect(log).toHaveAttribute('aria-expanded', 'true');
  const logRow = (name: string) => page.locator('dl > div').filter({ hasText: name });
  await expect(logRow('푼 문제')).toContainText('0개');
  await expect(logRow('모르겠어요')).toContainText('1개');
  await expect(logRow('만난 낱말')).toContainText('1개');
  await expect(page.getByText(/%|퍼센트|정확도|숙련/)).toHaveCount(0);
  await log.click();
  await expect(log).toHaveAttribute('aria-expanded', 'false');
  // 틀린 문제가 있었으니 만점 칭찬은 없다.
  await expect(page.getByText('한 문제도 틀리지 않았어요')).toHaveCount(0);
  // R2: 웨이브 숫자는 올라간 끝에 화면 읽기용 값과 같아진다.
  const srWave = ((await page.locator('#resultWave .sr-only').textContent()) ?? '').match(/(\d+)웨이브/)![1];
  await expect(page.locator('#resultWave [aria-hidden="true"]')).toHaveText(`${srWave}웨이브`);

  // 노트는 이 기기 localStorage에 한 낱말로 담겼다.
  const stored = await noteStored(page);
  expect(Object.values(stored!.items).map(i => i.lemma)).toEqual([lemma]);

  // 노트 보기 → 오답 노트 화면에 3탭(전체 / 집중 복습 / 졸업 임박)과 그 낱말 카드가 있다(뜻 한 줄 + 졸업까지 ●○).
  await openNote.click();
  await expect(page.getByRole('heading', { level: 1, name: '오답 노트' })).toBeVisible();
  await expect(page.getByText(NOTE_EMPTY)).toHaveCount(0);
  await expect(page.getByText('낱말 1개', { exact: true })).toBeVisible();
  await expect(page.getByText('다른 판에서 2번 맞히면 졸업해요')).toBeVisible();
  const noteBook = page.locator('main > div').first();
  const noteBox0 = (await noteBook.boundingBox())!;
  expect(Math.round(noteBox0.width)).toBe(860);
  expect(Math.round(noteBox0.height)).toBe(580);

  const noteTabs = page.getByRole('tablist', { name: '복습 단계 분류' }).getByRole('tab');
  await expect(noteTabs).toHaveCount(3);
  const cards = page.getByRole('listitem');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(lemma);
  await expect(cards.first().getByRole('img', { name: '다른 판에서 0번 맞혔어요. 2번 더 맞히면 졸업해요' })).toBeVisible();

  // 탭 전환 시 창 크기가 0px도 흔들리지 않는다.
  await page.getByRole('tab', { name: /^집중 복습/ }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole('tab', { name: /^졸업 임박/ }).click();
  await expect(page.getByText('졸업 임박한 낱말이 없어요')).toBeVisible();
  const noteBoxEmptyTab = (await noteBook.boundingBox())!;
  expect(Math.abs(noteBoxEmptyTab.height - noteBox0.height), '노트 탭 전환 높이 고정').toBeLessThanOrEqual(0.5);
  await page.getByRole('tab', { name: /^전체/ }).click();

  const noteAxe = await new AxeBuilder({ page }).analyze();
  expect(noteAxe.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  await page.screenshot({ path: 'test-results/shots/note-with-word.png' });

  // 가로 넘침 0: 결과·노트 모두 휴대폰·초소형 화면에서도 옆으로 밀리지 않는다.
  for (const [w, h] of [[390, 844], [320, 568], [1366, 650]] as const) {
    await page.setViewportSize({ width: w, height: h });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${w}x${h} 노트 가로 넘침`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // 뒤로 → 결과 화면으로 돌아온다(노트 줄도 그대로).
  await page.getByRole('button', { name: '뒤로' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '틀린 낱말' })).toBeVisible();
  await expect(openNote).toBeVisible();
  for (const [w, h] of [[390, 844], [320, 568]] as const) {
    await page.setViewportSize({ width: w, height: h });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${w}x${h} 결과 가로 넘침`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // 홈 → '오답 노트' 단추에 개수가 붙는다. 누르면 같은 노트 화면이고, Esc로 홈에 돌아온다.
  await page.getByRole('button', { name: '홈', exact: true }).click();
  const homeNote = page.getByRole('button', { name: '오답 노트 1개' });
  await expect(homeNote).toBeVisible();
  await expect(homeNote).toContainText('1');
  await homeNote.click();
  await expect(page.getByRole('heading', { level: 1, name: '오답 노트' })).toBeVisible();
  await expect(page.getByRole('listitem').first()).toContainText(lemma);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: '어휘력 타워 디펜스' })).toBeVisible();

  // 새로고침해도 노트(개수)는 그대로다.
  await page.reload();
  await expect(page.getByRole('button', { name: '오답 노트 1개' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('틀린 낱말이 없으면 결과에 노트 줄이 없고, 홈의 오답 노트도 비어 있다', async ({ page }) => {
  test.setTimeout(120_000);
  await freshHome(page);
  await startRun(page, '무오답검증');
  await endRun(page);

  // 낱말 창은 틀린 낱말이 있을 때만 있다: 없으면 창도 빈 안내 문장도 그리지 않는다. '이번 판 기록' 접기는 결과 창에 늘 있다.
  await expect(page.getByRole('heading', { level: 2, name: '틀린 낱말' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이번 판 기록' })).toBeVisible();
  await expect(page.getByText('틀리거나 넘긴 낱말이 없어요')).toHaveCount(0);
  await expect(page.getByText(/새로 담은 낱말|외운 낱말/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '노트 보기' })).toHaveCount(0);

  await page.getByRole('button', { name: '홈', exact: true }).click();
  await expect(page.getByRole('button', { name: '오답 노트', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /오답 노트 \d+개/ })).toHaveCount(0);
});

/** 한 낱말을 노트에 담은 채로 홈에 와서 설정의 '이 기기 기록 지우기'를 끝까지 누른 뒤, 설정을 닫는다. */
async function clearHistoryFromSettings(page: Page, nickname: string) {
  await startRun(page, nickname);
  await skipFirstQuestion(page);
  await endRun(page);
  await page.getByRole('button', { name: '홈', exact: true }).click();
  await expect(page.getByRole('button', { name: '오답 노트 1개' })).toBeVisible();

  await page.getByRole('button', { name: '설정' }).click();
  const dialog = page.getByRole('dialog', { name: '환경설정' });
  await dialog.getByRole('tab', { name: '기록 관리' }).click();
  await dialog.getByRole('button', { name: '지우기' }).click();
  await dialog.getByRole('button', { name: '정말 지우기' }).click();
  await expect(dialog.getByText('이 기기의 기록을 모두 지웠어요')).toBeVisible();
  expect(await noteStored(page)).toBeNull();
  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(dialog).toHaveCount(0);
}

test('설정의 ‘이 기기 기록 지우기’는 오답 노트도 지운다: 저장이 사라지고 노트 화면은 빈 상태가 된다', async ({ page }) => {
  test.setTimeout(180_000);
  await freshHome(page);
  await clearHistoryFromSettings(page, '기록지우기검증');
  // 홈 단추의 개수 표시는 아래 별도 시험에서 본다. 여기서는 단추 이름의 개수와 상관없이 노트 화면 자체가 비었는지만 본다.
  await page.getByRole('button', { name: /^오답 노트/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '오답 노트' })).toBeVisible();
  await expect(page.getByText(NOTE_EMPTY)).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('설정에서 기록을 지우고 닫으면 홈 ‘오답 노트’ 단추의 개수도 바로 사라진다', async ({ page }) => {
  test.setTimeout(180_000);
  await freshHome(page);
  await clearHistoryFromSettings(page, '개수갱신검증');
  await expect(page.getByRole('button', { name: '오답 노트', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /오답 노트 \d+개/ })).toHaveCount(0);
});

test('R2 움직임 줄이기: 결과의 웨이브 숫자는 올라가지 않고 투명도로만 나타난다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await freshHome(page);
  await startRun(page, '움직임검증');
  await endRun(page);

  const num = page.locator('#resultWave [aria-hidden="true"]');
  const srWave = ((await page.locator('#resultWave .sr-only').textContent()) ?? '').match(/(\d+)웨이브/)![1];
  // 처음부터 끝 값이고(올라가기 없음), 위치·크기 움직임은 없이 투명도 애니메이션만 걸린다.
  await expect(num).toHaveText(`${srWave}웨이브`);
  expect(await num.getAttribute('data-still')).not.toBeNull();
  const kinds = await page.evaluate(() => document.getAnimations().map(a => (a as CSSAnimation).animationName));
  expect(kinds.filter(n => n === 'resultPop')).toEqual([]);
  expect(await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length)).toBe(0);
});
