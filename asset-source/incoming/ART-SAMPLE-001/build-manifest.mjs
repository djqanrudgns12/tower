import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8').replace(/^\uFEFF/,''));
const specs=read('requested-specs.json');
const evidence=read('technical-evidence.json');
const holds=fs.existsSync(path.join(dir,'holds.json'))?read('holds.json'):[];
const assets=[];
for(const s of specs){
  if(holds.some(h=>h.id===s.id))continue;
  const e=evidence.find(e=>e.id===s.id);
  if(!e)throw new Error(`Missing evidence: ${s.id}`);
  const bytes=fs.readFileSync(path.join(dir,e.file));
  if(bytes[25]!==6 || bytes.readUInt32BE(16)!==s.size || bytes.readUInt32BE(20)!==s.size)throw new Error(`Wrong PNG: ${s.id}`);
  for(const [file,expected] of [[e.file,e.artifactHash],[e.source,e.sourceHash]]){
    if(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')!==expected)throw new Error(`Hash mismatch: ${file}`);
  }
  assets.push({id:s.id,revision:1,file:e.file,width:s.size,height:s.size,originX:s.origin[0],originY:s.origin[1],displayCells:s.display,
    ...(e.transform.muzzle?{muzzle:e.transform.muzzle}:{}),layer:s.layer,frames:1,status:'draft',sourceHash:e.sourceHash,artifactHash:e.artifactHash,
    producer:'OpenAI ChatGPT / gpt-image (embedded C2PA softwareAgent); image_gen.imagegen; exact backend version not disclosed',
    license:'자체 생성, 프로젝트 전용',notes:`원본 ${e.source}. 실제 생성 알파 보존, System.Drawing 고품질 축소·기준점 배치. ${s.base?'동일 기준 원본 '+s.base+'에서 파생. ':''}미술·게임 내 승인 전 draft.`});
}
const manifest={schemaVersion:'1',jobId:'ART-SAMPLE-001',styleReferenceSha256:'5150cb167deb846dfde633f6e5b0468a0053072435f2d92c485b869801643b13',assets};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`manifest.json: ${assets.length} draft assets; ${holds.length} HOLD; RGBA color type 6 and source/artifact SHA-256 verified`);
