import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('랜딩 페이지(방향 2-A: 왕국 참나무 작전실) 통합 검증', () => {
  test('L01·L04·L06·L07·L08: 연습 권유·적용됨 버튼 제거, 직결 별명 데크·랜덤 추천·자동 연동·새 게임 무마찰 승계', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      indexedDB.deleteDatabase('vocabulary-td');
      localStorage.clear();
    });
    await page.reload();

    // L01: 홈 화면에 '처음이라면 연습부터', '연습하기', 불필요한 '적용/적용됨' 버튼이 없어야 한다.
    await expect(page.getByRole('button', { name: '처음이라면 연습부터' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '연습하기' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^적용/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '새 게임' })).toBeVisible();

    // 4대 지표 영역 표시 확인
    const telemetry = page.getByRole('region', { name: '왕국 수호 현황' });
    await expect(telemetry).toContainText('실시간 접속');
    await expect(telemetry).toContainText('오늘 플레이');
    await expect(telemetry).toContainText('누적 접속');
    await expect(telemetry).toContainText('누적 플레이');

    // L06: 별명 미입력 상태에서 '새 게임' 클릭 시 모달이 열리지 않고 입력칸에 포커스가 간다.
    const nickInput = page.getByRole('textbox', { name: '출정 별명' });
    await page.getByRole('button', { name: '새 게임' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(nickInput).toBeFocused();
    await expect(page.locator('#landingNickStatus')).toContainText('출정하기 전에 별명');

    // L05: '랜덤 추천' 클릭 시 재치 있는 별명이 들어가고 연속 클릭 시 다른 별명으로 바뀌며 내 순위 도크와 즉시 연동된다.
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

    // L07·L08: 새 별명을 타이핑하고 곧바로 '새 게임'을 눌러도 자동 승계되며 모달 안에는 중복 textbox가 없다.
    await nickInput.fill('참나무수호대');
    await page.getByRole('button', { name: '새 게임' }).click();
    const dialog = page.getByRole('dialog', { name: '새 게임 출정 설정' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('참나무수호대');
    await expect(dialog.getByRole('textbox')).toHaveCount(0);

    // '별명 바꾸기'를 누르면 모달이 닫히고 홈의 출정 별명 입력칸으로 포커스가 돌아간다.
    await dialog.getByRole('button', { name: '별명 바꾸기' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(nickInput).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('L09·L10·L12·L14·L17: 비석 낱말 학습 카드, 설정 3탭(별명 배제·인게임 배지 연동), 4분류 통합 랭킹', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // L09·L10: 오늘의 낱말 공부 패널(뜻 가리기 · <> 순서 이동 · 갯수 표시 제거, 랜덤 단일 버튼으로 서버 전체 낱말 순환)
    await expect(page.getByRole('button', { name: /이어하기/ })).toHaveCount(0);
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

    // L12·L13·L14: 환경설정 모달(별명 입력칸·대원 전환 0개) 및 단축키 번호 배지 인게임 실제 연동
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await expect(settingsDialog).toBeVisible();
    await expect(settingsDialog.getByRole('textbox')).toHaveCount(0);
    await expect(settingsDialog.getByText(/대원 전환|별명 변경/)).toHaveCount(0);

    await settingsDialog.getByRole('button', { name: '정답음 들어보기' }).click();
    await settingsDialog.getByRole('tab', { name: '화면 · 글자 크기' }).click();
    await settingsDialog.getByRole('radio', { name: '글자 크게' }).click();
    expect(await page.evaluate(() => document.documentElement.dataset.font)).toBe('large');
    await settingsDialog.getByRole('radio', { name: '글자 보통' }).click();

    await settingsDialog.getByRole('tab', { name: '전투 보조 · 기록' }).click();
    await settingsDialog.getByRole('radiogroup', { name: '단축키 번호 배지 표시' }).getByRole('radio', { name: '꺼짐' }).click();
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    // 게임 진입 후 QuestionPanel 보기 옆 번호 배지(1~4)가 실제로 숨겨졌는지 확인
    await page.getByRole('textbox', { name: '출정 별명' }).fill('단축키검증');
    await page.getByRole('button', { name: '새 게임' }).click();
    await page.getByRole('button', { name: '시작하기' }).click();
    const firstOption = page.getByRole('region', { name: '어휘 문제' }).getByRole('group', { name: '보기' }).getByRole('button').first();
    await expect(firstOption).toBeVisible();
    await expect(firstOption.locator('[aria-hidden="true"]')).toHaveCount(0);
  });

  test('L20·L21·L22: 전 뷰포트 가로 넘침 0px, 크롬북 첫 화면 CTA 노출, axe 위반 0건, §12.8 그라디언트·블러 0건', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // 홈 기본 axe 검사(캔버스 제외 없이 전수 통과) 및 샘플 기록 적재 시 랭킹 보드 렌더링 확인
    await page.evaluate(async () => {
      const req = indexedDB.open('vocabulary-td', 2);
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
    await page.getByRole('textbox', { name: '출정 별명' }).fill('참나무수호대');
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
    await page.getByRole('textbox', { name: '출정 별명' }).fill('참나무수호대');
    await page.getByRole('button', { name: '새 게임' }).click();
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

  test('G01~G16: 사용 설명서 4장 페이지네이션·버튼 최소화·실자산 무대·크롬북 무스크롤·§12.8·axe 전수 검증', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const guideTrigger = page.getByRole('button', { name: '사용 설명서' });
    await guideTrigger.click();

    const dialog = page.getByRole('dialog', { name: '사용 설명서' });
    await expect(dialog).toBeVisible();

    // G01 & G02: '연습 판 해 보기'·'처음으로' 0개, 하단 footer 버튼은 오직 '이전 장'·'다음 장' 2개뿐이다.
    await expect(dialog.getByRole('button', { name: '연습 판 해 보기' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: '처음으로' })).toHaveCount(0);
    const footer = dialog.locator('footer');
    await expect(footer.getByRole('button')).toHaveCount(2);
    const prevBtn = footer.getByRole('button', { name: '이전 장' });
    const nextBtn = footer.getByRole('button', { name: '다음 장' });
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();
    await expect(footer).toContainText('1 / 4');

    // 1장 검증 + 삽화 로드 + axe 검사
    await expect(dialog).toContainText('문제로 군자금을 모아 타워를 세우고');
    await expect(dialog).not.toContainText(/저장하고 나가기|이어하/);
    await expect.poll(async () => dialog.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    const axe1 = await new AxeBuilder({ page }).analyze();
    expect(axe1.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/guide-ch1-desktop.png' });

    // G07: '다음 장' 클릭 → 2장 전환
    await nextBtn.click();
    await expect(footer).toContainText('2 / 4');
    await expect(prevBtn).toBeEnabled();
    await expect(dialog).toContainText('모르겠어요');
    await expect(dialog).not.toContainText(/저장하고 나가기|이어하/);
    await dialog.getByRole('button', { name: /연속 버닝/ }).click();
    await expect.poll(async () => dialog.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    const axe2 = await new AxeBuilder({ page }).analyze();
    expect(axe2.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/guide-ch2-desktop.png' });

    // G08: 키보드 ArrowRight → 3장 전환 + 타워 전환 인터랙션
    await page.keyboard.press('ArrowRight');
    await expect(footer).toContainText('3 / 4');
    await expect(dialog).toContainText('밝은 흙길');
    await expect(dialog).toContainText('60%');
    await dialog.getByRole('button', { name: '포탑' }).click();
    await expect(dialog).toContainText('확산');
    await expect.poll(async () => dialog.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    const axe3 = await new AxeBuilder({ page }).analyze();
    expect(axe3.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/guide-ch3-desktop.png' });

    // 상단 목차 탭 클릭 → 4장 전환 + 경계 비활성 확인
    await dialog.getByRole('tab', { name: '4. 출정·조작' }).click();
    await expect(footer).toContainText('4 / 4');
    await expect(nextBtn).toBeDisabled();
    await expect(dialog).toContainText('속담·관용구·방언');
    await expect(dialog).toContainText('이번 판 끝내기');
    await page.keyboard.press('3');
    await expect(dialog).toContainText('보기 3번 즉시 선택');
    await expect.poll(async () => dialog.locator('img').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(300);
    const axe4 = await new AxeBuilder({ page }).analyze();
    expect(axe4.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: 'test-results/shots/guide-ch4-desktop.png' });

    // G14: PRD §12.8 스타일 전수 검사 (그라데이션 0, 블러 0, 허용 반경 0/4/8/999px만 사용)
    const guideStyleIssues = await dialog.evaluate(root => {
      const allowedRadii = new Set(['0px', '4px', '8px', '999px']);
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

    // G12: 학교 크롬북(1366×650) 저높이 뷰포트에서 1~4장 모두 모달 내부 세로 스크롤 없이 수납된다.
    await page.setViewportSize({ width: 1366, height: 650 });
    for (const tabName of ['1. 한 판 흐름', '2. 문제·버닝', '3. 타워·진화', '4. 출정·조작'] as const) {
      await dialog.getByRole('tab', { name: tabName }).click();
      const scrollDelta = await dialog.evaluate(root => {
        const body = root.firstElementChild as HTMLElement;
        return body.scrollHeight - body.clientHeight;
      });
      expect(scrollDelta, `1366x650 ${tabName} 세로 스크롤 발생`).toBeLessThanOrEqual(1);
      if (tabName === '1. 한 판 흐름') {
        await page.screenshot({ path: 'test-results/shots/guide-ch1-chromebook.png' });
      }
    }

    // G13: 모바일(390×844)·초소형(320×568) 및 글자 아주 크게(xlarge) 가로 넘침 0px 검증
    await page.evaluate(() => { document.documentElement.dataset.font = 'xlarge'; });
    for (const [w, h] of [[390, 844], [320, 568]] as const) {
      await page.setViewportSize({ width: w, height: h });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${w}x${h} xlarge overflow`).toBeLessThanOrEqual(0);
      if (w === 390) {
        await page.screenshot({ path: 'test-results/shots/guide-ch1-mobile.png' });
      }
    }
    await page.evaluate(() => { document.documentElement.dataset.font = 'base'; });

    // G08: Escape 입력 시 모달이 닫히고 홈 상단 '사용 설명서' 버튼으로 포커스가 복귀한다.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(guideTrigger).toBeFocused();

    // G11: 환경설정에서 배경 움직임 '정지(minimal)' + 고대비 지도를 켜면 설명서 캔버스가 정지 대표 장면을 유지한다.
    await page.getByRole('button', { name: '설정' }).click();
    const settingsDialog = page.getByRole('dialog', { name: '환경설정' });
    await settingsDialog.getByRole('tab', { name: '화면 · 글자 크기' }).click();
    await settingsDialog.getByRole('radiogroup', { name: '배경 움직임 단계' }).getByRole('radio', { name: '정지' }).click();
    await settingsDialog.getByRole('radiogroup', { name: '전장 길·받침 고대비 윤곽선' }).getByRole('radio', { name: '켜짐' }).click();
    await settingsDialog.getByRole('button', { name: '닫기' }).click();

    await guideTrigger.click();
    await expect(dialog).toBeVisible();
    const snapCanvas = () =>
      dialog.getByRole('img', { name: '4단계 수비 순환 실시간 시연' }).locator('canvas').evaluate(
        (el: HTMLCanvasElement) => el.toDataURL(),
      );
    await page.waitForTimeout(200);
    const f1 = await snapCanvas();
    await page.waitForTimeout(250);
    const f2 = await snapCanvas();
    expect(f2).toBe(f1);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
