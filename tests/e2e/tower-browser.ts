import { createConnection, type Socket } from 'node:net';
import { test as base } from '@playwright/test';
import type { ConnectOverCDPTransport } from 'playwright-core';

const MAX_FRAME = 8 * 1024 * 1024;

function confirmation() {
  let resolve!: (confirmed: boolean) => void;
  const promise = new Promise<boolean>((notify) => { resolve = notify; });
  return { promise, resolve };
}

export class TowerBrowserTransport implements ConnectOverCDPTransport {
  onmessage?: (message: object) => void;
  onclose?: (reason?: string) => void;
  private readonly socket: Socket;
  private readonly ready = confirmation();
  private readonly finished = confirmation();
  private pending = '';
  private detached = false;

  constructor(path: string, token: string) {
    this.socket = createConnection(path);
    this.socket.setEncoding('utf8');
    this.socket.on('error', () => this.socket.destroy());
    this.socket.on('close', () => {
      this.ready.resolve(false);
      this.finished.resolve(false);
      this.close();
    });
    this.socket.on('connect', () => this.write({ kind: 'open', token }));
    this.socket.on('data', (chunk: string) => {
      this.pending += chunk;
      let end: number;
      try {
        while ((end = this.pending.indexOf('\n')) >= 0) {
          const line = this.pending.slice(0, end);
          this.pending = this.pending.slice(end + 1);
          if (Buffer.byteLength(line) > MAX_FRAME) throw Error('TOWER_BROWSER_FRAME_LIMIT');
          const frame = JSON.parse(line);
          if (frame?.kind === 'ready') this.ready.resolve(true);
          else if (frame?.kind === 'finished') this.finished.resolve(true);
          else if (frame?.kind === 'cdp' && frame.message && typeof frame.message === 'object')
            this.onmessage?.(frame.message);
          else throw Error('TOWER_BROWSER_FRAME_INVALID');
        }
        if (Buffer.byteLength(this.pending) > MAX_FRAME) throw Error('TOWER_BROWSER_FRAME_LIMIT');
      } catch {
        this.socket.destroy();
      }
    });
  }

  private write(message: object): void {
    const line = JSON.stringify(message) + '\n';
    if (this.socket.destroyed || this.socket.writableLength + Buffer.byteLength(line) > MAX_FRAME)
      throw Error('TOWER_BROWSER_TRANSPORT_UNAVAILABLE');
    this.socket.write(line);
  }

  private async confirm(response: Promise<boolean>): Promise<void> {
    const deadline = setTimeout(() => this.socket.destroy(), 10000);
    try {
      if (!(await response)) throw Error('TOWER_BROWSER_TRANSPORT_UNCONFIRMED');
    } finally {
      clearTimeout(deadline);
    }
  }

  waitReady(): Promise<void> { return this.confirm(this.ready.promise); }

  send(message: object): void {
    if (this.detached) throw Error('TOWER_BROWSER_TRANSPORT_DETACHED');
    this.write({ kind: 'cdp', message });
  }

  close(): void {
    if (this.detached) return;
    this.detached = true;
    queueMicrotask(() => this.onclose?.());
  }

  async finish(): Promise<void> {
    if (!this.detached) throw Error('TOWER_BROWSER_WORKER_STILL_CONNECTED');
    this.write({ kind: 'finish' });
    await this.confirm(this.finished.promise);
  }

  disconnect(): void { this.socket.destroy(); }
}

export const test = process.env.TOWER_HOST_GUARD_TEST_URL ? base.extend({
  browser: [async ({ playwright, browserName }, provideBrowser) => {
    const { TOWER_BROWSER_SOCKET: path, TOWER_BROWSER_TOKEN: token } = process.env;
    if (browserName !== 'chromium' || !path || !token) throw Error('TOWER_BROWSER_SCOPE_REQUIRED');
    const transport = new TowerBrowserTransport(path, token);
    try {
      await transport.waitReady();
      const browser = await playwright.chromium.connectOverCDP(transport, { isLocal: true, noDefaults: true });
      try {
        await provideBrowser(browser);
      } finally {
        const connected = browser.isConnected();
        await browser.close();
        if (connected) await transport.finish();
      }
    } finally {
      transport.disconnect();
    }
  }, { scope: 'worker' }],
}) : base;

export { expect } from '@playwright/test';
export type { Locator, Page } from '@playwright/test';
