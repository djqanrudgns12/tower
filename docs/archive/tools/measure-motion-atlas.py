"""Read-only source rectangle measurement. Never modifies the generated PNG."""
from pathlib import Path
from PIL import Image
import json
root = Path(__file__).resolve().parent.parent / 'docs' / 'design-v0.7'
im = Image.open(root / 'motion-atlas.png').convert('RGBA')
w, h = im.size
cw, ch = w // 3, h // 3
small = im.getchannel('A').resize((320,308), Image.Resampling.BOX)
pixels = list(small.getdata())
seen, components = set(), []
for k, value in enumerate(pixels):
    if value < 64 or k in seen: continue
    todo, comp = [k], []
    seen.add(k)
    while todo:
        n = todo.pop()
        comp.append(n)
        x, y = n%320, n//320
        for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            p = yy*320+xx
            if 0<=xx<320 and 0<=yy<308 and p not in seen and pixels[p]>=64:
                seen.add(p)
                todo.append(p)
    if len(comp)>200: components.append(comp)
if len(components)!=9: raise ValueError(f'Expected nine separated sprites, got {len(components)}')
sprites = [None]*9
for comp in components:
    l,t = max(0,int(min(k%320 for k in comp)*w/320)-3),max(0,int(min(k//320 for k in comp)*h/308)-3)
    r,b = min(w,int((max(k%320 for k in comp)+1)*w/320)+3),min(h,int((max(k//320 for k in comp)+1)*h/308)+3)
    i = min(2,int((t+b)/2/ch))*3 + min(2,int((l+r)/2/cw))
    if sprites[i] is not None: raise ValueError('Ambiguous component')
    sprites[i]=dict(x=l,y=t,w=r-l,h=b-t)
# Keep both goblin poses on the same relative frame and foot pivot.
aa, bb = sprites[3], sprites[4]
l = min(aa['x'], bb['x']-cw)
t = min(aa['y'], bb['y'])
r = max(aa['x']+aa['w'], bb['x']-cw+bb['w'])
b = max(aa['y']+aa['h'], bb['y']+bb['h'])
for i in (3,4): sprites[i] = dict(x=l+(i-3)*cw,y=t,w=r-l,h=b-t)
data = dict(width=w,height=h,transparentPixels=im.getchannel('A').histogram()[0],sprites=sprites)
if data['transparentPixels'] < w*h*.1: raise ValueError('No true alpha')
(root/'motion-metrics.json').write_text(json.dumps(data,indent=2),encoding='utf8')
(root/'motion-metrics.js').write_text('window.ATLAS='+json.dumps(data)+';',encoding='utf8')
print(json.dumps(data))
