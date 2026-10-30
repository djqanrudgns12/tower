import fs from 'node:fs';
import path from 'node:path';
import { runnerImport } from 'vite';

// 승인 레지스트리·게시 은행·후보 은행 빌드 실행기. 판정은 tools/content/bankBuild.ts가 한다.
// 사용: npm run build:bank → content-source/approvals/registry.json과 candidate-registry.json을 다시 쓰고,
// 학년별 공동검수 승인 문항이 30개 이상이면 grade<N>.json(published)을,
// 새 문맥 블라인드 검증 통과 후보 문항이 더 많고 30개 이상이면 grade<N>.candidate.json(verified_candidate)을 쓴다.
const root = path.resolve(import.meta.dirname, '..');
const { module: b } = await runnerImport(path.join(root, 'tools/content/bankBuild.ts'), { configFile: false, logLevel: 'error', root });

const batches = b.loadBatches(root);
const registry = b.buildRegistry(batches);
const candidateRegistry = b.buildCandidateRegistry(batches);

const registryPath = path.join(root, 'content-source/approvals/registry.json');
const candidateRegistryPath = path.join(root, 'content-source/approvals/candidate-registry.json');
fs.mkdirSync(path.dirname(registryPath), { recursive: true });
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
fs.writeFileSync(candidateRegistryPath, JSON.stringify(candidateRegistry, null, 2) + '\n');

console.log(`공동검수 승인 ${registry.approved} · 격리 ${registry.quarantined} → ${path.relative(root, registryPath)}`);
console.log(`후보검증 승인 ${candidateRegistry.approved} · 격리 ${candidateRegistry.quarantined} → ${path.relative(root, candidateRegistryPath)}`);

const practice = b.buildPracticeBank(batches, registry);
if (practice.bank) fs.writeFileSync(path.join(root, 'src/content/questions/practice.json'), JSON.stringify(practice.bank, null, 2) + '\n');
console.log(practice.note);

const grades = [...new Set(batches.flatMap(x => x.drafts.map(q => q.grade)))].sort();
for (const grade of grades) {
  const r = b.buildBank(batches, registry, grade);
  if (r.bank) {
    const out = path.join(root, `src/content/questions/grade${grade}.json`);
    fs.writeFileSync(out, JSON.stringify(r.bank, null, 2) + '\n');
    console.log(`${r.note} → ${path.relative(root, out)}`);
  } else console.log(r.note);

  const cand = b.buildCandidateBank(batches, registry, candidateRegistry, grade);
  const candOut = path.join(root, `src/content/questions/grade${grade}.candidate.json`);
  if (cand.bank) {
    fs.writeFileSync(candOut, JSON.stringify(cand.bank, null, 2) + '\n');
    console.log(`${cand.note} → ${path.relative(root, candOut)}`);
  } else {
    if (fs.existsSync(candOut)) fs.unlinkSync(candOut);
    console.log(cand.note);
  }
}
