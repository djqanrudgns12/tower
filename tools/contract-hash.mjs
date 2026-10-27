import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// 작업 패키지 발행 직전에 입력 계약의 실제 SHA-256을 찍는다. 추정 hash를 쓰지 않는다(model_work_orders §3).
// 사용: node tools/contract-hash.mjs ART-SAMPLE-001  → REQUEST.md의 inputFiles 목록을 읽어 YAML로 출력
const root = path.resolve(import.meta.dirname, '..');
const jobId = process.argv[2];
if (!jobId) { console.error('사용: node tools/contract-hash.mjs <jobId>'); process.exit(2); }
const request = fs.readFileSync(path.join(root, 'docs/work-packages', jobId, 'REQUEST.md'), 'utf8');
const block = request.slice(request.indexOf('inputFiles:'), request.indexOf('\n', request.indexOf('allowedPaths:')) === -1 ? undefined : request.indexOf('allowedPaths:'));
const files = [...block.matchAll(/^\s+- ([^\s#]+)/gm)].map(m => m[1]);
const missing = files.filter(f => !fs.existsSync(path.join(root, f)) || !fs.statSync(path.join(root, f)).isFile());
if (missing.length) { console.error(`inputFiles에 없는 파일: ${missing.join(', ')}`); process.exit(1); }
const readGit = p => (fs.existsSync(path.join(root, '.git', p)) ? fs.readFileSync(path.join(root, '.git', p), 'utf8').trim() : null);
const headRef = readGit('HEAD') ?? 'unknown';
const head = headRef.startsWith('ref: ') ? `${readGit(headRef.slice(5)) ?? 'unborn'} (${headRef.slice(5)})` : headRef;
console.log(`jobId: ${jobId}\ngeneratedAt: ${new Date().toISOString()}\ngitHead: ${head}\ncontractHashes:`);
for (const f of files) console.log(`  ${f}: ${crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')}`);
