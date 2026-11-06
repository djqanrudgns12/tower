import { readFileSync } from 'node:fs';
import { expect, test } from './tower-browser';
import type { RunAnswer, RunRecord, QuestionHistory } from '../../src/persistence/db';
import maps from '../../docs/contracts/maps.candidate.v0.4.json' with { type: 'json' };

/**
 * 단계 5: 앱이 로컬 기록·랭킹 서버(server/, wrangler dev)에 붙었을 때. 평소 e2e(서버 없는 모드)에서는 건너뛴다.
 * 로컬 전용 DB·서버를 함께 준비: resource-guard run --profile test -- npm run test:api-connected
 * 이미 준비한 로컬 서버: E2E_PORT=5199 VITE_API_BASE=http://127.0.0.1:8799 E2E_API_BASE=http://127.0.0.1:8799
 *   npx playwright test tests/e2e/api-connected.spec.ts --workers=1
 */
const apiBase = process.env.E2E_API_BASE;

test.describe('새 서버 연결 모드', () => {
  test.skip(!apiBase, 'E2E_API_BASE(로컬 wrangler dev 주소)가 있을 때만 돈다');

  test('공개 기록을 켜면 기기 발급 → 홈 방문 → 랭킹을 새 서버로 보내고 홈 지표가 서버 값으로 바뀐다', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: true })));
    const calls: string[] = [];
    page.on('response', response => {
      if (!response.url().startsWith(apiBase!) || response.request().method() === 'OPTIONS') return;
      calls.push(`${response.request().method()} ${new URL(response.url()).pathname} ${response.status()}`);
    });
    await page.goto('/');
    await expect.poll(() => calls, { timeout: 20_000 }).toEqual(expect.arrayContaining([
      'POST /v1/device 200', 'POST /v1/lobby-visit 200', 'GET /v1/leaderboard 200',
    ]));
    const telemetry = page.getByRole('region', { name: '접속 현황' });
    // 서버에 붙으면 누적 접속이 "연결 대기" 대신 숫자로, 접속 수가 "오프라인" 대신 최근 5분 방문 기기 수로 나온다.
    await expect(telemetry).not.toContainText('연결 대기');
    await expect(telemetry).not.toContainText('오프라인');
    await expect(telemetry).toContainText(/\d+명/);
    const device = await page.evaluate(base => localStorage.getItem(`vocabulary-td.device:${base}`), apiBase!);
    expect(JSON.parse(device ?? 'null')).toMatchObject({ deviceId: expect.any(String), token: expect.stringMatching(/^v1\./) });

    // 다시 열면 저장한 기기 토큰을 다시 쓴다(발급은 한 번).
    calls.length = 0;
    await page.reload();
    await expect.poll(() => calls, { timeout: 20_000 }).toEqual(expect.arrayContaining(['POST /v1/lobby-visit 200']));
    expect(calls).not.toContain('POST /v1/device 200');
  });

  for (const grade of [4, 5, 6]) {
    test(`${grade}학년: 첫 웨이브 완료 → 판 종료 → 실제 서버 재채점과 전역 풀이 이력 저장`, async ({ page }, testInfo) => {
      test.setTimeout(180_000);
      const bank = JSON.parse(readFileSync(new URL(`../../src/content/questions/grade${grade}.json`, import.meta.url), 'utf8')) as {
        bankVersion: string;
        questions: { id: string; revision: number; stem: string; correctOptionId: string; options: { id: string; text: string }[] }[];
      };
      const answerByOptions = new Map<string, Set<string>>();
      for (const q of bank.questions) {
        const key = q.options.map(o => o.text).sort().join('|');
        const answers = answerByOptions.get(key) ?? new Set<string>();
        answers.add(q.options.find(o => o.id === q.correctOptionId)!.text);
        answerByOptions.set(key, answers);
      }
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.addInitScript(() => localStorage.setItem('vocabulary-td.settings', JSON.stringify({ shareRecords: true, soundOn: false })));
      await page.goto('/');
      await page.getByRole('textbox', { name: '닉네임' }).fill(`서버검수${grade}`);
      await page.getByRole('button', { name: '새 게임', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '새 게임' });
      await dialog.getByRole('radio', { name: `${grade}학년`, exact: true }).click();
      await dialog.getByRole('radio', { name: '보통', exact: true }).click();
      const start = dialog.getByRole('button', { name: '시작', exact: true });
      await expect(start).not.toHaveAttribute('aria-disabled', 'true');
      const started = page.waitForResponse(r => r.url() === `${apiBase}/v1/runs/start` && r.request().method() === 'POST');
      await start.click();
      expect((await started).status()).toBe(200);
      const panel = page.getByRole('region', { name: '어휘 문제' });
      const answerVisible = async () => {
        const texts = await panel.locator('[data-option-text]').allTextContents();
        const key = texts.sort().join('|');
        let answers = [...(answerByOptions.get(key) ?? [])];
        if (answers.length > 1) {
          // 유의어/반의어 문항처럼 같은 보기라도 질문에 따라 정답이 달라질 수 있다.
          const normalize = (text: string) => text.replace(/\(\s+\)/g, '').replace(/\s+/g, '');
          const stem = normalize(await panel.locator('p').first().locator(':scope > span').last().innerText());
          answers = [...new Set(bank.questions.filter(q => q.options.map(o => o.text).sort().join('|') === key && normalize(q.stem) === stem)
            .map(q => q.options.find(o => o.id === q.correctOptionId)!.text))];
        }
        expect(answers, '현재 공개 은행에서 보기의 정답을 하나로 찾는다').toHaveLength(1);
        const choice = panel.getByRole('button').filter({ has: page.locator('[data-option-text]', { hasText: new RegExp(`^${answers[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
        await choice.click();
        await expect(choice).toHaveAttribute('data-state', 'correct');
      };
      for (let i = 1; i <= 5; i++) {
        await expect(page.getByRole('img', { name: `준비 ${i}/5` })).toBeVisible();
        await answerVisible();
      }
      await expect(page.getByRole('button', { name: '전투 시작' })).toBeVisible();
      const map = maps.maps.find(m => m.grade === grade)!;
      // 길에 오래 닿는 중앙 자리 세 곳에 실제 조작으로 설치한다. 게임 상태·시계·서버 응답을 주입하지 않는다.
      const slots = map.slots.filter(s => s.y >= 2 && s.y <= 6).sort((a, b) => {
        const coverage = (slot: { x: number; y: number }) => map.pathCells.filter(c => Math.hypot(c[0]! - slot.x, c[1]! - slot.y) <= 2.5).length;
        return coverage(b) - coverage(a);
      }).slice(0, 3);
      for (const [index, slot] of slots.entries()) {
        const archer = page.getByRole('listbox', { name: '타워 칸' }).getByRole('option', { name: /궁수탑/ });
        if (await archer.getAttribute('aria-selected') !== 'true') await archer.click();
        const box = (await page.locator('canvas').boundingBox())!;
        const cell = box.width / map.gridWidth;
        await page.mouse.click(box.x + (slot.x + 0.5) * cell, box.y + (slot.y + 0.5) * cell);
        await expect(page.getByRole('application', { name: new RegExp(`타워 ${index + 1}개`) })).toBeVisible();
      }
      await page.getByRole('button', { name: '전투 시작' }).click();
      // 전투 중에도 실제 정답 입력. 웨이브가 끝나면 마무리 답안을 처리한 뒤 2웨이브 준비로 넘어간다.
      const deadline = Date.now() + 100_000;
      while (!(await page.getByRole('img', { name: '준비 1/2' }).isVisible()) && Date.now() < deadline) {
        const first = panel.getByRole('group', { name: '보기' }).getByRole('button').first();
        if (await first.isVisible() && await first.isEnabled()) await answerVisible();
        await page.waitForTimeout(1100);
      }
      await expect(page.getByRole('img', { name: '준비 1/2' })).toBeVisible();
      await page.getByRole('button', { name: '일시정지' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: '이번 판 끝내기' }).click();
      const submitted = page.waitForResponse(r => r.url() === `${apiBase}/v1/runs/submit` && r.request().method() === 'POST', { timeout: 20_000 });
      await page.getByRole('dialog').getByRole('button', { name: '끝내기', exact: true }).click();
      const response = await submitted;
      const result = await response.json();
      expect(result).toEqual({ ok: true, status: 'recorded', verificationLevel: 'question_regraded_combat_bounded' });
      expect(response.status()).toBe(200);
      const claim = response.request().postDataJSON();
      expect(claim).toMatchObject({ p_grade: grade, p_difficulty: 'Normal', p_completed_wave: 1, p_ended_at_wave: 2,
        p_bank_version: bank.bankVersion, p_map_id: map.id, p_content_mode: 'published', p_wrong: 0, p_skipped: 0 });
      const answers = claim.p_answers as RunAnswer[];
      expect(answers.filter(a => a.phase === 'prep' && a.wave === 1)).toHaveLength(5);
      expect(answers.filter(a => a.phase === 'battle').length).toBeGreaterThan(0);
      expect(new Set(answers.map(a => a.questionId)).size).toBe(answers.length);
      for (const a of answers) {
        const question = bank.questions.find(q => q.id === a.questionId && q.revision === a.revision);
        expect(question?.correctOptionId).toBe(a.choice);
      }
      const stored = await page.evaluate(() => new Promise<{ records: RunRecord[]; history: QuestionHistory[] }>((resolve, reject) => {
        const open = indexedDB.open('vocabulary-td');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['records', 'questionHistory'], 'readonly');
          const records = tx.objectStore('records').getAll();
          const history = tx.objectStore('questionHistory').getAll();
          tx.oncomplete = () => { db.close(); resolve({ records: records.result, history: history.result }); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      }));
      expect(stored.records).toHaveLength(1);
      expect(stored.records[0]).toMatchObject({ runId: claim.p_run_id, grade, completedWave: 1, bankVersion: bank.bankVersion, answers });
      expect(stored.history.map(q => q.questionId).sort()).toEqual(answers.map(a => a.questionId).sort());
      await expect.poll(() => page.evaluate(() => new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('vocabulary-td');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('syncQueue', 'readonly');
          const pending = tx.objectStore('syncQueue').count();
          tx.oncomplete = () => { db.close(); resolve(pending.result); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      }))).toBe(0);
      expect(errors).toEqual([]);
      await testInfo.attach(`grade-${grade}-regraded`, { contentType: 'application/json', body: JSON.stringify({
        grade, bankVersion: bank.bankVersion, mapId: map.id, completedWave: claim.p_completed_wave,
        answers: answers.length, activeTicks: claim.p_active_ticks, result, history: stored.history.length,
      }) });
    });
  }
});
