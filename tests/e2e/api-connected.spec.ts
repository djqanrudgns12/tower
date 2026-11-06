import { expect, test } from './tower-browser';

/**
 * 단계 5: 앱이 로컬 기록·랭킹 서버(server/, wrangler dev)에 붙었을 때. 평소 e2e(서버 없는 모드)에서는 건너뛴다.
 * 돌리는 법(포트는 예시, ALLOWED_ORIGINS에 vite 주소를 넣는다):
 *   npm run server:db:local
 *   npx wrangler dev --config server/wrangler.toml --local --port 8799 \
 *     --var PLAYER_SALT:<32자 이상 가짜 값> --var ALLOWED_ORIGINS:http://localhost:5199
 *   E2E_PORT=5199 VITE_API_BASE=http://127.0.0.1:8799 E2E_API_BASE=http://127.0.0.1:8799 npx playwright test tests/e2e/api-connected.spec.ts
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
});
