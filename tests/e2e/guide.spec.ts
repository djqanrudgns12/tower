import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// 사용 설명서 창(R4 그림 카드판). R5 P0에서 home.spec.ts에서 떼어 냈다: 설명서는 트랙 B가 고치므로 시험 파일 소유를 나눈다(docs/renewal/prd-r5-oak-v2.md §7.1).
test.describe('사용 설명서', () => {
  test('G01~G16: 사용 설명서 그림 카드 4장+상성 카드·자세히 펼침(키보드 포함)·실자산 그림·크롬북 창 안착·§12.8·axe 전수 검증', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const guideTrigger = page.getByRole('button', { name: '사용 설명서', exact: true });
    await guideTrigger.click();

    const dialog = page.getByRole('dialog', { name: '사용 설명서' });
    await expect(dialog).toBeVisible();

    // G01 & G02: 옛 쪽 넘김(이전 장·다음 장·목차 탭)과 '연습 판 해 보기'·'처음으로'는 없다. 그림 카드 4장 + 타워 상성 카드 1장이 한 화면에 모두 있다.
    await expect(dialog.getByRole('button', { name: '연습 판 해 보기' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '처음으로' })).toHaveCount(0);
    await expect(dialog.getByRole('tab')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /이전 장|다음 장/ })).toHaveCount(0);
    const cards = dialog.locator('article');
    await expect(cards).toHaveCount(5);
    const titles = ['한 판 흐름', '문제와 골드', '타워 놓기와 진화', '시작과 끝내기', '타워 상성'];
    for (const [i, title] of titles.entries()) {
      await expect(cards.nth(i).getByRole('heading', { level: 3, name: title })).toBeVisible();
    }
    // 카드마다 한 문장. 자세한 글은 '자세히'를 누르기 전까지 접혀 있다.
    await expect(cards.nth(0)).toContainText('문제를 풀고 타워로 성문을 지켜요');
    await expect(cards.nth(1)).toContainText('맞히면 골드, 모르면 뜻을 배워요');
    await expect(cards.nth(2)).toContainText('타워를 놓고 키워서 진화시켜요');
    await expect(cards.nth(3)).toContainText('학년·난이도를 고르고, 끝나면 기록돼요');
    await expect(cards.nth(4)).toContainText('하늘 적은 하늘을 쏘는 타워로');
    const more = dialog.getByRole('button', { name: '자세히' });
    await expect(more).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(more.nth(i)).toHaveAttribute('aria-expanded', 'false');

    // 그림 4장은 실제 삽화가 로드되고, 상성 카드에는 적 특성 아이콘 3줄이 있다.
    const pictures = dialog.locator('article img[alt]:not([alt=""])');
    await expect(pictures).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect.poll(() => pictures.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    }
    await expect(cards.nth(4).getByRole('listitem')).toHaveCount(3);
    for (const enemy of ['하늘 적', '단단한 적', '떼로 오는 적']) await expect(cards.nth(4)).toContainText(enemy);
    const axeClosed = await new AxeBuilder({ page }).analyze();
    expect(axeClosed.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/guide-cards-desktop.png' });

    // G07·G08: 키보드로 펼친다. Enter로 펼치고 Space로 접으며, 펼침 영역은 단추의 aria-controls가 가리키는 칸이다. 카드마다 따로 펼쳐진다.
    await more.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(more.nth(1)).toHaveAttribute('aria-expanded', 'true');
    const panelId = await more.nth(1).getAttribute('aria-controls');
    const quizDetail = dialog.locator(`[id="${panelId}"]`);
    await expect(quizDetail).toBeVisible();
    await expect(quizDetail).toContainText('모르겠어요');
    await expect(quizDetail).toContainText('연속 정답 보너스');
    await expect(more.nth(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(more.nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(more.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(quizDetail).toBeHidden();

    // 나머지 카드의 자세한 글(옛 1~4장 본문)을 모두 펼쳐 읽을 수 있다.
    for (let i = 0; i < 5; i++) await more.nth(i).click();
    for (let i = 0; i < 5; i++) await expect(more.nth(i)).toHaveAttribute('aria-expanded', 'true');
    await expect(cards.nth(0)).toContainText('준비 문제');
    await expect(cards.nth(0)).toContainText('성문 회복과 보스');
    await expect(cards.nth(2)).toContainText('사거리 원과 밝은 흙길');
    await expect(cards.nth(2)).toContainText(/\d+% 환급 판매/);
    await expect(cards.nth(3)).toContainText('속담·관용구·방언');
    await expect(cards.nth(3)).toContainText('이번 판 끝내기');
    // G03: 이어하기 없음(PRD §14.1: 끝내야 기록, 창을 닫으면 사라짐)과 첫 연습 판(§12.2) 안내가 있다.
    await expect(cards.nth(3)).toContainText('창을 닫으면 그 판은 사라져요');
    await expect(cards.nth(3)).toContainText('연습 판');
    await expect(cards.nth(3)).toContainText('숫자키 1~4');
    // 상성 카드는 적 특성마다 상대하기 좋은 타워를 보인다.
    await expect(cards.nth(4).locator('li strong')).toHaveCount(3);
    const axeOpen = await new AxeBuilder({ page }).analyze();
    expect(axeOpen.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/guide-cards-open-desktop.png' });

    // G14: PRD §12.8 스타일 전수 검사 (그라데이션 0, 블러 0, 허용 반경 0/8/14/999px만 사용: ui-rules-v3 §2 --r-sm·--r-md·배지)
    const guideStyleIssues = await dialog.evaluate(root => {
      const allowedRadii = new Set(['0px', '8px', '14px', '999px']);
      const issues: string[] = [];
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const cs = getComputedStyle(el);
        if (cs.backgroundImage !== 'none' && cs.backgroundImage.includes('gradient')) {
          issues.push(`gradient on ${el.tagName}.${el.className}`);
        }
        const bf = cs.getPropertyValue('backdrop-filter') || cs.getPropertyValue('-webkit-backdrop-filter');
        if (bf && bf !== 'none') {
          issues.push(`backdrop-filter on ${el.tagName}.${el.className}`);
        }
        if (!allowedRadii.has(cs.borderTopLeftRadius)) {
          issues.push(`radius ${cs.borderTopLeftRadius} on ${el.tagName}.${el.className}`);
        }
      }
      return issues;
    });
    expect(guideStyleIssues).toEqual([]);

    // G12: 학교 크롬북(1366×650) 저높이 뷰포트에서도 창이 화면 안에 들어오고, 카드 안은 가로로 넘치지 않으며 마지막 카드까지 스크롤로 닿는다.
    await page.setViewportSize({ width: 1366, height: 650 });
    const fit = await dialog.evaluate(root => {
      const r = root.getBoundingClientRect();
      const wide = [root, ...root.querySelectorAll<HTMLElement>('*')].filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible');
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, hOverflow: wide.length };
    });
    expect(fit.top, '1366x650 창 위쪽이 화면 안').toBeGreaterThanOrEqual(0);
    expect(fit.bottom, '1366x650 창 아래쪽이 화면 안').toBeLessThanOrEqual(650);
    expect(fit.hOverflow, '1366x650 창 안 가로 넘침').toBe(0);
    await cards.nth(4).scrollIntoViewIfNeeded();
    await expect(cards.nth(4)).toBeInViewport();
    await page.screenshot({ path: 'test-results/shots/guide-cards-chromebook.png' });

    // G13: 모바일(390×844)·초소형(320×568) 및 글자 아주 크게(xlarge) 가로 넘침 0px 검증
    await page.evaluate(() => { document.documentElement.dataset.font = 'xlarge'; });
    for (const [w, h] of [[390, 844], [320, 568]] as const) {
      await page.setViewportSize({ width: w, height: h });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${w}x${h} xlarge overflow`).toBeLessThanOrEqual(0);
      const boxRight = await dialog.evaluate(root => root.getBoundingClientRect().right);
      expect(boxRight, `${w}x${h} xlarge 창 오른쪽이 화면 안`).toBeLessThanOrEqual(w);
      if (w === 390) {
        await page.screenshot({ path: 'test-results/shots/guide-cards-mobile.png' });
      }
    }
    await page.evaluate(() => { document.documentElement.dataset.font = 'base'; });

    // G08: Escape 입력 시 모달이 닫히고 홈 상단 '사용 설명서' 버튼으로 포커스가 복귀한다.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(guideTrigger).toBeFocused();

    // G11: 설명서에서 무대 캔버스를 걷어 냈다(U3). 배경 움직임 '정지'·고대비 윤곽선을 켜도 설명서는 캔버스 없이 같은 카드만 보인다.
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await settingsDialog.getByRole('radiogroup', { name: '배경 움직임 단계' }).getByRole('radio', { name: '정지' }).click();
    await settingsDialog.getByRole('switch', { name: '전장 길·받침 고대비 윤곽선' }).click();
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    await guideTrigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('canvas')).toHaveCount(0);
    await expect(dialog.locator('article')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
