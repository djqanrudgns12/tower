import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(dir,'../../..');
const batch=process.argv[2]??'part1';
if(!['part1','part2','part3'].includes(batch))throw Error('지원하지 않는 제작 범위: '+batch);
const ids=['archer','cannon','frost','crossbow','mage',...(batch!=='part1'?['lightning','flame']:[]),...(batch==='part3'?['spear','guardian','banner']:[])];
const src=(id,weapon=false)=>path.join(['crossbow','mage','lightning','flame','spear','guardian','banner'].includes(id)?dir:path.join(root,'public/assets'),`tower.${id}${weapon?'.weapon':''}.r1.png`);
const args=['-size',`${batch==='part3'?1340:batch==='part2'?1000:760}x600`,'xc:#d8d8c8'];
for(const [row,size] of [32,48,64].entries()){
 const y=55+row*85;
 ids.forEach((id,i)=>args.push('(',src(id),'-resize',`${size}x${size}`,')','-geometry',`+${154+i*116}+${y}`,'-composite'));
}
for(const [row,cell] of [32,48,64].entries()){
 const y=315+row*85;
 ids.forEach((id,i)=>{
  const x=175+i*116, ground=y+cell*0.6;
  const body=cell*1.1,weapon=cell*0.8;
  args.push('(',src(id),'-resize',`${Math.round(body)}x${Math.round(body)}`,')','-geometry',`+${Math.round(x-body/2)}+${Math.round(ground-body*0.8125)}`,'-composite');
  // 현재 BattleScene: 몸체 y+0.32칸, 무기 y-0.32칸. 따라서 바닥과 회전축 간격은 0.64칸.
  if(id!=='banner')args.push('(',src(id,true),'-resize',`${Math.round(weapon)}x${Math.round(weapon)}`,')','-geometry',`+${Math.round(x-weapon/2)}+${Math.round(ground-cell*0.64-weapon/2)}`,'-composite');
 });
}
args.push(path.join(dir,`contact-sheet-${batch}.png`));
execFileSync('magick',args);
