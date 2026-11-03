#!/usr/bin/env python3
"""ART-R2. ART-R1의 원본 보존/알파 처리, 접촉판과 맵 합성을 재사용한다.
uv run --no-project --with pillow --with numpy python <이 파일> prepare|preview|verify
타워 하단 y128..191은 기존 기본형 픽셀 그대로. 생성부는 비율 유지 축소만 한다.
"""
from pathlib import Path
import argparse, hashlib, json, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
R1=ROOT.parent/'ART-R1'
RESAMPLE=Image.Resampling.LANCZOS
FOOT_Y=128

def readj(name): return json.loads((ROOT/name).read_text())
def writej(name,obj): (ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def specs(): return readj('prompts.json')['prompts']
def base_for(s): return PROJECT/f"public/assets/tower.{s['tower']}.r1.png"
def font(size=14): return ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc',size)
def resolve(tower,form):
    if form=='base': return PROJECT/f'public/assets/tower.{tower}.r1.png'
    p=ROOT/f'tower.{tower}.{form}.r1.png'
    return p if p.exists() else ROOT.parent/f'ART-R2/tower.{tower}.{form}.r1.png'
def prepare():
    report=readj('measurements.json') if (ROOT/'measurements.json').exists() else {}
    meta=readj('generation-metadata.json');processed=[];reused=[]
    for s in specs():
        BASE=base_for(s)
        anchor_bottom=Image.open(BASE).getchannel('A').getbbox()[3]
        entry=meta.get(s['id'],{});source=entry.get('selectedSource')
        if not source:continue
        source=ROOT/source;target=ROOT/f"{s['id']}.r1.png"
        key=hashlib.sha256(json.dumps([sha(source),s['width'],s['height'],sha(BASE) if s['layer']=='tower' else None,FOOT_Y,anchor_bottom,'alpha-support8-bbox+4px;LANCZOS;baseline-bottom;original-foundation-underlay;8px-margin']).encode()).hexdigest()
        if report.get(s['id'],{}).get('processingKey')==key and target.exists() and sha(target)==report[s['id']]['artifactHash']:
            reused.append(s['id']);continue
        im=Image.open(source).convert('RGBA');a=np.asarray(im)
        assert a[:,:,3].min()==0 and a[:,:,3].max()==255,s['id']+' 실제 알파 없음'
        support=Image.fromarray((a[:,:,3]>=8).astype('uint8')*255).getbbox();bbox=(max(0,support[0]-4),max(0,support[1]-4),min(im.width,support[2]+4),min(im.height,support[3]+4));crop=im.crop(bbox);out=Image.new('RGBA',(s['width'],s['height']))
        if s['layer']=='tower':
            crop.thumbnail((168,anchor_bottom-10),RESAMPLE);x=(192-crop.width)//2;y=anchor_bottom-crop.height
            base=Image.open(BASE).convert('RGBA')
            underlay_y={'archer':128,'cannon':96,'frost':0}[s['tower']]
            out.alpha_composite(base.crop((0,underlay_y,192,192)),(0,underlay_y))
            out.alpha_composite(crop,(x,y))
            out.paste(base.crop((0,FOOT_Y,192,192)),(0,FOOT_Y))
        else:
            crop.thumbnail((s['width']-8,s['height']-8),RESAMPLE);x=(s['width']-crop.width)//2;y=(s['height']-crop.height)//2
            out.alpha_composite(crop,(x,y))
        out.save(target);aa=np.asarray(out);alpha=aa[:,:,3]
        border=np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
        record={'technicalPass':bool(alpha.min()==0 and alpha.max()==255 and border.max()==0),'processingKey':key,'width':out.width,'height':out.height,'pngColorType':target.read_bytes()[25],'source':str(source.relative_to(ROOT)),'sourceSize':list(im.size),'sourceBBox':bbox,'sourceHash':sha(source),'artifactHash':sha(target),'alphaMin':int(alpha.min()),'alphaMax':int(alpha.max()),'borderAlphaMax':int(border.max()),'placedCrop':[x,y,crop.width,crop.height]}
        if s['layer']=='tower':record.update(baseReference=str(BASE.relative_to(PROJECT)),baseReferenceHash=sha(BASE),baseSliceStartY=FOOT_Y,baseSliceHash=hashlib.sha256(aa[FOOT_Y:].tobytes()).hexdigest(),baseSliceExact=bool(np.array_equal(aa[FOOT_Y:],np.asarray(base)[FOOT_Y:])),anchor=[96,156])
        if s['layer']=='edge':
            interior=np.asarray(Image.fromarray((alpha>32).astype('uint8')*255).filter(ImageFilter.MinFilter(9)))>0
            record['semiTransparentInteriorPixels']=int(((alpha<245)&(alpha>16)&interior).sum())
        report[s['id']]=record;processed.append(s['id'])
    writej('measurements.json',report);contacts();manifest();print(json.dumps({'processed':processed,'reused':reused},ensure_ascii=False))

def manifest():
    checks=readj('measurements.json') if (ROOT/'measurements.json').exists() else {}
    reviews=readj('visual-review.json') if (ROOT/'visual-review.json').exists() else {}; assets=[]
    for s in specs():
        m=checks.get(s['id'],{})
        if not m.get('technicalPass') or reviews.get(s['id'],{}).get('decision')!='pass': continue
        a={k:s[k] for k in ['id','width','height','displayCells','layer','originX','originY']}
        a.update(revision=1,file=f"{s['id']}.r1.png",frames=1,status='draft',sourceHash=m['sourceHash'],artifactHash=m['artifactHash'],producer='image_gen.imagegen / 내장 도구; 세부 모델 버전 미공개',license='자체 생성, 프로젝트 전용',notes='ART-R2 prepare.py의 알파 보존·비율 유지 축소 재사용. 각 기본형 y128..191 RGBA 완전 동일. 자체 시각 검수 통과, 총괄 인수 전 draft.')
        assets.append(a)
    writej('manifest.json',{'schemaVersion':'1','jobId':'ART-R3','styleReferenceSha256':sha(PROJECT/'docs/assets/design-41-kingdom-expedition.png'),'baseReferenceSha256':{t:sha(PROJECT/f'public/assets/tower.{t}.r1.png') for t in ['archer','cannon','frost']},'assets':assets})

def contacts():
    forms=['base','A','B','A1','A2','B1','B2']
    names={'archer':['기본','속사','정찰','톱니','깃털','매','과녁 방패'],'cannon':['기본','화약통 둘','철갑','폭발 방패','폭탄 묶음','숫양 뿔','종 반동추'],'frost':['기본','얼음 창','얼음 꽃','육각 기둥','톱날 쌍창','눈송이 풍향탑','연꽃 봉오리']}
    for tower in names:
      for mode,bg,fg in [('light','#e8e1cb','#332c22'),('dark','#28392b','#eee6d2')]:
        board=Image.new('RGBA',(1680,870),bg);d=ImageDraw.Draw(board)
        d.text((22,12),f'ART-R3 {tower} 진화 | 본체 · 상부 사선 · 기본형 하단 원본 보존',font=font(21),fill=fg)
        for i,f in enumerate(forms):
            p=resolve(tower,f);x=i*240+24
            d.text((x,52),f'{f} / {names[tower][i]}',font=font(17),fill=fg)
            if not p.exists():
                d.text((x,150),'생성 전',font=font(20),fill=fg);continue
            im=Image.open(p).convert('RGBA');board.alpha_composite(im,(x,80))
            for row,px in enumerate([64,48,32]):
                yy=310+row*100;small=im.resize((px,px),RESAMPLE)
                board.alpha_composite(small,(x+(192-px)//2,yy));d.text((x+6,yy+10),str(px),font=font(13),fill=fg)
            pad=Image.open(R1/'slot.pad.0.r1.png').convert('RGBA');pad=pad.crop(pad.getchannel('A').getbbox());pad.thumbnail((102,102),RESAMPLE)
            cx=x+96;cy=745;board.alpha_composite(pad,(cx-pad.width//2,cy-pad.height//2))
            full=im.resize((134,134),RESAMPLE);board.alpha_composite(full,(cx-67,cy-round(134*.8125)))
            d.line([(cx-5,cy),(cx+5,cy)],fill='#a44c36',width=1)
        d.text((22,825),'하단: slot.pad.0 알파 영역 0.8칸 + 타워 1.05칸 / origin=(0.5,0.8125) 고정 / 총괄 인수 전',font=font(17),fill=fg)
        board.convert('RGB').save(ROOT/f'evolution-lineup-{tower}-{mode}.png')

def verify():
    errors=[]; checks=readj('measurements.json');reviews=readj('visual-review.json');meta=readj('generation-metadata.json');assets=readj('manifest.json')['assets']
    expected={k for k,v in reviews.items() if v['decision']=='pass'}
    if expected!={a['id'] for a in assets}: errors.append('자체 통과 목록과 manifest 불일치')
    if set(reviews)!={s['id'] for s in specs()}: errors.append('항목별 검수 누락')
    sources={};sizes={};ratios={}
    for s in specs():
        ident=s['id'];entry=meta.get(ident,{})
        if not 1<=len(entry.get('attempts',[]))<=3: errors.append(ident+' 시도 누락/3회 초과')
        sources[ident]=len(entry.get('attempts',[]))
        for attempt in entry.get('attempts',[]):
            if not (ROOT/attempt['source']).exists(): errors.append(attempt['source']+' 원본 없음')
        p=ROOT/f'{ident}.r1.png';im=Image.open(p).convert('RGBA');arr=np.asarray(im);alpha=arr[:,:,3];base=np.asarray(Image.open(base_for(s)).convert('RGBA'))
        if im.size!=(192,192) or p.read_bytes()[25]!=6: errors.append(ident+' RGBA192 규격')
        if sha(p)!=checks[ident]['artifactHash']: errors.append(ident+' hash 불일치')
        if alpha.min()!=0 or alpha.max()!=255 or np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]]).max()!=0: errors.append(ident+' 알파/외곽')
        if not np.array_equal(arr[FOOT_Y:],base[FOOT_Y:]): errors.append(ident+' 하단 변경')
        if (s['originX'],s['originY'])!=(.5,.8125): errors.append(ident+' 기준점 변경')
        ys,xs=np.where(alpha>127);bys,bxs=np.where(base[:,:,3]>127)
        sizes[ident]={'opaqueAreaRatioToBase':round(len(xs)/len(bxs),4),'bboxWidth':int(xs.max()-xs.min()+1),'bboxHeight':int(ys.max()-ys.min()+1),'baseBBoxWidth':int(bxs.max()-bxs.min()+1),'baseBBoxHeight':int(bys.max()-bys.min()+1)}
        if s['tower']=='archer':
            foot=np.where(base[128:,:,3]>127)[1];foot_width=int(foot.max()-foot.min()+1)
            widths=[int(np.where(row>127)[0].max()-np.where(row>127)[0].min()+1) for row in alpha[92:120] if np.any(row>127)]
            ratios[ident]={'bodySampleY':[92,119],'bodyWidthMedianPx':float(np.median(widths)),'foundationWidthPx':foot_width,'ratio':round(float(np.median(widths))/foot_width,4)}
            if ratios[ident]['ratio']<.55: errors.append(ident+' 몸통/받침 폭 55% 미달')
    protected_changes=[]
    for name,h in readj('preservation-baseline.json')['protected'].items():
        p=PROJECT/name
        if not p.exists() or sha(p)!=h: protected_changes.append(name)
    status=subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=all'],cwd=PROJECT,text=True)
    r={'assetCount':len(assets),'sourceCount':sum(sources.values()),'attempts':sources,'errors':errors,'automatedPass':not errors,'towerBaseExact':{s['id']:checks[s['id']]['baseSliceExact'] for s in specs()},'archerBodyWidth':ratios,'sizeComparison':sizes,'protectedChangesSinceBaseline':protected_changes,'scopeNote':'동료가 src/public/docs를 동시에 수정 중. 이 작업의 모든 쓰기는 ART-R3 안에서만 수행했으며 변경 목록은 소유권 판단 없이 기록.','visualApproval':'자체 검수만 실행, 총괄 인수 미실행','appBuild':'미실행: 앱 코드 변경 없음','e2e':'미실행: 앱 코드 변경 없음','gitStatus':status}
    writej('logs/final-verification.json',r)
    (ROOT/'file-list.txt').write_text('\n'.join(sorted({str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file()}|{'file-list.txt'}))+'\n')
    print(json.dumps({k:v for k,v in r.items() if k not in ['gitStatus','towerBaseExact']},ensure_ascii=False,indent=2));assert not errors

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','preview','verify']);args=parser.parse_args()
    if args.action=='preview': contacts();manifest()
    else: globals()[args.action]()
