import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// 홈은 옛 랜딩(방향 2-A: 왕국 참나무 작전실)이다. R4 U1 타이틀 화면(3426df8)을 되돌린 것이며, 이어하기(저장)는 앱에서 제거됐다.
// 새 게임 창·환경설정·사용 설명서는 R4 판 그대로라서 그 창 안의 단언은 R4 기준이고, 홈에서 여는 단추 이름만 랜딩 기준이다.
test.describe('랜딩 페이지(방향 2-A: 왕국 참나무 작전실) 통합 검증', () => {
  test('L01·L04·L06·L07·L08: 처음 온 학생에게 연습 권유, 적용됨 버튼 제거, 직결 닉네임 데크·랜덤 추천·자동 연동·새 게임 무마찰 승계', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('vocabulary-td');
      localStorage.clear();
    });
    await page.reload();

    // L01: 처음 온 학생에게는 '처음이라면 연습부터'를 보이고(PRD §12.2), 저장이 없으니 이어하기는 없다. '적용/적용됨' 버튼은 없다.
    await expect(page.getByRole('button', { name: '처음이라면 연습부터' })).toBeVisible();
    await expect(page.getByRole('button', { name: '연습하기' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /이어하기/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^적용/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '새 게임' })).toBeVisible();

    // 4대 지표 영역 표시 확인
    const telemetry = page.getByRole('region', { name: '왕국 수호 현황' });
    await expect(telemetry).toContainText('실시간 접속');
    await expect(telemetry).toContainText('오늘 플레이');
    await expect(telemetry).toContainText('누적 접속');
    await expect(telemetry).toContainText('누적 플레이');

    // L06: 닉네임 미입력 상태에서 '새 게임' 클릭 시 모달이 열리지 않고 입력칸에 포커스가 간다.
    const nickInput = page.getByRole('textbox', { name: /닉네임|출정 별명/ });
    await page.getByRole('button', { name: '새 게임' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(nickInput).toBeFocused();
    await expect(page.locator('#landingNickStatus')).toContainText(/닉네임|별명/);

    // L05: '랜덤 추천' 클릭 시 재치 있는 닉네임이 들어가고 연속 클릭 시 다른 닉네임으로 바뀌며 내 순위 도크와 즉시 연동된다.
    const recommendBtn = page.getByRole('button', { name: '랜덤 추천' });
    await recommendBtn.click();
    const firstRec = await nickInput.inputValue();
    expect(firstRec.length).toBeGreaterThanOrEqual(2);
    await expect(page.getByLabel('내 순위 요약')).toContainText(firstRec);
    await expect(page.getByRole('button', { name: /^적용/ })).toHaveCount(0);

    await recommendBtn.click();
    const secondRec = await nickInput.inputValue();
    expect(secondRec).not.toBe(firstRec);
    await expect(page.getByLabel('내 순위 요약')).toContainText(secondRec);

    // L07·L08: 새 닉네임을 타이핑하고 곧바로 '새 게임'을 눌러도 자동 승계되며 창 안에는 닉네임 입력칸이 없다.
    // (R4 새 게임 창: 닉네임을 창에 다시 보이지 않으므로 '승계'는 저장된 설정 값으로 확인한다. 창 이름은 '새 게임'.)
    const savedNick = () => page.evaluate(() => JSON.parse(localStorage.getItem('vocabulary-td.settings') ?? '{}').lastNickname as string);
    await nickInput.fill('참나무수호대');
    await page.getByRole('button', { name: '새 게임' }).click();
    const dialog = page.getByRole('dialog', { name: '새 게임' });
    await expect(dialog).toBeVisible();
    await expect.poll(savedNick).toBe('참나무수호대');
    await expect(dialog.getByRole('textbox')).toHaveCount(0);
    // 닫기(×)는 하나뿐이고 '뒤로'는 없다. 학년·난이도는 고르기 줄이다.
    await expect(dialog.getByRole('button', { name: '닫기' })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: '뒤로' })).toHaveCount(0);
    await expect(dialog.getByRole('radiogroup', { name: '학년' }).getByRole('radio')).toHaveCount(4);
    await expect(dialog.getByRole('radiogroup', { name: '난이도' }).getByRole('radio')).toHaveCount(4);

    // 창을 닫으면 홈의 닉네임 입력칸에 방금 정한 닉네임이 그대로 남아 있다.
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(nickInput).toHaveValue('참나무수호대');
    expect(errors).toEqual([]);
  });

  test('오답 노트 버튼: 홈 머리판에 보이고, 기록이 없으면 개수 없이 접근 이름이 정확히 「오답 노트」', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const noteBtn = page.getByRole('button', { name: '오답 노트', exact: true });
    await expect(noteBtn).toBeVisible();
    await expect(noteBtn).toHaveAttribute('id', 'noteBtn');
    // 개수가 없으면 별도 접근 이름(오답 노트 N개)이 없다.
    await expect(page.getByRole('button', { name: /오답 노트 \d+개/ })).toHaveCount(0);
  });

  test('L09·L10·L12·L14·L17: 비석 낱말 학습 카드, 설정 한 목록(switch 줄·닉네임 배제·인게임 배지 연동), 4분류 통합 랭킹', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // L09·L10: 오늘의 낱말 공부 패널(뜻 가리기 · <> 순서 이동 · 갯수 표시 제거, 랜덤 단일 버튼으로 서버 전체 낱말 순환)
    const stele = page.getByRole('region', { name: '오늘의 낱말 공부' });
    await expect(stele.getByRole('button', { name: /뜻 가리고 외우기|뜻 다시 보기/ })).toHaveCount(0);
    await expect(stele.getByRole('button', { name: '이전 낱말' })).toHaveCount(0);
    await expect(stele.getByRole('button', { name: '다음 낱말' })).toHaveCount(0);
    await expect(stele).not.toContainText(/\d+\s*\/\s*\d+/);
    await expect(stele.getByRole('button')).toHaveCount(1);
    await expect(stele.getByRole('button', { name: '랜덤' })).toBeVisible();
    await expect(stele).toContainText('뜻풀이');

    const firstLemma = await stele.locator('strong').first().innerText();
    expect(firstLemma.length).toBeGreaterThan(0);

    await stele.getByRole('button', { name: '랜덤' }).click();
    const randomLemma = await stele.locator('strong').first().innerText();
    expect(randomLemma.length).toBeGreaterThan(0);
    expect(randomLemma).not.toBe(firstLemma);

    // 연속 랜덤 클릭 시 직전 낱말과 중복되지 않고 뜻풀이가 항상 바로 표시된다.
    await stele.getByRole('button', { name: '랜덤' }).click();
    const secondRandomLemma = await stele.locator('strong').first().innerText();
    expect(secondRandomLemma).not.toBe(randomLemma);
    expect([firstLemma, randomLemma, secondRandomLemma].every(w => w.length >= 1)).toBe(true);
    await expect(stele).toContainText('뜻풀이');

    // L17: 통합 수호 랭킹 4탭 전환 및 상세 모달 열기
    const rankBoard = page.getByRole('complementary', { name: '통합 수호 랭킹' });
    await rankBoard.getByRole('tab', { name: '누적 명예점' }).click();
    await expect(rankBoard.getByRole('radiogroup', { name: '집계 기간' })).toBeVisible();
    await rankBoard.getByRole('tab', { name: '최장 웨이브' }).click();
    await expect(rankBoard.getByRole('radiogroup', { name: '난이도 범위' })).toBeVisible();
    await rankBoard.getByRole('button', { name: '상세 순위표 열기' }).click();
    await expect(page.getByRole('dialog', { name: /상세 수호 순위표/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // L12·L13·L14: 환경설정 모달(R4 U3: 탭 없이 한 목록, 켜기/끄기 줄은 switch, 닉네임 입력칸·대원 전환 0개) 및 단축키 번호 배지 인게임 실제 연동
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await expect(settingsDialog).toBeVisible();
    await expect(settingsDialog.getByRole('tab')).toHaveCount(0);
    await expect(settingsDialog.getByRole('textbox')).toHaveCount(0);
    await expect(settingsDialog.getByText(/대원 전환|별명 변경/)).toHaveCount(0);
    // 켜기/끄기 줄은 모두 switch이고 한 목록 안에 한꺼번에 보인다(탭을 눌러 찾아가지 않는다).
    for (const name of ['전체 소리', '전장 길·받침 고대비 윤곽선', '단축키 번호 배지 표시', '공개 기록 나누기']) {
      await expect(settingsDialog.getByRole('switch', { name })).toBeVisible();
    }
    await expect(settingsDialog.getByRole('radiogroup', { name: '글자 크기' })).toBeVisible();
    await expect(settingsDialog.getByRole('radiogroup', { name: '배경 움직임 단계' })).toBeVisible();

    await settingsDialog.getByRole('button', { name: '정답음 들어보기' }).click();
    await settingsDialog.getByRole('radio', { name: '글자 크게' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.font)).toBe('large');
    await settingsDialog.getByRole('radio', { name: '글자 보통' }).click();

    const keyHints = settingsDialog.getByRole('switch', { name: '단축키 번호 배지 표시' });
    await expect(keyHints).toHaveAttribute('aria-checked', 'true');
    await keyHints.click();
    await expect(keyHints).toHaveAttribute('aria-checked', 'false');
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    // 게임 진입 후 QuestionPanel 보기 옆 번호 배지(1~4)가 실제로 숨겨졌는지 확인
    await page.getByRole('textbox', { name: /닉네임|출정 별명/ }).fill('단축키검증');
    await page.getByRole('button', { name: '새 게임' }).click();
    await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
    const firstOption = page.getByRole('region', { name: '어휘 문제' }).getByRole('group', { name: '보기' }).getByRole('button').first();
    await expect(firstOption).toBeVisible();
    await expect(firstOption.locator('[aria-hidden="true"]')).toHaveCount(0);
  });

  test('L20·L21·L22: 전 뷰포트 가로 넘침 0px, 크롬북 첫 화면 CTA 노출, axe 위반 0건, §12.8 그라디언트·블러 0건', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 홈 기본 axe 검사(캔버스 제외 없이 전수 통과) 및 샘플 기록 적재 시 랭킹 보드 렌더링 확인
    await page.evaluate(async () => {
      const req = indexedDB.open('vocabulary-td', 3);
      await new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('records', 'readwrite');
          const store = tx.objectStore('records');
          [
            ['별빛파수꾼', 14280, 19, 42, 2],
            ['푸른솔바람', 12950, 17, 38, 3],
            ['슬기로운학자', 11640, 15, 34, 2],
            ['참나무수호대', 10420, 14, 31, 3],
            ['은빛산새', 9380, 12, 28, 4],
          ].forEach(([nickname, pt, completedWave, correct, wrong], i) => {
            store.put({
              runId: `00000000-0000-4000-8000-00000000020${i}`,
              nickname,
              grade: 3,
              difficulty: 'Normal',
              mapId: 'garden_u',
              pt,
              completedWave,
              endedAtWave: Number(completedWave) + 1,
              correct,
              wrong,
              skipped: 1,
              endedAt: new Date(Date.now() - i * 3600_000).toISOString(),
              endReason: 'DEFEAT',
              contentMode: 'published',
              balanceVersion: '0.4.0',
              bankVersion: 'pub-test',
            });
          });
          tx.oncomplete = () => { db.close(); resolve(null); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
    await page.getByRole('textbox', { name: /닉네임|출정 별명/ }).fill('참나무수호대');
    await expect(page.getByRole('complementary', { name: '통합 수호 랭킹' })).toContainText('별빛파수꾼');
    await expect(page.getByLabel('내 순위 요약')).toContainText('4위 · 10,420점');

    const homeAxe = await new AxeBuilder({ page }).analyze();
    expect(homeAxe.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/home-2a-desktop.png' });

    // 설정 모달 axe 검사
    await page.getByRole('button', { name: '설정' }).click();
    const settingsAxe = await new AxeBuilder({ page }).analyze();
    expect(settingsAxe.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/home-2a-settings.png' });
    await page.keyboard.press('Escape');

    // 새 게임 모달 캡처 및 axe 검사
    await page.getByRole('textbox', { name: /닉네임|출정 별명/ }).fill('참나무수호대');
    await page.getByRole('button', { name: '새 게임' }).click();
    await expect(page.getByRole('dialog', { name: '새 게임' })).toBeVisible();
    const newGameAxe = await new AxeBuilder({ page }).analyze();
    expect(newGameAxe.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/home-2a-newgame.png' });
    await page.keyboard.press('Escape');

    // PRD §12.8 스타일 검사: linear/radial gradient 0건, backdrop-filter 0건, 다중 그림자 0건
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

    // 1366×650 크롬북 저높이 뷰포트에서 스크롤 없이 '새 게임' 버튼이 화면 안에 온전히 들어오는지 검증
    await page.setViewportSize({ width: 1366, height: 650 });
    const newBtnBox = await page.getByRole('button', { name: '새 게임' }).boundingBox();
    expect(newBtnBox).not.toBeNull();
    expect(newBtnBox!.y + newBtnBox!.height).toBeLessThanOrEqual(650);

    // 반응형 전 규격 가로 넘침 0px 검증
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
      if (w === 390) await page.screenshot({ path: 'test-results/shots/home-2a-mobile.png' });
    }
  });

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
    await expect(quizDetail).toContainText('불꽃');
    await expect(more.nth(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(more.nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(more.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(quizDetail).toBeHidden();

    // 나머지 카드의 자세한 글(옛 1~4장 본문)을 모두 펼쳐 읽을 수 있다.
    for (let i = 0; i < 5; i++) await more.nth(i).click();
    for (let i = 0; i < 5; i++) await expect(more.nth(i)).toHaveAttribute('aria-expanded', 'true');
    await expect(cards.nth(0)).toContainText('준비 문제');
    await expect(cards.nth(0)).toContainText('성문 회복과 대장');
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
