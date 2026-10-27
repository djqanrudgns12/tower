"""Read-only alpha measurements; source PNGs are not edited."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parent.parent / 'docs' / 'design-v0.5'
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
results = {}
for variant in manifest['variants']:
    im = Image.open(root / variant['file']).convert('RGBA')
    w, h = im.size
    cw, ch = w // 3, h // 2
    sprites = []
    for i in range(6):
        x, y = (i % 3) * cw, (i // 3) * ch
        alpha = im.getchannel('A').crop((x, y, x + cw, y + ch))
        box = alpha.point(lambda value: 255 if value >= 48 else 0).getbbox()
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
