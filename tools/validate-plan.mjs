import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'docs/contracts/maps.candidate.v0.2.json'),'utf8'));
const checks=[];
const check=(name,fn)=>{fn(); checks.push({name,status:'passed'});};
const maps=[];
check('map count and grade coverage',()=>assert.deepEqual(data.maps.map(m=>m.grade),[3,4,5,6]));
for(const m of data.maps){
 const keys=m.pathCells.map(p=>p.join(','));
 check(`${m.id}: unique orthogonal route and length`,()=>{
  assert.equal(new Set(keys).size,keys.length);assert.equal(keys.length-1,m.pathLength);
  m.pathCells.forEach(([x,y],i)=>{assert(x>=0&&x<7&&y>=0&&y<7);if(i){const [px,py]=m.pathCells[i-1];assert.equal(Math.abs(x-px)+Math.abs(y-py),1);}});
 });
 check(`${m.id}: 20 distinct in-bounds off-path slots`,()=>{
  assert.equal(m.slots.length,20);assert.equal(new Set(m.slots.map(s=>s.id)).size,20);assert.equal(new Set(m.slots.map(s=>`${s.x},${s.y}`)).size,20);
  for(const s of m.slots){assert(s.x>=0&&s.x<7&&s.y>=0&&s.y<7);assert(!keys.includes(`${s.x},${s.y}`));}
 });
 const distances=m.slots.map(s=>Math.sqrt(Math.min(...m.pathCells.map(([x,y])=>(s.x-x)**2+(s.y-y)**2))));
 check(`${m.id}: all slots reach route with a base tower`,()=>assert(distances.every(d=>d<=3.2)));
 maps.push({id:m.id,pathLength:m.pathLength,slotCount:20,maxNearestPathDistance:Math.max(...distances),spearReachableSlots:distances.filter(d=>d<=1.3).length,baseTravelSeconds:24,balanceValidated:false});
}
const c=60,round5=x=>5*Math.floor(x/5+0.5);
const upgrades=[.65,1.15,1.8,2.6].map(n=>round5(c*n));
check('archer upgrade total 435 and sale 261',()=>{assert.deepEqual(upgrades,[40,70,110,155]);assert.equal(c+upgrades.reduce((a,b)=>a+b,0),435);assert.equal(Math.floor(435*.6),261);});
const expectedPt=[[10,5],[15,8],[20,10],[30,15]].map(([r,p])=>r/4-p*3/4);
check('random guessing vocabulary PT negative in four difficulties',()=>assert(expectedPt.every(x=>x<0)));
check('wave1 no-defense defeats all gate settings',()=>assert([20,15,10,7].every(hp=>24>=hp)));
const report={checkedAt:'2026-10-27',scope:'Design arithmetic and map structure only. No game runtime, device, education or balance approval.',checks,maps,archer:{upgrades,total:435,sale:261},randomGuessPt:expectedPt,productionEstimate:{towerIndependentFrames:30*4*(4+6),questions:4*300,initialReviewerQuestionUnits:4*300*3}};
fs.writeFileSync(path.join(root,'docs/contracts/validation_report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:checks.length,maps,scope:report.scope},null,2));
