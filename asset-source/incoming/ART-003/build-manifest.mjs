import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const evidence = [1, 2, 3].flatMap(part => JSON.parse(fs.readFileSync(path.join(dir, `technical-evidence-part${part}.json`), 'utf8')));
const regenerations = { 'tower.crossbow': 1, 'tower.mage': 1, 'tower.guardian': 2, 'tower.banner': 1 };
const assets = evidence.map(item => {
  const weapon = item.id.endsWith('.weapon');
  const file = `${item.id}.r1.png`;
  const sourceHash = sha(path.join(dir, 'sources', item.source));
  const artifactHash = sha(path.join(dir, file));
  if (sourceHash !== item.sourceInfo.sha256 || artifactHash !== item.artifactInfo.sha256) {
    throw new Error(`${item.id}: 제작 기록 이후 원본 또는 납품 PNG 변경`);
  }
  return {
    id: item.id, revision: 1, file,
    width: item.artifactInfo.width, height: item.artifactInfo.height,
    originX: 0.5, originY: weapon ? 0.5 : 0.8125,
    displayCells: weapon ? 0.8 : 1.1,
    ...(weapon ? { muzzle: item.muzzle } : {}),
    layer: weapon ? 'weapon' : 'body', frames: 1, status: 'draft',
    sourceHash, artifactHash,
    producer: 'OpenAI ChatGPT / gpt-image (원본 C2PA softwareAgent); image_gen.imagegen; 세부 모델 버전 미공개',
    license: '자체 생성, 프로젝트 전용',
    notes: `원본 sources/${item.source}. 재생성 ${regenerations[item.id] ?? 0}회. 생성 알파 보존, ImageMagick 축소·배치. 기술 증거 technical-evidence-part1~3.json. 자체 HOLD 없음, 총괄 검수 전 draft.`,
  };
});
const manifest = {
  schemaVersion: '1', jobId: 'ART-003',
  styleReferenceSha256: sha(path.join(root, 'docs/assets/design-41-kingdom-expedition.png')),
  assets,
};
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`ART-003 manifest 작성: ${assets.length}장, 원본·납품 해시 ${assets.length * 2}개 제작 기록과 일치, 모두 draft`);
