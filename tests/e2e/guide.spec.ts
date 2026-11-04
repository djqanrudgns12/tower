import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// 사용 설명서 창(R5 G1~G9: 그림 카드 목차 → 장 화면). R5 P0에서 home.spec.ts에서 떼어 냈다(트랙 B 소유, docs/renewal/prd-r5-oak-v2.md §7.1).

const CHAPTERS = ['한 판 흐름', '문제와 골드', '타워 놓기와 진화', '시작과 끝내기', '새 타워와 적 특성'] as const;

async function openGuide(page: Page) {
  await page.getByRole('button', { name: '사용 설명서', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '사용 설명서' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** 목차 카드(장 5장 + 타워 상성). */
const tocCards = (dialog: Locator) => dialog.getByRole('navigation', { name: '사용 설명서 목차' }).getByRole('button');
const chapterHead = (dialog: Locator, n: number) => dialog.getByRole('heading', { level: 3, name: `제${n}장 · ${CHAPTERS[n - 1]}` });

async function openChapter(dialog: Locator, n: number) {
  await tocCards(dialog).nth(n - 1).click();
  await expect(chapterHead(dialog, n)).toBeVisible();
}

/** 그라데이션·블러 0, 허용 반경만(ui-rules-v4 총괄 결정 2: 0/4/8/999px). */
function styleIssues(dialog: Locator) {
  return dialog.evaluate(root => {
    const allowedRadii = new Set(['0px', '4px', '8px', '999px']);
    const issues: string[] = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage !== 'none' && cs.backgroundImage.includes('gradient')) issues.push(`gradient on ${el.tagName}.${el.className}`);
      const bf = cs.getPropertyValue('backdrop-filter') || cs.getPropertyValue('-webkit-backdrop-filter');
      if (bf && bf !== 'none') issues.push(`backdrop-filter on ${el.tagName}.${el.className}`);
      if (cs.filter.includes('blur')) issues.push(`blur on ${el.tagName}.${el.className}`);
      if (cs.textShadow !== 'none') issues.push(`text-shadow on ${el.tagName}.${el.className}`);
      if (!allowedRadii.has(cs.borderTopLeftRadius)) issues.push(`radius ${cs.borderTopLeftRadius} on ${el.tagName}.${el.className}`);
    }
    return issues;
  });
}

/** 창 안 넘침·13px·44px 하한: 세로·가로 스크롤 여부, 13px 미만 글, 44px 미만 누름 칸. */
function fitAudit(dialog: Locator) {
  return dialog.evaluate(root => {
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
    const small: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      if (!visible(el) || el.closest('.sr-only')) continue;
      const own = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');
      if (own && parseFloat(getComputedStyle(el).fontSize) < 13) small.push(`${el.tagName} "${el.textContent!.trim().slice(0, 12)}" ${getComputedStyle(el).fontSize}`);
    }
    const tiny = [...root.querySelectorAll<HTMLElement>('button, [role="radio"]')]
      .filter(visible)
      .map(el => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ el, r }) => `${el.getAttribute('aria-label') ?? el.textContent!.trim().slice(0, 12)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    const wide = [root, ...root.querySelectorAll<HTMLElement>('*')].filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible' && !el.classList.contains('sr-only'));
    const r = root.getBoundingClientRect();
    return { vScroll: root.scrollHeight - root.clientHeight, hOverflow: wide.length, small, tiny, top: r.top, bottom: r.bottom, right: r.right };
  });
}

async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.map(v => `${v.id}: ${v.nodes.length}`);
}

test.describe('사용 설명서', () => {
  test('G1·G8: 그림 카드 목차(장 5 + 상성) → 장 화면(머리띠·시연·요약 3행·쪽 넘김), ←→·Home·End, 포커스 복귀, axe·스타일 전수', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const guideTrigger = page.getByRole('button', { name: '사용 설명서', exact: true });
    const dialog = await openGuide(page);

    // 목차: 옛 탭·'연습 판 해 보기'·'처음으로'는 없고, 장 카드 5장 + 타워 상성 카드 1장(카드 전체가 버튼)이다.
    await expect(dialog.getByRole('tab')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '연습 판 해 보기' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '처음으로' })).toHaveCount(0);
    const cards = tocCards(dialog);
    await expect(cards).toHaveCount(6);
    for (const [i, title] of CHAPTERS.entries()) {
      await expect(cards.nth(i)).toContainText(title);
      await expect(cards.nth(i)).toContainText('자세히');
      await expect(cards.nth(i)).toHaveAccessibleName(new RegExp(`^제${i + 1}장 ${title}`));
    }
    await expect(cards.nth(0)).toContainText('문제를 풀고 타워로 성문을 지켜요');
    await expect(cards.nth(1)).toContainText('맞히면 골드, 모르면 뜻을 배워요');
    await expect(cards.nth(5)).toContainText('타워 상성');
    await expect(cards.nth(5)).toContainText('적 특성마다 잘 잡는 타워가 있어요');
    // 첫 포커스는 내용의 첫 카드다(R4 규칙).
    await expect(cards.nth(0)).toBeFocused();
    // 1~4장은 실제 삽화가 로드되고, 5장은 그림이 오기 전 자리(원화 아이콘)만 있다. 상성 카드에는 적 특성 아이콘 8개.
    const pictures = cards.locator('img[src*="assets/guide/"]');
    await expect(pictures).toHaveCount(4);
    for (let i = 0; i < 4; i++) await expect.poll(() => pictures.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    await expect(cards.nth(4).locator('[data-placeholder]')).toHaveCount(1);
    await expect(cards.nth(5).locator('img[src*="trait."]')).toHaveCount(8);
    expect(await axe(page)).toEqual([]);
    expect(await styleIssues(dialog)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/guide-toc-desktop.png' });

    // 키보드로 1장을 연다: 장 머리띠로 포커스가 가고, 머리띠·요지·요약 3행(아이콘·단계 배지)·쪽 넘김이 있다.
    await page.keyboard.press('Enter');
    const head1 = chapterHead(dialog, 1);
    await expect(head1).toBeFocused();
    const section = dialog.locator('section[data-chapter]');
    await expect(section).toContainText('문제로 골드를 모아 타워를 세우고, 성문을 끝까지 지켜요');
    const rows = section.getByRole('list', { name: '한 판 흐름 요약' }).getByRole('listitem');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('1단계');
    await expect(rows.nth(0)).toContainText('준비 문제');
    await expect(rows.nth(2)).toContainText('성문 회복과 보스');
    const pager = dialog.getByRole('navigation', { name: '장 넘기기' });
    const prev = pager.getByRole('button', { name: '이전 장' });
    const next = pager.getByRole('button', { name: '다음 장' });
    await expect(prev).toBeDisabled();
    await expect(pager).toContainText('1 / 5');
    expect(await axe(page)).toEqual([]);
    expect(await styleIssues(dialog)).toEqual([]);

    // ←→·Home·End는 장 화면에서 장을 넘긴다. 고르기 줄 안의 방향키는 그 줄이 쓴다(장이 넘어가지 않음).
    await page.keyboard.press('ArrowRight');
    await expect(chapterHead(dialog, 2)).toBeVisible();
    await expect(pager).toContainText('2 / 5');
    await page.keyboard.press('End');
    await expect(chapterHead(dialog, 5)).toBeVisible();
    await expect(next).toBeDisabled();
    await page.keyboard.press('Home');
    await expect(chapterHead(dialog, 1)).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(chapterHead(dialog, 1)).toBeVisible();
    const beats = dialog.getByRole('radiogroup', { name: '한 판 단계 시연' });
    await beats.getByRole('radio', { name: '2. 설치' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(beats.getByRole('radio', { name: '3. 전투' })).toBeChecked();
    await expect(chapterHead(dialog, 1)).toBeVisible();

    // 단추로 넘기고, 경계에서 단추가 꺼지면 포커스는 머리띠로 간다. 모든 장이 axe·스타일 검사를 통과한다.
    await next.click();
    for (let n = 2; n <= 5; n++) {
      await expect(chapterHead(dialog, n)).toBeVisible();
      await expect(pager).toContainText(`${n} / 5`);
      expect(await axe(page), `${n}장 axe`).toEqual([]);
      expect(await styleIssues(dialog), `${n}장 스타일`).toEqual([]);
      if (n < 5) await next.click();
    }
    await expect(next).toBeDisabled();
    await expect(chapterHead(dialog, 5)).toBeFocused();

    // 목차로 돌아오면 지금 장(5장)의 카드로 포커스가 돌아간다. 상성 카드는 5장을 열고, 돌아오면 상성 카드로 간다.
    await pager.getByRole('button', { name: '목차' }).click();
    await expect(cards.nth(4)).toBeFocused();
    await cards.nth(5).click();
    await expect(chapterHead(dialog, 5)).toBeFocused();
    await pager.getByRole('button', { name: '목차' }).click();
    await expect(cards.nth(5)).toBeFocused();

    // Esc로 창이 닫히고 홈 '사용 설명서' 단추로 포커스가 돌아간다.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(guideTrigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('G2~G7: 장 시연 — 수비 캔버스 4박, 결과별 골드·점수, 시작 타워 사거리, 난이도 판독·숫자키, 적 특성 상성', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const dialog = await openGuide(page);

    // G2: 1장 — 그림 수비 캔버스(움직임 '전체'에서 돈다), 4박 고정 칸, 정답 +N골드 배지.
    await openChapter(dialog, 1);
    const stage = dialog.locator('[data-chapter="1"] canvas');
    await expect(stage).toHaveCount(1);
    await expect(stage).toHaveAttribute('data-animate', 'true');
    const beats = dialog.getByRole('radiogroup', { name: '한 판 단계 시연' });
    await expect(beats.getByRole('radio')).toHaveCount(4);
    await beats.getByRole('radio', { name: '1. 준비' }).click();
    await expect(dialog.locator('section')).toContainText('정답 +19골드');
    await beats.getByRole('radio', { name: '4. 회복' }).click();
    await expect(dialog.locator('section')).toContainText('성문 15/15 회복');
    // 무한 반복은 이 캔버스 하나뿐이다(CSS 무한 애니메이션 0).
    expect(await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getTiming().iterations === Infinity && a.playState === 'running').length)).toBe(0);
    await page.screenshot({ path: 'test-results/shots/guide-ch1-desktop.png' });

    // G3: 2장 — 결과를 고르면 골드·점수·성문 메모가 바뀐다. 연속 정답은 보너스 골드와 2단 속도를 보인다.
    await dialog.getByRole('button', { name: '다음 장' }).click();
    const outcomes = dialog.getByRole('radiogroup', { name: '문제 결과별 변화' });
    const hud = dialog.locator('[data-outcome]');
    // 아무것도 고르지 않으면 2.4초마다 다음 결과로 넘어간다.
    await expect(outcomes.getByRole('radio', { name: '정답', exact: true })).toBeChecked();
    await expect(outcomes.getByRole('radio', { name: '오답' })).toBeChecked({ timeout: 4000 });
    await outcomes.getByRole('radio', { name: '모르겠어요' }).click();
    await expect(hud).toContainText('0골드');
    await expect(hud).toContainText('0점');
    await expect(hud).toContainText('감점 없음');
    await outcomes.getByRole('radio', { name: '3연속 정답' }).click();
    await expect(hud).toContainText('+25골드(보너스 +6)');
    await expect(hud).toContainText('12초 동안 +25%');
    await expect(hud).toContainText('6연속이면 +40%');
    await page.waitForTimeout(2600);
    await expect(outcomes.getByRole('radio', { name: '3연속 정답' }), '고른 뒤에는 순환을 멈춘다').toBeChecked();

    // G4: 3장 — 시작 4종의 비용·사거리 배지와 두 갈래 진화.
    await dialog.getByRole('button', { name: '다음 장' }).click();
    const towers = dialog.getByRole('radiogroup', { name: '시작 타워 사거리와 진화' });
    await expect(towers.getByRole('radio')).toHaveCount(4);
    await towers.getByRole('radio', { name: '포탑' }).click();
    await expect(dialog.locator('section')).toContainText('포탑 · 100골드');
    await expect(dialog.locator('section')).toContainText('사거리 2.4칸');
    await expect(dialog.locator('section')).toContainText('동그라미 길 · 확산');
    await expect(dialog.locator('section')).toContainText('마름모 길 · 중포');

    // G5: 4장 — 난이도 판독 한 줄(새 게임 창과 같은 함수)과 실제 숫자키에 눌리는 1~4 키.
    await dialog.getByRole('button', { name: '다음 장' }).click();
    const readout = dialog.locator('[data-readout]');
    await expect(readout).toHaveText(/성문 15.*정답 \+19골드부터.*교과 표준 낱말/);
    await dialog.getByRole('radiogroup', { name: '난이도별 성문·골드·낱말 범위' }).getByRole('radio', { name: '어려움', exact: true }).click();
    await expect(readout).toHaveText(/성문 10.*정답 \+22골드부터.*교과 낱말 \+ 속담·관용구·방언/);
    const keys = dialog.getByRole('group', { name: '보기 단축키' });
    await page.keyboard.press('3');
    await expect(keys.getByRole('button', { name: /^3\s?번 보기$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(keys.getByRole('button', { name: /^1\s?번 보기$/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(dialog.locator('section')).toContainText('보기 3번 고르기');

    // G7: 5장 — 적 특성 아이콘 8개를 고르면 계약 strongVs의 타워가 보인다.
    await dialog.getByRole('button', { name: '다음 장' }).click();
    const traits = dialog.getByRole('radiogroup', { name: '적 특성' });
    await expect(traits.getByRole('radio')).toHaveCount(8);
    const counter = dialog.locator('[data-counter]');
    await expect(counter).toContainText('나는 적');
    for (const t of ['거대노포', '매사냥대', '바람개비탑']) await expect(counter).toContainText(t);
    await traits.getByRole('radio', { name: '단단한 적' }).click();
    await expect(counter).toContainText('석궁탑');
    await expect(counter).toContainText('마법탑');
    await expect(dialog.locator('section')).toContainText('3·6·9·12웨이브');
    await expect(dialog.locator('section')).toContainText('3초 안에는 되돌려');
    expect(errors).toEqual([]);
  });

  test('G12: 크롬북 1366×650 — 목차와 장 화면 5장이 글자 크기 3단계 모두 스크롤 없이 들어가고, 13px·44px 하한을 지킨다', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 650 });
    await page.goto('/');
    for (const font of ['base', 'large', 'xlarge'] as const) {
      await page.evaluate(f => { document.documentElement.dataset.font = f; }, font);
      const dialog = await openGuide(page);
      const toc = await fitAudit(dialog);
      expect(toc.top, `${font} 목차 창 위쪽`).toBeGreaterThanOrEqual(0);
      expect(toc.bottom, `${font} 목차 창 아래쪽`).toBeLessThanOrEqual(650);
      expect(toc.hOverflow, `${font} 목차 가로 넘침`).toBe(0);
      expect(toc.small, `${font} 목차 13px 미만`).toEqual([]);
      expect(toc.tiny, `${font} 목차 44px 미만`).toEqual([]);
      await openChapter(dialog, 1);
      for (let n = 1; n <= 5; n++) {
        await expect(chapterHead(dialog, n)).toBeVisible();
        const fit = await fitAudit(dialog);
        expect(fit.vScroll, `${font} ${n}장 세로 스크롤`).toBeLessThanOrEqual(0);
        expect(fit.hOverflow, `${font} ${n}장 가로 넘침`).toBe(0);
        expect(fit.bottom, `${font} ${n}장 창 아래쪽`).toBeLessThanOrEqual(650);
        expect(fit.small, `${font} ${n}장 13px 미만`).toEqual([]);
        expect(fit.tiny, `${font} ${n}장 44px 미만`).toEqual([]);
        if (font === 'xlarge') await page.screenshot({ path: `test-results/shots/guide-ch${n}-chromebook-xlarge.png` });
        if (n < 5) await dialog.getByRole('button', { name: '다음 장' }).click();
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });

  test('G13: 휴대폰 390×844·초소형 320×568 글자 아주 크게 — 목차·장 화면 가로 넘침 0', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { document.documentElement.dataset.font = 'xlarge'; });
    for (const [w, h] of [[390, 844], [320, 568]] as const) {
      await page.setViewportSize({ width: w, height: h });
      const dialog = await openGuide(page);
      const views = ['목차', ...CHAPTERS.map((_, i) => `${i + 1}장`)];
      for (const [i, view] of views.entries()) {
        if (i === 1) await openChapter(dialog, 1);
        else if (i > 1) await dialog.getByRole('button', { name: '다음 장' }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${w}x${h} ${view} 문서 가로 넘침`).toBeLessThanOrEqual(0);
        const fit = await fitAudit(dialog);
        expect(fit.right, `${w}x${h} ${view} 창 오른쪽`).toBeLessThanOrEqual(w);
        expect(fit.hOverflow, `${w}x${h} ${view} 창 안 가로 넘침`).toBe(0);
        if (w === 390 && i <= 1) await page.screenshot({ path: `test-results/shots/guide-${i ? 'ch1' : 'toc'}-mobile.png` });
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });

  test('G10·G11: 움직임 줄이기(OS·설정 정지)에서 시연이 멈추고, 고대비 윤곽선 설정이 캔버스에 닿는다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    let dialog = await openGuide(page);
    await openChapter(dialog, 1);
    await expect(dialog.locator('canvas')).toHaveAttribute('data-animate', 'false');
    await dialog.getByRole('button', { name: '다음 장' }).click();
    const outcomes = dialog.getByRole('radiogroup', { name: '문제 결과별 변화' });
    const shown = await outcomes.getByRole('radio', { checked: true }).textContent();
    await page.waitForTimeout(2800);
    await expect(outcomes.getByRole('radio', { checked: true }), '움직임 줄이기에서는 결과 순환이 멈춘다').toHaveText(shown!);
    expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length)).toBe(0);
    await page.keyboard.press('Escape');

    // 설정 '정지' + 고대비(OS는 보통으로 돌려 설정만으로 멈추는지 본다).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: '설정' }).click();
    const settings = page.getByRole('dialog', { name: '환경설정' });
    await settings.getByRole('radiogroup', { name: '배경 움직임 단계' }).getByRole('radio', { name: '정지' }).click();
    await settings.getByRole('switch', { name: '전장 길·받침 고대비 윤곽선' }).click();
    await settings.getByRole('button', { name: '닫기' }).click();
    dialog = await openGuide(page);
    await openChapter(dialog, 1);
    const canvas = dialog.locator('canvas');
    await expect(canvas).toHaveAttribute('data-animate', 'false');
    await expect(canvas).toHaveAttribute('data-contrast', 'true');
    await dialog.getByRole('button', { name: '다음 장' }).click();
    await dialog.getByRole('button', { name: '다음 장' }).click();
    await expect(dialog.locator('canvas')).toHaveAttribute('data-contrast', 'true');
  });
});
