import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import type { Plugin } from 'vite';

const hostGuardIdentity: Plugin = {
  name: 'tower-host-guard-identity',
  configureServer(server) {
    const root = createHash('sha256').update(realpathSync(server.config.root)).digest('hex');
    const generation = randomUUID();
    server.middlewares.use((request, response, next) => {
      if (request.method !== 'GET' || request.url !== '/__tower_host_guard') return next();
      const peer = request.socket.remoteAddress;
      if (peer !== '127.0.0.1' && peer !== '::1' && peer !== '::ffff:127.0.0.1') return next();
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify({ root, generation }));
    });
  },
};

export default defineConfig({
  plugins: [react(), hostGuardIdentity],
  build: {
    target: 'es2023',
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/review/**/*.test.ts'],
    environment: 'node',
  },
});
