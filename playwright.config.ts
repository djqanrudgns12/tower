import { defineConfig, devices } from '@playwright/test';

// 작업 폴더 여러 곳에서 동시에 돌릴 때는 E2E_PORT로 포트를 나눈다. 이미 떠 있는 서버를 재사용하므로 다른 폴더의 서버와 겹치지 않게 한다.
const port = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'test-results/e2e',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  webServer: { command: `npx vite --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: true, timeout: 60_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
