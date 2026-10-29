import fs from 'node:fs';
import path from 'node:path';
import { runnerImport } from 'vite';

// 승인 레지스트리·게시 은행 빌드 실행기. 판정은 tools/content/bankBuild.ts가 한다.
// 사용: npm run build:bank → content-source/approvals/registry.json을 다시 쓰고,
// 학년별 승인 문항이 30개 이상이면 src/content/questions/grade<N>.json(published)을 쓴다.
const root = path.resolve(import.meta.dirname, '..');
const { module: b } = await runnerImport(path.join(root, 'tools/content/bankBuild.ts'), { configFile: false, logLevel: 'error', root });

const batches = b.loadBatches(root);
const registry = b.buildRegistry(batches);
const registryPath = path.join(root, 'content-source/approvals/registry.json');
fs.mkdirSync(path.dirname(registryPath), { recursive: true });
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

console.table(registry.entries.map(e => ({ id: `${e.questionId}@${e.revision}`, batch: e.batchId, decision: e.decision, reasons: e.reasons.join(' · ') })));
console.log(`승인 ${registry.approved} · 격리 ${registry.quarantined} → ${path.relative(root, registryPath)}`);
for (const grade of [...new Set(batches.flatMap(x => x.drafts.map(q => q.grade)))].sort()) {
  const r = b.buildBank(batches, registry, grade);
  if (r.bank) {
    const out = path.join(root, `src/content/questions/grade${grade}.json`);
    fs.writeFileSync(out, JSON.stringify(r.bank, null, 2) + '\n');
    console.log(`${r.note} → ${path.relative(root, out)}`);
  } else console.log(r.note);
}
