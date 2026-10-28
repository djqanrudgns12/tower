import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8').replace(/^\uFEFF/,''));
const specs=read('requested-specs.json'), infos=read('source-info.json');
const layouts=[];
for(const s of specs){
  const info=infos.find(x=>x.name===s.id+'.generated.png').info;
  const [x0,y0,x1,y1]=info.bounds, bw=x1-x0,bh=y1-y0;
  let width,height,left,top,muzzle,method;
  if(s.id.startsWith('enemy.walker')){
    // Identical scale for the four gait frames. The hit face has a local
    // squash; do not expand it back to the walking frame height.
    const hit=s.id.endsWith('.hit'),sx=hit?108/bw:96.5/899,sy=84/865;
    const anchorX=hit?752:675;
    width=bw*sx;height=bh*sy;left=64+(x0-anchorX)*sx;top=96-height;
    method=hit?'same vertical scale, foot-center aligned hit pose':'shared gait scale; fixed ground pivot';
  }else if(s.id.startsWith('enemy.boss')){
    const scale=154/1168;
    width=bw*scale;height=bh*scale;left=96+(x0-665)*scale;top=144-height;
    method='shared boss scale; fixed ground pivot';
  }else if(s.id==='tower.archer.weapon'){
    const scale=160/1168;
    width=bw*scale;height=bh*scale;left=96-(775-x0)*scale;top=96-(634-y0)*scale;
    muzzle={x:Math.round(96+(1126-775)*scale),y:96};
    method='uniform resize; grip and arrow axis placed at 96,96';
  }else if(s.id==='tower.cannon.weapon'){
    const scale=160/1104;
    width=bw*scale;height=bh*scale;left=96-(800-x0)*scale;top=96-(445-y0)*scale;
    muzzle={x:Math.round(96+(1302-800)*scale),y:96};
    method='uniform resize; barrel pivot and bore axis at y96';
  }else if(s.id==='tower.frost.weapon'){
    height=144;width=bw*height/bh;left=96-width/2;top=24;
    method='uniform resize; crystal centered at 96,96';
  }else{
    width=s.id==='map.gate'?205:154;
    height=bh*width/bw;
    if(s.id==='tower.archer')height=144;
    const ground=s.size*s.origin[1];
    height=Math.min(height,ground-12);
    left=s.size/2-width/2;top=ground-height;
    method=s.id==='tower.archer'?'independent width/height fit for squat tower; no crop':'uniform resize and bottom-center placement';
  }
  layouts.push({id:s.id,source:'sources/'+s.id+'.generated.png',size:s.size,left,top,drawWidth:width,drawHeight:height,...(muzzle?{muzzle}:{}),method});
}
fs.writeFileSync(path.join(dir,'layout.json'),JSON.stringify(layouts,null,2)+'\n');
console.log(`layout.json: ${layouts.length} assets, geometry only; generated alpha unchanged`);
