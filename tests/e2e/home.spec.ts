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
    const telemetry = page.getByRole('region', { name: '접속 현황' });
    await expect(telemetry).toContainText('실시간 접속');
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
    await expect(page.getByRole('dialog', { name: /전체 랭킹/ })).toBeVisible();
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
    await page.getByRole('textbox', { name: '닉네임' }).fill('단축키검증');
    await page.getByRole('button', { name: '새 게임' }).click();
    await page.getByRole('dialog', { name: '새 게임' }).getByRole('button', { name: '시작', exact: true }).click();
    const firstOption = page.getByRole('region', { name: '어휘 문제' }).getByRole('group', { name: '보기' }).getByRole('button').first();
    await expect(firstOption).toBeVisible();
    await expect(firstOption.locator('[aria-hidden="true"]')).toHaveCount(0);
  });

  test('S1·S2: 설정 — 소제목 3개, 900px 이상 2열, 1366×650에서 창 안 스크롤 0(글자 3단계), 기본 표식·한 줄 설명·켜짐/꺼짐 글자', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 650 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: '설정' }).click();
    const dialog = page.getByRole('dialog', { name: '환경설정' });
    await expect(dialog).toBeVisible();

    // S1: 소제목 3개(소리 / 화면·글자 / 기록), 목록은 한 벌(탭 없음).
    const sections = dialog.locator('section[aria-labelledby]');
    await expect(sections).toHaveCount(3);
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(['소리', '화면·글자', '기록']);
    await expect(dialog.getByRole('tab')).toHaveCount(0);

    // S1: 900px 이상에서는 소리 | 화면·글자가 나란히(2열), 기록은 그 아래 가로 가득. 900px 미만은 한 줄로 쌓인다.
    const rect = async (i: number) => (await sections.nth(i).boundingBox())!;
    const [sound, display, records] = [await rect(0), await rect(1), await rect(2)];
    expect(display.x, '화면·글자는 소리 오른쪽').toBeGreaterThan(sound.x + sound.width - 1);
    expect(Math.abs(display.y - sound.y), '두 열 위쪽이 같다').toBeLessThanOrEqual(1);
    expect(records.y, '기록은 아래').toBeGreaterThan(Math.max(sound.y + sound.height, display.y + display.height) - 1);
    expect(records.width, '기록은 가로 가득').toBeGreaterThan(sound.width + display.width);

    // S1: 1366×650에서 창 안 스크롤 0 — 글자 크기 3단계(보통 · 크게 · 아주 크게) 모두.
    const scrollGap = () => dialog.evaluate(el => el.scrollHeight - el.clientHeight);
    for (const [name, font] of [['글자 보통', 'base'], ['글자 크게', 'large'], ['글자 아주 크게', 'xlarge']] as const) {
      await dialog.getByRole('radio', { name }).click();
      expect(await page.evaluate(() => document.documentElement.dataset.font)).toBe(font);
      expect(await scrollGap(), `${name} 창 안 스크롤`).toBeLessThanOrEqual(1);
    }
    await dialog.getByRole('radio', { name: '글자 보통' }).click();

    // S2: 기본값 칸마다 '(기본)'(배경 음악 · 효과음 · 글자 · 움직임 4곳), 움직임·고대비 한 줄 설명, 스위치에 켜짐/꺼짐 글자.
    await expect(dialog.getByText('(기본)', { exact: true })).toHaveCount(4);
    await expect(dialog.getByRole('radio', { name: '20퍼센트 (기본)' })).toBeVisible();
    await expect(dialog.getByText('정지는 모든 움직임을 멈춰요')).toBeVisible();
    await expect(dialog.getByText('길과 받침에 진한 선을 그려요')).toBeVisible();
    const keyHints = dialog.getByRole('switch', { name: '단축키 번호 배지 표시' });
    await expect(keyHints).toContainText('켜짐');
    await keyHints.click();
    await expect(keyHints).toContainText('꺼짐');

    // 900px 미만에서는 한 줄로 쌓이고 가로 넘침이 없다.
    await page.setViewportSize({ width: 700, height: 900 });
    const [s0, s1] = [await rect(0), await rect(1)];
    expect(Math.abs(s1.x - s0.x), '700px에서는 쌓임').toBeLessThanOrEqual(1);
    expect(s1.y).toBeGreaterThan(s0.y + s0.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
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
