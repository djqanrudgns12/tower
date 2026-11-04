import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { runnerImport } from 'vite';

// simulate:gate 워커: 작업(GateJob)을 받아 제품 engine으로 돌리고 결과를 돌려준다. TS는 vite로 읽는다.
const root = path.resolve(import.meta.dirname, '../..');
const load = file => runnerImport(path.join(root, file), { configFile: false, logLevel: 'error', root }).then(r => r.module);
const jobs = await load('tools/sim/gateJobs.ts');
const balance = jobs.withOverrides(workerData?.sets ?? []);

parentPort.on('message', msg => {
  if (msg.type !== 'job') return;
  try {
    parentPort.postMessage({ type: 'done', id: msg.id, result: jobs.runJob(msg.job, balance) });
  } catch (e) {
    parentPort.postMessage({ type: 'error', id: msg.id, job: msg.job, error: e instanceof Error ? e.stack ?? e.message : String(e) });
  }
});
parentPort.postMessage({ type: 'ready' });
