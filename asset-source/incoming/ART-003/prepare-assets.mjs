import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir=path.dirname(fileURLToPath(import.meta.url));
const magick=(args)=>execFileSync('magick',args,{maxBuffer:32*1024*1024});
function info(file) {
  const bytes=fs.readFileSync(file), width=bytes.readUInt32BE(16), height=bytes.readUInt32BE(20);
  const raw=magick([file,'-depth','8','RGBA:-']);
  let left=width,top=height,right=-1,bottom=-1,zero=0,partial=0,opaque=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const a=raw[(y*width+x)*4+3]; if(a===0)zero++;else if(a===255)opaque++;else partial++;
    if(a>=32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  }
  return {width,height,colorType:bytes[25],zero,partial,opaque,boundsThreshold:32,bounds:[left,top,right+1,bottom+1],sha256:createHash('sha256').update(bytes).digest('hex')};
}
const batch=process.argv[2]??'part1';
if(!['part1','part2','part3'].includes(batch))throw Error('지원하지 않는 제작 범위: '+batch);
const specs=batch==='part3'?[
 {id:'tower.spear',source:'tower.spear.generated.png',drawWidth:154,drawHeight:120},
 {id:'tower.spear.weapon',source:'tower.spear.weapon.generated.png',scale:0.105,pivot:[850,459],muzzleSource:[1674,457]},
 {id:'tower.guardian',source:'tower.guardian.attempt3.generated.png',drawWidth:154,drawHeight:126,baseCenterX:622},
 {id:'tower.guardian.weapon',source:'tower.guardian.weapon.generated.png',scale:0.10,pivot:[285,642],muzzleSource:[1190,642]},
 {id:'tower.banner',source:'tower.banner.attempt2.generated.png',drawWidth:154,baseCenterX:606},
]:batch==='part2'?[
 {id:'tower.lightning',source:'tower.lightning.generated.png',drawWidth:154,drawHeight:106},
 {id:'tower.lightning.weapon',source:'tower.lightning.weapon.generated.png',scale:0.10,pivot:[618,572],muzzleSource:[618,572]},
 {id:'tower.flame',source:'tower.flame.generated.png',drawWidth:154,drawHeight:120},
 {id:'tower.flame.weapon',source:'tower.flame.weapon.generated.png',scale:0.105,pivot:[324,601],muzzleSource:[1023,601]},
]:[
 {id:'tower.crossbow',source:'tower.crossbow.attempt2.generated.png',drawWidth:154,drawHeight:116},
 {id:'tower.crossbow.weapon',source:'tower.crossbow.weapon.generated.png',scale:0.125,pivot:[693,633],muzzleSource:[1205,622]},
 {id:'tower.mage',source:'tower.mage.attempt2.generated.png',drawWidth:150},
 {id:'tower.mage.weapon',source:'tower.mage.weapon.generated.png',scale:0.145,pivot:[627,620],muzzleSource:[831,620]},
];
const onlyId=process.argv[3];
if(onlyId&&!specs.some(s=>s.id===onlyId))throw Error('범위 밖 id: '+onlyId);
const report=onlyId?JSON.parse(fs.readFileSync(path.join(dir,`technical-evidence-${batch}.json`),'utf8')).filter(r=>r.id!==onlyId):[];
for(const spec of specs.filter(s=>!onlyId||s.id===onlyId)){
 const source=path.join(dir,'sources',spec.source), before=info(source), b=before.bounds;
 if(before.colorType!==6||before.zero===0)throw Error('실제 RGBA 알파 없음: '+spec.id);
 const scale=spec.scale??spec.drawWidth/(b[2]-b[0]);
 const resizedWidth=Math.round(before.width*scale), resizedHeight=Math.round(before.height*(spec.drawHeight?spec.drawHeight/(b[3]-b[1]):scale));
 const sx=resizedWidth/before.width,sy=resizedHeight/before.height;
 const dx=Math.round(spec.pivot?96-spec.pivot[0]*sx:96-(spec.baseCenterX??(b[0]+b[2])/2)*sx);
 const dy=Math.round(spec.pivot?96-spec.pivot[1]*sy:156-b[3]*sy);
 const out=path.join(dir,spec.id+'.r1.png');
 // 원본 전체를 축소하고 투명 캔버스에 배치한다. 배경 제거 및 알파 임계값 처리 없음.
 // drawHeight가 있는 몸체는 고정 무기 높이에 받침을 맞추도록 폭/높이를 각각 배치한다.
 magick(['-size','192x192','xc:none','(',source,'-resize',`${resizedWidth}x${resizedHeight}!`,')','-geometry',`${dx>=0?'+':''}${dx}${dy>=0?'+':''}${dy}`,'-compose','Over','-composite','-depth','8','PNG32:'+out]);
 const after=info(out);
 if(after.width!==192||after.height!==192||after.colorType!==6||after.zero===0||after.opaque===0)throw Error('규격 실패: '+spec.id);
 report.push({...spec,sourceInfo:before,artifactInfo:after,transform:{sx,sy,dx,dy},origin:spec.pivot?[0.5,0.5]:[0.5,0.8125],muzzle:spec.muzzleSource?{x:Math.round(spec.muzzleSource[0]*sx+dx),y:Math.round(spec.muzzleSource[1]*sy+dy)}:null});
}
fs.writeFileSync(path.join(dir,`technical-evidence-${batch}.json`),JSON.stringify(report,null,2)+'\n');
console.log(report.map(r=>({id:r.id,bounds:r.artifactInfo.bounds,rgba:r.artifactInfo.colorType,muzzle:r.muzzle})));
