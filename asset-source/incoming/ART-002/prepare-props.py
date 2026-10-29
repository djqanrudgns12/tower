#!/usr/bin/env python3
"""ART-002 소품 크기/기준점 정렬 및 알파/좌표 증거. 생성 알파/색을 지우거나 덧칠하지 않는다."""
import importlib.util,json,subprocess,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ground',ROOT/'prepare-ground.py');g=importlib.util.module_from_spec(s);s.loader.exec_module(g)
def resize(src,dst,w,h):
 subprocess.run(['sips','-z',str(h),str(w),str(src),'--out',str(dst)],capture_output=True,check=True)
 return g.read_png(dst)
def blank(w,h):return [[[0,0,0,0] for x in range(w)] for y in range(h)]
def paste(dst,src,ox,oy):
 for y,row in enumerate(src):
  for x,p in enumerate(row):
   if 0<=x+ox<len(dst[0]) and 0<=y+oy<len(dst):
    q=dst[y+oy][x+ox];a=p[3]/255
    if q[3]==0:q[:]=p[:]
    else:q[:]=[round(p[c]*a+q[c]*(1-a)) for c in range(3)]+[255]
   else:assert p[3]==0,('nontransparent clipping',x,y,p)
def bbox(rows,threshold):
 pts=[(x,y) for y,row in enumerate(rows) for x,p in enumerate(row) if p[3]>=threshold]
 return [min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)]
def main():
 specs={'slot.base':(192,240,0,-11),'deco.rock':(190,190,1,7),'map.entry':(192,192,9,3)}
 report={};images={}
 for name,(w,h,ox,oy) in specs.items():
  src=ROOT/'sources'/f'{name}.generated.png';r=resize(src,ROOT/'sources'/f'{name}.aligned-source.png',w,h)
  rows=blank(192,192);paste(rows,r,ox,oy);out=ROOT/f'{name}.r1.png';g.write_png(out,rows);actual=g.read_png(out);images[name]=actual
  alphas=[p[3] for row in actual for p in row];border=[p[3] for p in actual[0]+actual[-1]]+[row[0][3] for row in actual]+[row[-1][3] for row in actual]
  record={'width':192,'height':192,'pngColorType':out.read_bytes()[25],'alphaMin':min(alphas),'alphaMax':max(alphas),'borderAlphaMax':max(border),'bboxAlpha1':bbox(actual,1),'bboxAlpha128':bbox(actual,128),'source':f'sources/{name}.generated.png','sourceHash':g.sha(src),'artifactHash':g.sha(out),'alignment':{'resize':[w,h],'translation':[ox,oy]}}
  assert record['pngColorType']==6 and min(alphas)==0 and max(alphas)==255 and max(border)==0,record
  if name=='slot.base':
   record['contactPixel']={'x':96,'y':157,'rgba':actual[157][96]}
   record['centerColumn']=[{'y':y,'rgba':actual[y][96]} for y in range(150,179)]
   assert actual[157][96][3]>=240 and min(actual[157][96][:3])>160
  report[name]=record
 # 위: 원본 크기 3장, 아래: 실제 64px 칸 기준(받침64/바위67/깃발38)과 기존 나무/타워 비교.
 grass=g.read_png(ROOT/'ground.grass.r1.png');board=[[grass[y%256][x%256][:] for x in range(768)] for y in range(384)]
 for i,name in enumerate(specs):paste(board,images[name],i*256+32,10)
 for name,size,x in [('slot.base',64,50),('deco.rock',67,220),('map.entry',38,390)]:
  r=resize(ROOT/f'{name}.r1.png',ROOT/'sources'/f'{name}.game-scale.png',size,size);paste(board,r,x,280-round(size*.85))
 project=ROOT.parents[2]
 for name,size,x in [('deco.tree',67,520),('tower.archer',70,640)]:
  r=resize(project/'public/assets'/f'{name}.r1.png',ROOT/'sources'/f'{name}.comparison.png',size,size);paste(board,r,x,280-round(size*.85))
 g.write_png(ROOT/'props-check.png',board)
 # 4배 확대 좌표 확인용 판. 왼쪽은 무표시, 오른쪽 빨간 십자 중심이 정확히 (96,157).
 slot=images['slot.base'];proof=blank(1536,768)
 for y in range(768):
  for x in range(1536):
   p=slot[y//4][(x%768)//4];bg=[232,223,198];a=p[3]/255
   proof[y][x]=[round(p[c]*a+bg[c]*(1-a)) for c in range(3)]+[255]
 cx=768+96*4+2;cy=157*4+2
 for d in range(-12,13):
  if abs(d)>3:proof[cy][cx+d]=[255,30,30,255];proof[cy+d][cx]=[255,30,30,255]
 g.write_png(ROOT/'slot-contact-check.png',proof)
 (ROOT/'measurements-props.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
