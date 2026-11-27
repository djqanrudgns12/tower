import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from './tower-browser';

/** 서로 다른 닉네임 count개의 3학년·보통 기록을 이 기기 IndexedDB에 심는다(로컬 랭킹은 닉네임마다 한 줄이라 줄 수 = 닉네임 수). */
async function seedRecords(page: Page, count: number, season: 1 | 2 = 2) {
  await page.evaluate(async ({ count, season }) => {
    const req = indexedDB.open('vocabulary-td');
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        for (let i = 0; i < count; i++) {
          store.put({
            runId: `00000000-0000-4000-8000-${String(season * 1000 + i).padStart(12, '0')}`,
            nickname: i === 13 ? '하하호호' : `시즌${season}도전자${String(i + 1).padStart(3, '0')}`,
            grade: 3,
            difficulty: 'Normal',
            mapId: 'garden_u',
            pt: 25000 - i * 150,
            completedWave: Math.max(1, 20 - (i % 15)),
            endedAtWave: Math.max(2, 21 - (i % 15)),
            correct: 30,
            wrong: 3,
            skipped: 1,
            endedAt: new Date(Date.now() - i * 3600_000).toISOString(),
            endReason: 'DEFEAT',
            contentMode: 'published',
            balanceVersion: `${season}.0.0`,
            bankVersion: 'pub-test',
          });
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, { count, season });
}

test.describe('v3 홈 화면 통합 검증', () => {
  test('1-Click 시작 · 닉네임 랜덤 추천 · 학교 UI 0건 · 중복 내 기록 버튼 제거', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('vocabulary-td');
      localStorage.clear();
      localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecordsAsked: true }));
    });
    await page.reload();

    // 기본 밝은 테마 적용 확인
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // 처음 온 학생에게는 '처음이라면 연습부터'를 보이고, 학교 입력/검색·중복 '내 기록' 헤더 버튼은 없다.
    await expect(page.getByRole('button', { name: '처음이라면 연습부터' })).toBeVisible();
    await expect(page.getByRole('button', { name: '새 게임' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '학교 이름' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '학교 검색' })).toHaveCount(0);
    await expect(page.locator('#recordsBtn')).toHaveCount(0);

    // 닉네임 미입력 상태에서 '새 게임' 클릭 시 전투로 들어가지 않고 입력칸에 포커스가 간다.
    const nickInput = page.getByRole('textbox', { name: '닉네임' });
    await page.getByRole('button', { name: '새 게임' }).click();
    await expect(page.getByRole('img', { name: '준비 1/5' })).toHaveCount(0);
    await expect(nickInput).toBeFocused();
    await expect(page.locator('#landingNickStatus')).toContainText(/닉네임|별명/);

    // '랜덤 추천' 클릭 시 닉네임이 들어가고 내 순위 요약과 즉시 연동된다.
    const recommendBtn = page.getByRole('button', { name: '랜덤 추천' });
    await recommendBtn.click();
    const firstRec = await nickInput.inputValue();
    expect(firstRec.length).toBeGreaterThanOrEqual(2);
    await expect(page.getByLabel('내 순위 요약')).toContainText(firstRec);

    await recommendBtn.click();
    const secondRec = await nickInput.inputValue();
    expect(secondRec).not.toBe(firstRec);
    await expect(page.getByLabel('내 순위 요약')).toContainText(secondRec);

    // 닉네임·학년·난이도 선택 후 '새 게임' 클릭 한 번으로 즉시 전투 화면에 진입한다.
    await nickInput.fill('참나무기사');
    await page.getByRole('combobox', { name: '난이도', exact: true }).selectOption('Hard');
    await expect(page.getByRole('region', { name: '새 게임 준비' })).toContainText('성문');
    await page.getByRole('button', { name: '새 게임' }).click();
    await expect(page.getByRole('img', { name: '준비 1/5' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('오답 노트 버튼: 기록이 없으면 접근 이름이 정확히 「오답 노트」', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const noteBtn = page.getByRole('button', { name: '오답 노트', exact: true });
    await expect(noteBtn).toBeVisible();
    await expect(noteBtn).toHaveAttribute('id', 'noteBtn');
    await expect(page.getByRole('button', { name: /오답 노트 \d+개/ })).toHaveCount(0);
  });

  test('오늘의 낱말 · 3탭 랭킹(최고 점수·최고 웨이브·내 기록) · 설정 연동', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecordsAsked: true }));
    });
    await page.reload();

    // 오늘의 낱말: 랜덤 버튼 단일 배치 + 1:1 정사각형 초상
    const stele = page.getByRole('region', { name: '오늘의 낱말' });
    await expect(stele.getByRole('button')).toHaveCount(1);
    await expect(stele.getByRole('button', { name: '랜덤' })).toBeVisible();
    const studyImg = stele.locator('img[src*="r6.portrait."]');
    await expect(studyImg).toHaveCount(1);
    await expect
      .poll(() => studyImg.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 256 && el.naturalHeight === 256))
      .toBe(true);

    const firstLemma = await stele.locator('strong').first().innerText();
    await stele.getByRole('button', { name: '랜덤' }).click();
    const randomLemma = await stele.locator('strong').first().innerText();
    expect(randomLemma).not.toBe(firstLemma);

    for (const [vw, vh] of [[1440, 900], [1366, 650], [390, 844]] as const) {
      await page.setViewportSize({ width: vw, height: vh });
      const artBox = (await studyImg.boundingBox())!;
      expect(artBox.width, `${vw}x${vh} 액자 폭`).toBeGreaterThanOrEqual(70);
      expect(Math.abs(artBox.width - artBox.height), `${vw}x${vh} 1:1 종횡비`).toBeLessThanOrEqual(0.5);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // 랭킹 3탭 및 1줄 select 필터 검증
    const rankBoard = page.getByRole('complementary', { name: '랭킹', exact: true });
    const tabs = rankBoard.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs).toHaveText(['최고 점수', '최고 웨이브', '내 기록']);

    await rankBoard.getByRole('tab', { name: '최고 웨이브' }).click();
    await expect(rankBoard.getByRole('combobox', { name: '난이도 범위' })).toBeVisible();
    await rankBoard.getByRole('tab', { name: '내 기록' }).click();
    await expect(rankBoard.getByRole('combobox', { name: '난이도 범위' })).toHaveCount(0);

    // 설정 모달에서 단축키 배지 끄고 1-Click 진입 확인
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await settingsDialog.getByRole('tab', { name: '화면·조작' }).click();
    const keyHints = settingsDialog.getByRole('switch', { name: '단축키 번호 배지 표시' });
    await keyHints.click();
    await expect(keyHints).toHaveAttribute('aria-checked', 'false');
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    await page.getByRole('textbox', { name: '닉네임' }).fill('단축키검증');
    await page.getByRole('button', { name: '새 게임' }).click();
    const firstOption = page.getByRole('region', { name: '어휘 문제' }).getByRole('group', { name: '보기' }).getByRole('button').first();
    await expect(firstOption).toBeVisible();
    await expect(firstOption.locator('[aria-hidden="true"]')).toHaveCount(0);
  });

  test('100명 세로 스크롤 · 좌우 높이 일치 · 내 위치 점프 · 시즌 전환', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: false, lastNickname: '하하호호' })));
    await page.goto('/');
    await seedRecords(page, 2, 1);
    await seedRecords(page, 100, 2);
    await page.reload();

    const board = page.getByRole('complementary', { name: '랭킹', exact: true });
    const leftCol = page.locator('main > div').first();

    // 좌측 열과 우측 랭킹 패널 높이 1px 이내 일치 확인
    const leftBox = (await leftCol.boundingBox())!;
    const boardBox = (await board.boundingBox())!;
    expect(Math.abs(leftBox.height - boardBox.height), '좌우 컬럼 높이 일치').toBeLessThanOrEqual(1.5);

    // Top 3 포디움 + 4~100위(97명) 세로 스크롤 확인
    await expect(board.getByLabel('상위 3위')).toBeVisible();
    const boardList = board.getByRole('region', { name: '랭킹 목록' });
    await expect(boardList.getByRole('listitem')).toHaveCount(97);

    const scrollGap = (el: Locator) => el.evaluate(n => n.scrollHeight - n.clientHeight);
    const scrollTop = (el: Locator) => el.evaluate(n => n.scrollTop);
    expect(await scrollGap(boardList)).toBeGreaterThan(200);

    // '내 위치' 버튼 클릭 시 14위(하하호호) 행으로 자동 스크롤
    await board.getByRole('button', { name: '내 위치' }).click();
    await expect.poll(() => scrollTop(boardList)).toBeGreaterThan(50);

    // 시즌 1 전환 확인
    await board.getByRole('combobox', { name: '집계 기간' }).selectOption('season1');
    await expect(boardList.getByRole('listitem')).toHaveCount(2);
    await expect(boardList).toContainText('시즌1도전자001');
  });

  test('시각 · 접근성 · 스타일 감사: 전 뷰포트 가로 넘침 0px, 크롬북 무스크롤, axe 위반 0건, §12.8 위반 0건', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await seedRecords(page, 20, 2);
    await page.reload();

    await page.getByRole('textbox', { name: '닉네임' }).fill('하하호호');
    await expect(page.getByRole('complementary', { name: '랭킹', exact: true })).toContainText('하하호호');

    const heroImg = page.getByRole('img', { name: '초원 고원 전장 미리보기' });
    await expect.poll(() => heroImg.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    const homeAxe = await new AxeBuilder({ page }).analyze();
    expect(homeAxe.violations.flatMap(v => v.nodes.map(node => `${v.id}: ${node.target.join(' ')}`))).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/r6-01-home-desktop.png' });

    // PRD §12.8 스타일 검사: linear/radial gradient 0건, backdrop-filter 0건
    const styleViolations = await page.evaluate(() => {
      const issues: string[] = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.backgroundImage !== 'none' && cs.backgroundImage.includes('gradient')) {
          issues.push(`gradient on ${el.tagName}.${el.className}`);
        }
        const bf = cs.getPropertyValue('backdrop-filter') || cs.getPropertyValue('-webkit-backdrop-filter');
        if (bf && bf !== 'none') {
          issues.push(`backdrop-filter on ${el.tagName}.${el.className}`);
        }
      }
      return issues;
    });
    expect(styleViolations).toEqual([]);

    // 1366×650 크롬북 저높이 뷰포트에서 스크롤 없이 '새 게임' CTA와 좌우 패널이 온전히 들어오는지 검증
    await page.setViewportSize({ width: 1366, height: 650 });
    const newBtnBox = await page.getByRole('button', { name: '새 게임' }).boundingBox();
    expect(newBtnBox).not.toBeNull();
    expect(newBtnBox!.y + newBtnBox!.height).toBeLessThanOrEqual(650);
    await page.screenshot({ path: 'test-results/shots/r6-01-home-chromebook.png' });

    for (const [w, h] of [
      [1440, 900],
      [1366, 650],
      [1024, 768],
      [390, 844],
      [320, 568],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${w}x${h} overflow`).toBeLessThanOrEqual(0);
      if (w === 390) await page.screenshot({ path: 'test-results/shots/r6-01-home-mobile.png', fullPage: true });
    }
  });
});

test('밝은 화면(기본) ↔ 어두운 화면 전환이 즉시 반영되고 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');
  const canvasColor = () => root.evaluate(el => getComputedStyle(el).getPropertyValue('--bg-canvas').trim());
  const lightCanvas = await canvasColor();

  await page.getByRole('button', { name: '설정' }).click();
  const dialog = page.getByRole('dialog', { name: '환경설정' });
  await dialog.getByRole('tab', { name: '화면·조작' }).click();
  const theme = dialog.getByRole('switch', { name: '밝은 화면' });
  await expect(theme).toBeChecked();

  await theme.click();
  await expect(theme).not.toBeChecked();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(await canvasColor()).not.toBe(lightCanvas);
  expect((await new AxeBuilder({ page }).analyze()).violations.map(v => v.id)).toEqual([]);

  await dialog.getByRole('button', { name: '닫기' }).click();
  await page.screenshot({ path: 'test-results/shots/r6-01-home-dark-desktop.png' });

  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
});

test('교실 QR 창에서 학년 선택이 입장 주소에 반영되고 학교 토글은 없다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: '교실 QR', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '교실 입장 QR · 주소' });
  await expect(dialog.getByRole('img', { name: '교실 입장 QR 코드' })).toBeVisible();
  await expect(dialog.getByRole('switch', { name: /학교/ })).toHaveCount(0);
  await dialog.getByRole('radio', { name: '4학년', exact: true }).click();
  await expect(dialog).toContainText('grade=4');
  await expect(dialog).not.toContainText('school=');
});
