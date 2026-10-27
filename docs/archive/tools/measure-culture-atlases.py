"""Read-only alpha measurements; source PNGs are not edited."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parent.parent / 'docs' / 'design-v0.6'
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
results = {}
for variant in manifest['variants']:
    im = Image.open(root / variant['file']).convert('RGBA')
    w, h = im.size
    cw, ch = w // 3, h // 3
    sprites = []
    for i in range(9):
        x, y = (i % 3) * cw, (i // 3) * ch
        alpha = im.getchannel('A').crop((x, y, x + cw, y + ch))
        # Ignore disconnected fragments spilling from a neighboring atlas slot.
        # This only measures source rectangles; it never rewrites the image.
        small = alpha.resize((128,128), Image.Resampling.BOX)
        pixels = list(small.getdata())
        seen = set()
        largest = []
        for index,value in enumerate(pixels):
            if value < 48 or index in seen:
                continue
            queue = [index]
            seen.add(index)
            component = []
            while queue:
                here = queue.pop()
                component.append(here)
                xx, yy = here % 128, here // 128
                for nx,ny in ((xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)):
                    if 0 <= nx < 128 and 0 <= ny < 128:
                        other = ny*128+nx
                        if other not in seen and pixels[other] >= 48:
                            seen.add(other)
                            queue.append(other)
            if len(component) > len(largest):
                largest = component
        if largest:
            box = (max(0,int(min(k%128 for k in largest)*cw/128)-3),
                   max(0,int(min(k//128 for k in largest)*ch/128)-3),
                   min(cw,int((max(k%128 for k in largest)+1)*cw/128)+3),
                   min(ch,int((max(k//128 for k in largest)+1)*ch/128)+3))
        else:
            box = None
        if not box:
            raise ValueError(f'Empty sprite {variant["id"]}/{i}')
        left, top, right, bottom = box
        sprites.append({'x':x+left,'y':y+top,'w':right-left,'h':bottom-top})
    histogram = im.getchannel('A').histogram()
    if histogram[0] < w*h*0.1:
        raise ValueError(f'Insufficient transparent background: {variant["id"]}')
    results[variant['id']] = {'width':w,'height':h,'transparentPixels':histogram[0],'sprites':sprites}
(root / 'atlas-metrics.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(results)} atlases measured; source images unchanged')
