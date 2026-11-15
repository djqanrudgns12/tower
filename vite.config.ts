import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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

const stampServiceWorker: Plugin = {
  name: 'tower-stamp-service-worker',
  apply: 'build',
  closeBundle() {
    const distDir = path.resolve(process.cwd(), 'dist');
    const swPath = path.join(distDir, 'sw.js');
    if (!existsSync(swPath)) return;
    const hash = createHash('sha256');
    const assetsDir = path.join(distDir, 'assets');
    if (existsSync(assetsDir)) {
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir).sort()) {
          const full = path.join(dir, entry);
          const st = statSync(full);
          if (st.isDirectory()) walk(full);
          else hash.update(`${path.relative(distDir, full)}:${st.size}\n`);
        }
      };
      walk(assetsDir);
    }
    const indexHtml = path.join(distDir, 'index.html');
    if (existsSync(indexHtml)) hash.update(readFileSync(indexHtml));
    const stamp = hash.digest('hex').slice(0, 12);
    const swSource = readFileSync(swPath, 'utf8');
    writeFileSync(swPath, swSource.replace('__VOCA_SW_BUILD__', stamp), 'utf8');
  },
};

export default defineConfig({
  plugins: [react(), hostGuardIdentity, stampServiceWorker],
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
