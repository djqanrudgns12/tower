#!/usr/bin/env python3
"""ART-002 생성 원본의 크기/RGBA/평균색/이음매 정리. 외부 패키지 불필요.

재현: python3 asset-source/incoming/ART-002/prepare-ground.py
sips로 원본을 목표 크기로 축소하고 실제 알파를 유지한다.
질감은 양쪽 16px 띠만 코사인 가중치로 연결한다. 원본은 보존한다.
"""
from pathlib import Path
import hashlib, json, math, struct, subprocess, zlib

ROOT = Path(__file__).resolve().parent
SPECS = {'ground.grass': (256, (124,188,76)), 'ground.dirt': (256,(220,184,120)),
         'ground.patch.0': (192,(152,205,99)), 'ground.patch.1': (192,(100,162,62))}

def read_png(path):
    data=path.read_bytes(); pos=8; compressed=b''
    while pos<len(data):
        n=struct.unpack('>I',data[pos:pos+4])[0]; tag=data[pos+4:pos+8]; b=data[pos+8:pos+8+n]; pos+=n+12
        if tag==b'IHDR': w,h,depth,kind,_,_,interlace=struct.unpack('>IIBBBBB',b)
        if tag==b'IDAT': compressed+=b
    assert depth==8 and kind in (2,6) and interlace==0, (depth,kind,interlace)
    channels=3 if kind==2 else 4; stride=w*channels; raw=zlib.decompress(compressed)
    rows=[]; prior=bytearray(stride)
    for y in range(h):
        f=raw[y*(stride+1)]; row=bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        for i in range(stride):
            a=row[i-channels] if i>=channels else 0; b=prior[i]; c=prior[i-channels] if i>=channels else 0
            if f==1: v=a
            elif f==2: v=b
            elif f==3: v=(a+b)//2
            elif f==4:
                p=a+b-c; da,db,dc=abs(p-a),abs(p-b),abs(p-c)
                v=a if da<=db and da<=dc else b if db<=dc else c
            else: assert f==0; v=0
            row[i]=(row[i]+v)&255
        rows.append([list(row[x*channels:x*channels+channels])+([255] if channels==3 else []) for x in range(w)])
        prior=row
    return rows

def write_png(path, rows):
    h=len(rows); w=len(rows[0])
    def chunk(tag,b): return struct.pack('>I',len(b))+tag+b+struct.pack('>I',zlib.crc32(tag+b)&0xffffffff)
    raw=b''.join(b'\0'+bytes(v for p in row for v in p) for row in rows)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))

def mean_color(rows):
    den=sum(p[3] for row in rows for p in row)
    return [sum(p[c]*p[3] for row in rows for p in row)/den for c in range(3)]

def normalize(rows,target):
    mean=mean_color(rows)
    for row in rows:
        for p in row:
            if p[3]:
                for c in range(3): p[c]=max(0,min(255,round(p[c]+target[c]-mean[c])))

def connect_edges(rows):
    n=len(rows); band=16
    for axis in (0,1):
        for t in range(n):
            for k in range(band):
                a,b=(rows[t][k],rows[t][n-1-k]) if axis==0 else (rows[k][t],rows[n-1-k][t])
                mix=(1+math.cos(math.pi*k/(band-1)))/4
                for c in range(3):
                    av,bv=a[c],b[c]
                    a[c]=round(av*(1-mix)+bv*mix); b[c]=round(bv*(1-mix)+av*mix)

def measures(rows):
    n=len(rows)
    x=sum(abs(row[0][c]-row[-1][c]) for row in rows for c in range(3))/(n*3)
    y=sum(abs(rows[0][k][c]-rows[-1][k][c]) for k in range(n) for c in range(3))/(n*3)
    ix=sum(abs(row[k+1][c]-row[k][c]) for row in rows for k in range(n-1) for c in range(3))/(n*(n-1)*3)
    iy=sum(abs(rows[k+1][t][c]-rows[k][t][c]) for k in range(n-1) for t in range(n) for c in range(3))/(n*(n-1)*3)
    return dict(edgeX=x, edgeY=y, interiorX=ix, interiorY=iy, limitX=1.5*ix, limitY=1.5*iy, passX=x<=1.5*ix,passY=y<=1.5*iy)

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    report={}; images={}
    for name,(size,target) in SPECS.items():
        source=ROOT/'sources'/f'{name}.generated.png'; resized=ROOT/'sources'/f'{name}.resized.png'
        # 생성 알파를 삭제/임계값 처리하지 않는다. 얼룩은 190px로 축소 후
        # 1px 투명 여백을 붙여 프레임 끝의 미세 알파 잡음이 이웃에 닿지 않게 한다.
        sample_size=size if size==256 else size-2
        subprocess.run(['sips','-z',str(sample_size),str(sample_size),str(source),'--out',str(resized)],check=True,capture_output=True)
        rows=read_png(resized)
        if size==192:
            rows=[[[0,0,0,0] for _ in range(size)]]+[[[0,0,0,0]]+row+[[0,0,0,0]] for row in rows]+[[[0,0,0,0] for _ in range(size)]]
        before=measures(rows) if size==256 else None
        normalize(rows,target)
        if size==256:
            assert all(p[3]==255 for row in rows for p in row)
            connect_edges(rows)
        output=ROOT/f'{name}.r1.png'; write_png(output,rows); images[name]=rows
        actual=read_png(output); alphas=[p[3] for row in actual for p in row]
        mean=mean_color(actual); luma=sum(a*b for a,b in zip(mean,(.2126,.7152,.0722)))
        baseline=sum(a*b for a,b in zip(target,(.2126,.7152,.0722)))
        record=dict(width=len(actual[0]),height=len(actual),pngColorType=output.read_bytes()[25],alphaMin=min(alphas),alphaMax=max(alphas),meanRGB=mean,luma=luma,lumaDeviationPercent=100*(luma/baseline-1),sourceHash=sha(source),artifactHash=sha(output),source=f'sources/{name}.generated.png')
        if size==256:
            record.update(beforeSeams=before,seams=measures(actual))
            assert record['seams']['passX'] and record['seams']['passY']
            assert abs(record['lumaDeviationPercent'])<=8
        else:
            border=[p[3] for p in actual[0]+actual[-1]]+[row[0][3] for row in actual]+[row[-1][3] for row in actual]
            assert max(border)==0 and min(alphas)==0 and max(alphas)==255
            record['borderAlphaMax']=max(border)
        assert len(actual)==size and len(actual[0])==size and record['pngColorType']==6
        report[name]=record
    # 원본 크기 256px 그대로: 왼쪽 풀밭 3x3, 오른쪽 흙 3x3.
    board=[]
    for y in range(768):
        board.append([images['ground.grass'][y%256][x%256][:] for x in range(768)]+[images['ground.dirt'][y%256][x%256][:] for x in range(768)])
    write_png(ROOT/'tile-check.png',board)
    # 얼룩 실제 알파를 풀 위에 합성한 확인용 판. 지면 256px 위에 192px 원본으로 표시.
    board=[[images['ground.grass'][y%256][x%256][:] for x in range(512)] for y in range(256)]
    for i,name in enumerate(('ground.patch.0','ground.patch.1')):
        for y,row in enumerate(images[name]):
            for x,p in enumerate(row):
                dest=board[y+32][x+32+i*256]; a=p[3]/255
                dest[:3]=[round(p[c]*a+dest[c]*(1-a)) for c in range(3)]
    write_png(ROOT/'patch-check.png',board)
    (ROOT/'measurements.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
