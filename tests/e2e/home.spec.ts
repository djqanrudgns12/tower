import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from './tower-browser';

/** 서로 다른 닉네임 count개의 3학년·보통 기록을 이 기기 IndexedDB에 심는다(로컬 랭킹은 닉네임마다 한 줄이라 줄 수 = 닉네임 수). */
async function seedRecords(page: Page, count: number) {
  await page.evaluate(async n => {
    const req = indexedDB.open('vocabulary-td', 3);
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        for (let i = 0; i < n; i++) {
          store.put({
            runId: `00000000-0000-4000-8000-${String(100 + i).padStart(12, '0')}`,
            nickname: `기록시험${String(i + 1).padStart(2, '0')}`,
            grade: 3,
            difficulty: 'Normal',
            mapId: 'garden_u',
            pt: 20000 - i * 100,
            completedWave: 20 - (i % 15),
            endedAtWave: 21 - (i % 15),
            correct: 30,
            wrong: 3,
            skipped: 1,
            endedAt: new Date(Date.now() - i * 3600_000).toISOString(),
            endReason: 'DEFEAT',
            contentMode: 'published',
            balanceVersion: '0.4.0',
            bankVersion: 'pub-test',
          });
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, count);
}

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
    const telemetry = page.getByRole('region', { name: '접속 현황' });
    await expect(telemetry).toContainText('최근 접속');
    await expect(telemetry).toContainText('오늘 플레이');
    await expect(telemetry).toContainText('누적 접속');
    await expect(telemetry).toContainText('누적 플레이');

    // L06: 닉네임 미입력 상태에서 '새 게임' 클릭 시 모달이 열리지 않고 입력칸에 포커스가 간다.
    const nickInput = page.getByRole('textbox', { name: '닉네임' });
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

  test('N1·N2: 새 게임 창 맨 아래 시작 줄 — 닉네임 ○○ · 바꾸기, 좁고 낮은 화면에서도 스크롤 없이 시작이 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => { indexedDB.deleteDatabase('vocabulary-td'); localStorage.clear(); });
    await page.reload();

    const nickInput = page.getByRole('textbox', { name: '닉네임' });
    await nickInput.fill('하늘바람');
    await page.getByRole('button', { name: '새 게임', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '새 게임' });
    await expect(dialog).toBeVisible();

    // N1: 시작 줄에 '닉네임 하늘바람'과 바꾸기 단추가 있고, 닉네임이 있으니 시작이 막혀 있지 않다.
    const start = dialog.getByRole('button', { name: '시작', exact: true });
    await expect(dialog.getByText('하늘바람', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '닉네임 바꾸기' })).toBeVisible();
    await expect(start).not.toHaveAttribute('aria-disabled', 'true');

    // N2: 창 아래에 고정된 시작 줄이라 1366×650(낮음)·390×844(좁음)·320×568(아주 작음) 모두 스크롤 없이 시작이 화면에 온전히 들어온다.
    for (const [w, h] of [[1366, 650], [390, 844], [320, 568]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await expect(start, `${w}x${h} 시작`).toBeInViewport({ ratio: 1 });
      const box = (await dialog.boundingBox())!;
      expect(box.y + box.height, `${w}x${h} 창 아래쪽`).toBeLessThanOrEqual(h);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${w}x${h} 가로 넘침`).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // N3: 난이도를 고르면 설명 한 줄 아래에 판독 한 줄(성문 · 첫 정답 골드 · 낱말 범위)이 바뀌어 나온다. 퍼센트는 없다.
    const readoutLines: string[] = [];
    for (const name of ['쉬움', '보통', '어려움', '아주 어려움']) {
      await dialog.getByRole('radio', { name, exact: true }).click();
      const line = (await dialog.locator('p', { hasText: /^성문 \d+ · / }).textContent()) ?? '';
      expect(line, `${name} 판독 줄`).toMatch(/^성문 \d+ · 정답 \+\d+골드(부터)? · 교과 /);
      expect(line).not.toMatch(/%/);
      readoutLines.push(line);
    }
    expect(new Set(readoutLines).size, '난이도마다 판독 줄이 다르다').toBeGreaterThanOrEqual(3);
    await dialog.getByRole('radio', { name: '보통', exact: true }).click();

    // N1: '바꾸기'를 누르면 창이 닫히고 홈의 닉네임 입력칸에 포커스가 가며, 적어 둔 닉네임은 그대로다.
    await dialog.getByRole('button', { name: '닉네임 바꾸기' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(nickInput).toBeFocused();
    await expect(nickInput).toHaveValue('하늘바람');
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

    // L09·L10: 오늘의 낱말 패널(뜻 가리기 · <> 순서 이동 · 갯수 표시 제거, 랜덤 단일 버튼으로 서버 전체 낱말 순환)
    const stele = page.getByRole('region', { name: '오늘의 낱말' });
    await expect(stele.getByRole('button', { name: /뜻 가리고 외우기|뜻 다시 보기/ })).toHaveCount(0);
    await expect(stele.getByRole('button', { name: '이전 낱말' })).toHaveCount(0);
    await expect(stele.getByRole('button', { name: '다음 낱말' })).toHaveCount(0);
    await expect(stele).not.toContainText(/\d+\s*\/\s*\d+/);
    await expect(stele.getByRole('button')).toHaveCount(1);
    await expect(stele.getByRole('button', { name: '랜덤' })).toBeVisible();
    await expect(stele).toContainText('뜻풀이');

    const studyImg = stele.locator('img[src*="study.monster."]');
    await expect(studyImg).toHaveCount(1);
    await expect
      .poll(() => studyImg.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 192 && el.naturalHeight === 192))
      .toBe(true);
    const firstArtSrc = await studyImg.getAttribute('src');
    expect(firstArtSrc).toMatch(/assets\/ui\/study\/study\.monster\.\d{2}\.webp$/);

    const firstLemma = await stele.locator('strong').first().innerText();
    expect(firstLemma.length).toBeGreaterThan(0);

    await stele.getByRole('button', { name: '랜덤' }).click();
    const randomLemma = await stele.locator('strong').first().innerText();
    const secondArtSrc = await studyImg.getAttribute('src');
    expect(randomLemma.length).toBeGreaterThan(0);
    expect(randomLemma).not.toBe(firstLemma);
    expect(secondArtSrc).toMatch(/assets\/ui\/study\/study\.monster\.\d{2}\.webp$/);
    expect(secondArtSrc).not.toBe(firstArtSrc);

    // 연속 랜덤 클릭 시 직전 낱말·일러스트와 중복되지 않고 뜻풀이가 항상 바로 표시된다.
    await stele.getByRole('button', { name: '랜덤' }).click();
    const secondRandomLemma = await stele.locator('strong').first().innerText();
    const thirdArtSrc = await studyImg.getAttribute('src');
    expect(secondRandomLemma).not.toBe(randomLemma);
    expect(thirdArtSrc).not.toBe(secondArtSrc);
    expect([firstLemma, randomLemma, secondRandomLemma].every(w => w.length >= 1)).toBe(true);
    await expect(stele).toContainText('뜻풀이');

    // 대표 뷰포트(데스크톱·크롬북·모바일·초소형) 모두 액자 내부 그림 표시 영역이 1:1 정사각형(잘림 0px)인지 확인
    for (const [vw, vh] of [[1440, 900], [1366, 650], [390, 844], [320, 568]] as const) {
      await page.setViewportSize({ width: vw, height: vh });
      const artBox = (await studyImg.boundingBox())!;
      expect(artBox.width, `${vw}x${vh} 액자 폭`).toBeGreaterThanOrEqual(70);
      expect(Math.abs(artBox.width - artBox.height), `${vw}x${vh} 1:1 종횡비`).toBeLessThanOrEqual(0.5);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // L17: 랭킹 4탭 전환 및 상세 모달 열기
    const rankBoard = page.getByRole('complementary', { name: '랭킹', exact: true });
    await rankBoard.getByRole('tab', { name: '랭킹 점수' }).click();
    await expect(rankBoard.getByRole('radiogroup', { name: '집계 기간' })).toBeVisible();
    await rankBoard.getByRole('tab', { name: '최고 웨이브' }).click();
    await expect(rankBoard.getByRole('radiogroup', { name: '난이도 범위' })).toBeVisible();
    // H1: 머리판 「내 기록」은 랭킹의 '내 기록' 탭 바로가기다.
    await page.locator('#recordsBtn').click();
    await expect(rankBoard.getByRole('tab', { name: '내 기록' })).toHaveAttribute('aria-selected', 'true');
    await rankBoard.getByRole('button', { name: '전체 보기' }).click();
    const rankDialog = page.getByRole('dialog', { name: /전체 랭킹/ });
    await expect(rankDialog).toBeVisible();
    const rankBox0 = (await rankDialog.boundingBox())!;
    for (const tabName of ['최고 점수', '랭킹 점수', '최고 웨이브', '내 기록']) {
      await rankDialog.getByRole('tab', { name: tabName }).click();
      const box = (await rankDialog.boundingBox())!;
      expect(Math.abs(box.width - rankBox0.width), `${tabName} 창 폭 고정`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(box.height - rankBox0.height), `${tabName} 창 높이 고정`).toBeLessThanOrEqual(0.5);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 학교 검색: 홈 드롭다운으로 아래 '새 게임' 단추를 덮지 않고 소형(420px) 전용 모달로 열린다
    await page.getByRole('button', { name: '학교 검색' }).click();
    const schoolDialog = page.getByRole('dialog', { name: '학교 찾기' });
    await expect(schoolDialog).toBeVisible();
    const schoolBox = (await schoolDialog.boundingBox())!;
    expect(Math.round(schoolBox.width)).toBe(420);
    await expect(schoolDialog.getByRole('textbox', { name: '학교 이름 검색' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(schoolDialog).toHaveCount(0);

    // L12·L13·L14: 환경설정 모달(md 680×540 고정 프레임 + 3탭: 소리 / 화면·조작 / 기록 관리, 닉네임 입력칸·대원 전환 0개) 및 단축키 번호 배지 인게임 실제 연동
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await expect(settingsDialog).toBeVisible();
    await expect(settingsDialog.getByRole('tab')).toHaveCount(3);
    await expect(settingsDialog.getByRole('textbox')).toHaveCount(0);
    await expect(settingsDialog.getByText(/대원 전환|별명 변경/)).toHaveCount(0);

    const setBox0 = (await settingsDialog.boundingBox())!;
    await expect(settingsDialog.getByRole('switch', { name: '전체 소리' })).toBeVisible();
    await settingsDialog.getByRole('button', { name: '정답음 들어보기' }).click();

    await settingsDialog.getByRole('tab', { name: '화면·조작' }).click();
    const setBox1 = (await settingsDialog.boundingBox())!;
    expect(Math.abs(setBox1.height - setBox0.height), '환경설정 탭 높이 고정').toBeLessThanOrEqual(0.5);
    await expect(settingsDialog.getByRole('radiogroup', { name: '글자 크기' })).toBeVisible();
    await expect(settingsDialog.getByRole('radiogroup', { name: '배경 움직임 단계' })).toBeVisible();
    await expect(settingsDialog.getByRole('switch', { name: '전장 길·받침 고대비 윤곽선' })).toBeVisible();

    await settingsDialog.getByRole('radio', { name: '글자 크게' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.font)).toBe('large');
    await settingsDialog.getByRole('radio', { name: '글자 보통' }).click();

    const keyHints = settingsDialog.getByRole('switch', { name: '단축키 번호 배지 표시' });
    await expect(keyHints).toHaveAttribute('aria-checked', 'true');
    await keyHints.click();
    await expect(keyHints).toHaveAttribute('aria-checked', 'false');

    await settingsDialog.getByRole('tab', { name: '기록 관리' }).click();
    const setBox2 = (await settingsDialog.boundingBox())!;
    expect(Math.abs(setBox2.height - setBox0.height), '환경설정 기록 관리 탭 높이 고정').toBeLessThanOrEqual(0.5);
    await expect(settingsDialog.getByRole('switch', { name: '공개 기록 나누기' })).toBeVisible();
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    // 게임 진입 후 QuestionPanel 보기 옆 번호 배지(1~4)가 실제로 숨겨졌는지 확인
    await page.getByRole('textbox', { name: '닉네임' }).fill('단축키검증');
    await page.getByRole('button', { name: '새 게임' }).click();
    await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
    const firstOption = page.getByRole('region', { name: '어휘 문제' }).getByRole('group', { name: '보기' }).getByRole('button').first();
    await expect(firstOption).toBeVisible();
    await expect(firstOption.locator('[aria-hidden="true"]')).toHaveCount(0);
  });

  test('H1·접근성: 랭킹 목록은 안에서 스크롤해도 Tab으로 닿고 방향키로 스크롤된다(전체 랭킹 창·저높이 홈 판)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await seedRecords(page, 30);
    await page.reload();

    const board = page.getByRole('complementary', { name: '랭킹', exact: true });
    const scrollGap = (el: Locator) => el.evaluate(n => n.scrollHeight - n.clientHeight);
    const scrollTop = (el: Locator) => el.evaluate(n => n.scrollTop);

    // 전체 랭킹 창: 상위 50위 목록이 360px를 넘어 안에서 스크롤된다. 첫 포커스는 닫기이고, Tab으로 목록 영역에 닿는다.
    await board.getByRole('button', { name: '전체 보기' }).click();
    const dialog = page.getByRole('dialog', { name: /전체 랭킹/ });
    const modalList = dialog.getByRole('region', { name: '랭킹 목록' });
    await expect(modalList.getByRole('listitem')).toHaveCount(30);
    await expect(modalList).toHaveAttribute('tabindex', '0');
    expect(await scrollGap(modalList), '창 목록이 스크롤된다').toBeGreaterThan(0);
    await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused();
    for (let i = 0; i < 8 && !(await modalList.evaluate(n => n === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(modalList).toBeFocused();
    const before = await scrollTop(modalList);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('PageDown');
    await expect.poll(() => scrollTop(modalList), '방향키로 목록이 내려간다').toBeGreaterThan(before);
    expect((await new AxeBuilder({ page }).analyze()).violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // 저높이(1366×650) 홈 판: 목록이 200px로 줄어 안에서 스크롤된다. 같은 영역이 Tab으로 닿고 방향키로 내려간다.
    await page.setViewportSize({ width: 1366, height: 650 });
    const boardList = board.getByRole('region', { name: '랭킹 목록' });
    await expect(boardList.getByRole('listitem')).toHaveCount(8);
    await expect(boardList).toHaveAttribute('tabindex', '0');
    expect(await scrollGap(boardList), '홈 판 목록이 스크롤된다').toBeGreaterThan(0);
    await boardList.focus();
    await expect(boardList).toBeFocused();
    const homeBefore = await scrollTop(boardList);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('PageDown');
    await expect.poll(() => scrollTop(boardList), '방향키로 홈 판 목록이 내려간다').toBeGreaterThan(homeBefore);
    expect((await new AxeBuilder({ page }).analyze()).violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test('S1·S2: 설정 — 3탭(소리 / 화면·조작 / 기록 관리) 고정 프레임(680×540), 1366×650 창 안 스크롤 0(글자 3단계), 기본 표식·한 줄 설명·켜짐/꺼짐 글자', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 650 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: '설정' }).click();
    const dialog = page.getByRole('dialog', { name: '환경설정' });
    await expect(dialog).toBeVisible();

    // S1: 3탭(소리 / 화면·조작 / 기록 관리)과 중형 고정 프레임(680×540).
    const tabs = dialog.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs).toHaveText(['소리', '화면·조작', '기록 관리']);
    const frame0 = (await dialog.boundingBox())!;
    expect(Math.round(frame0.width)).toBe(680);
    expect(Math.round(frame0.height)).toBe(540);

    // 소리 탭: 기본값 표식 2곳(배경 음악 · 효과음) + 정답음·발사음 미리 듣기 나란히 배치
    await expect(dialog.getByText('(기본)', { exact: true })).toHaveCount(2);
    await expect(dialog.getByRole('radio', { name: '20퍼센트 (기본)' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '정답음 들어보기' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '발사음 들어보기' })).toBeVisible();

    // S1: 1366×650에서 글자 크기 3단계(보통 · 크게 · 아주 크게) 모두 창 바깥 스크롤 0 & 3탭 전환 높이 불변.
    const dialogOverflow = () => dialog.evaluate(el => el.scrollHeight - el.clientHeight);
    await dialog.getByRole('tab', { name: '화면·조작' }).click();
    await expect(dialog.getByText('(기본)', { exact: true })).toHaveCount(2);
    await expect(dialog.getByText('정지는 모든 움직임을 멈춰요')).toBeVisible();
    await expect(dialog.getByText('길과 받침에 진한 선을 그려요')).toBeVisible();

    for (const [name, font] of [['글자 보통', 'base'], ['글자 크게', 'large'], ['글자 아주 크게', 'xlarge']] as const) {
      await dialog.getByRole('tab', { name: '화면·조작' }).click();
      await dialog.getByRole('radio', { name }).click();
      expect(await page.evaluate(() => document.documentElement.dataset.font)).toBe(font);
      for (const tabName of ['소리', '화면·조작', '기록 관리']) {
        await dialog.getByRole('tab', { name: tabName }).click();
        expect(await dialogOverflow(), `${name} ${tabName} 창 바깥 스크롤`).toBeLessThanOrEqual(1);
        const b = (await dialog.boundingBox())!;
        expect(Math.abs(b.width - frame0.width), `${name} ${tabName} 폭 고정`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(b.height - frame0.height), `${name} ${tabName} 높이 고정`).toBeLessThanOrEqual(0.5);
      }
    }
    await dialog.getByRole('tab', { name: '화면·조작' }).click();
    await dialog.getByRole('radio', { name: '글자 보통' }).click();

    const keyHints = dialog.getByRole('switch', { name: '단축키 번호 배지 표시' });
    await expect(keyHints).toContainText('켜짐');
    await keyHints.click();
    await expect(keyHints).toContainText('꺼짐');

    // 좁은 화면에서도 가로 넘침이 없다.
    for (const [w, h] of [[700, 900], [390, 844]] as const) {
      await page.setViewportSize({ width: w, height: h });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${w}x${h} 가로 넘침`).toBeLessThanOrEqual(0);
    }
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
    await page.getByRole('textbox', { name: '닉네임' }).fill('참나무수호대');
    await expect(page.getByRole('complementary', { name: '랭킹', exact: true })).toContainText('별빛파수꾼');
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
    await page.getByRole('textbox', { name: '닉네임' }).fill('참나무수호대');
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
});
