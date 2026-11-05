import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 서버 시험은 앱 시험(npm test)과 따로 돈다: npm run test:server
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
