#!/usr/bin/env python3
"""생성된 작은 장식의 크기/접지점 정렬. 원본 색과 실제 알파를 유지한다."""
import importlib.util,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('props',ROOT/'prepare-props.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
g=p.g
SPECS={'deco.bush.0':(1,0,102),'deco.bush.1':(1,0,102),'deco.pebble':(1,9,102),'deco.flowers':(2,-3,90)}
def main():
 report={};images={}
 for name,(ox,oy,contact) in SPECS.items():
  src=ROOT/'sources'/f'{name}.generated.png'
  r=p.resize(src,ROOT/'sources'/f'{name}.resized.png',126,126)
  a=p.blank(128,128);p.paste(a,r,ox,oy)
  dst=ROOT/f'{name}.r1.png';g.write_png(dst,a);a=g.read_png(dst);images[name]=a
  alpha=[q[3] for row in a for q in row];border=[q[3] for q in a[0]+a[-1]]+[row[0][3] for row in a]+[row[-1][3] for row in a]
  rec={'source':f'sources/{name}.generated.png','sourceHash':g.sha(src),'artifactHash':g.sha(dst),'width':128,'height':128,'pngColorType':dst.read_bytes()[25],'alphaMin':min(alpha),'alphaMax':max(alpha),'borderAlphaMax':max(border),'bboxAlpha1':p.bbox(a,1),'bboxAlpha128':p.bbox(a,128),'alignment':{'resize':[126,126],'translation':[ox,oy]},'groundContactY':contact,'modelMetadataContainsGptImage':b'gpt-image' in src.read_bytes()}
  assert rec['pngColorType']==6 and min(alpha)==0 and max(alpha)==255 and max(border)==0,rec
  assert rec['bboxAlpha128'][3]==contact,rec
  report[name]=rec
 grass=g.read_png(ROOT/'ground.grass.r1.png');board=[[grass[y%256][x%256][:] for x in range(768)] for y in range(420)]
 for i,name in enumerate(SPECS):
  p.paste(board,images[name],i*192+32,12)
  size=42 if 'bush' in name else 35
  a=p.resize(ROOT/f'{name}.r1.png',ROOT/'sources'/f'{name}.game-scale.png',size,size)
  p.paste(board,a,i*192+75,220-round(size*(.7 if name=='deco.flowers' else .8)))
  # 짙은 풀 얼룩 위에서도 확인한다.
  patch=g.read_png(ROOT/'ground.patch.1.r1.png');p.paste(board,patch,i*192,225)
  p.paste(board,a,i*192+75,340-round(size*(.7 if name=='deco.flowers' else .8)))
 g.write_png(ROOT/'small-check.png',board)
 (ROOT/'measurements-small.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
