#!/usr/bin/env python3
"""ART-SS2 재현 처리(ART-R1/prepare.py 복사·수정). uv run --no-project --with pillow --with numpy python <이 파일> prepare|preview|verify

원본은 보존한다. 소품은 생성 알파를 유지한 잘라내기/비율 유지 축소만 한다.
지면만 ART-002와 같은 평균색 및 16px 경계 연결을 한다. 미술 통과 항목만 manifest에 쓴다.
"""
from pathlib import Path
import argparse, hashlib, json, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
RESAMPLE = Image.Resampling.LANCZOS
TARGETS = {'ground.grass.base':(124,188,76),'ground.grass.light':(136,197,86),
           'ground.grass.shade':(109,167,70),'path.dirt':(217,183,120)}
def readj(name): return json.loads((ROOT/name).read_text())
def writej(name,obj): (ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def specs(): return readj('prompts.json')['prompts']
def font(size=14):
    for p in ['/System/Library/Fonts/AppleSDGothicNeo.ttc','/System/Library/Fonts/Supplemental/Arial.ttf']:
        if Path(p).exists(): return ImageFont.truetype(p,size)
    return ImageFont.load_default()
def seam(a):
    rgb=a[:,:,:3].astype(float)
    return {'edgeX':float(np.abs(rgb[:,0]-rgb[:,-1]).mean()),'edgeY':float(np.abs(rgb[0]-rgb[-1]).mean()),
            'interiorX':float(np.abs(np.diff(rgb,axis=1)).mean()),'interiorY':float(np.abs(np.diff(rgb,axis=0)).mean())}
def connect(a):
    a=a.astype(float)
    for axis in [0,1]:
        for k in range(16):
            mix=(1+math.cos(math.pi*k/15))/4
            left,right=(a[:,k,:3].copy(),a[:,-1-k,:3].copy()) if axis==0 else (a[k,:,:3].copy(),a[-1-k,:,:3].copy())
            if axis==0:a[:,k,:3]=left*(1-mix)+right*mix;a[:,-1-k,:3]=right*(1-mix)+left*mix
            else:a[k,:,:3]=left*(1-mix)+right*mix;a[-1-k,:,:3]=right*(1-mix)+left*mix
    return np.clip(np.rint(a),0,255).astype('uint8')
def source_for(s):
    meta=readj('generation-metadata.json') if (ROOT/'generation-metadata.json').exists() else {}
    name=meta.get(s['id'],{}).get('selectedSource',f"sources/{s['id']}.attempt1.generated.png")
    return ROOT/name
def prepare():
    report={};previous=readj('measurements.json') if (ROOT/'measurements.json').exists() else {};processed=[];reused=[]
    decisions=readj('visual-review.json') if (ROOT/'visual-review.json').exists() else {}
    for s in specs():
        if decisions.get(s['id'],{}).get('decision')=='reject':
            if s['id'] in previous:report[s['id']]=previous[s['id']]
            reused.append(s['id']);continue
        source=source_for(s)
        if not source.exists():continue
        processing_key=hashlib.sha256(json.dumps([sha(source),s['width'],s['height'],s['transparent'],TARGETS.get(s['id']),'.28 grass/.6 dirt;16px edge;8px margin;alpha bbox;LANCZOS'],sort_keys=True).encode()).hexdigest()
        old=previous.get(s['id'],{});target=ROOT/f"{s['id']}.r1.png"
        if old.get('processingKey')==processing_key and target.exists() and old.get('artifactHash')==sha(target):
            report[s['id']]=old;reused.append(s['id']);continue
        im=Image.open(source).convert('RGBA');raw=np.asarray(im)
        alpha_peak_min=32 if s['id'].startswith('ground.meadow.') else 250
        if s['transparent'] and (raw[:,:,3].min()!=0 or raw[:,:,3].max()<alpha_peak_min):
            report[s['id']]={'technicalPass':False,'reason':'생성 원본의 실제 알파 없음','source':str(source.relative_to(ROOT))};continue
        size=(s['width'],s['height']); bbox=None
        if s['transparent']:
            bbox=im.getchannel('A').getbbox()
            crop=im.crop(bbox)
            fit=(size[0]-8,size[1]-8)
            crop.thumbnail(fit,RESAMPLE)
            out=Image.new('RGBA',size)
            out.alpha_composite(crop,((size[0]-crop.width)//2,(size[1]-crop.height)//2))
        else:
            out=im.resize(size,RESAMPLE)
            a=np.asarray(out).copy()
            assert a[:,:,3].min()==255, s['id']
            before=seam(a)
            mean=a[:,:,:3].mean(axis=(0,1))
            contrast=.28 if s['id'].startswith('ground.grass.') else .6
            a[:,:,:3]=np.clip(np.rint((a[:,:,:3].astype(float)-mean)*contrast+np.array(TARGETS[s['id']])),0,255)
            out=Image.fromarray(connect(a))
        target=ROOT/f"{s['id']}.r1.png";out.save(target)
        a=np.asarray(out); alpha=a[:,:,3]; border=np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
        record={'technicalPass':True,'processingKey':processing_key,'width':out.width,'height':out.height,'pngColorType':target.read_bytes()[25],
                'source':str(source.relative_to(ROOT)),'sourceSize':list(im.size),'sourceBBox':bbox,
                'sourceHash':sha(source),'artifactHash':sha(target),'alphaMin':int(alpha.min()),'alphaMax':int(alpha.max()),
                'borderAlphaMax':int(border.max()),'meanRGB':[round(float(x),3) for x in a[:,:,:3][alpha>127].mean(axis=0)]}
        if s['transparent']:
            assert alpha.min()==0 and alpha.max()>=alpha_peak_min and border.max()==0
        else:
            record.update(beforeSeams=before,seams=seam(a),contrastScale=contrast,rgbStd=[round(float(v),3) for v in a[:,:,:3].std(axis=(0,1))])
            assert record['seams']['edgeX']==0 and record['seams']['edgeY']==0
        report[s['id']]=record
        processed.append(s['id'])
    writej('measurements.json',report)
    contacts();manifest()
    summary={'processed':processed,'reused':reused,'technicalFailures':[k for k,v in report.items() if not v['technicalPass']]}
    writej('logs/last-prepare.json',summary);print(json.dumps(summary,ensure_ascii=False))
def manifest():
    checks=readj('measurements.json')
    decisions=readj('visual-review.json') if (ROOT/'visual-review.json').exists() else {}
    assets=[]
    for s in specs():
        m=checks.get(s['id'],{})
        if not m.get('technicalPass') or decisions.get(s['id'],{}).get('decision')!='pass':continue
        ground=s['layer']=='ground'
        assets.append({'id':s['id'],'revision':1,'file':f"{s['id']}.r1.png",'width':s['width'],'height':s['height'],
            'originX':0 if not s['transparent'] else .5,'originY':0 if not s['transparent'] else .5,
            'displayCells':s['displayCells'],'layer':s['layer'],'frames':1,'status':'draft',
            'sourceHash':m['sourceHash'],'artifactHash':m['artifactHash'],
            'producer':'image_gen.imagegen / 내장 도구; 세부 모델 버전 미공개','license':'자체 생성, 프로젝트 전용',
            'notes':f"원본 {m['source']}. "+('평균색·요청된 저대비 보정·16px 양축 경계 연결.' if not s['transparent'] else '생성 알파 보존, 비율 유지 축소 및 투명 여백.')+' 1차 자체 검수 통과, 총괄 인수 전 draft.'})
        if s['id']=='snow_step.landmark.pond':
            assets[-1].update(displayWidthCells=3,displayHeightCells=1.5)
            assets[-1]['notes']+=' 연못은 가로 3칸, 세로 1.5칸. 표시 시 displayWidthCells/displayHeightCells 사용.'
    writej('manifest.json',{'schemaVersion':'1','jobId':'ART-SS2','styleReferenceSha256':sha(PROJECT/'docs/assets/design-41-kingdom-expedition.png'),'assets':assets})
def contacts():
    ss=[s for s in specs() if (ROOT/f"{s['id']}.r1.png").exists()]
    for mode,bg,fg in [('light','#e8e1cb','#332c22'),('dark','#28392b','#eee6d2')]:
        board=Image.new('RGBA',(1440,70+math.ceil(len(ss)/4)*410),bg);d=ImageDraw.Draw(board)
        d.text((18,14),'ART-SS2 | 위: 원본 비율 256px 범위 / 아래: 64·48·32px',font=font(18),fill=fg)
        for i,s in enumerate(ss):
            x=i%4*360+12;y=55+i//4*410
            d.text((x,y),s['id'],font=font(13),fill=fg)
            im=Image.open(ROOT/f"{s['id']}.r1.png").convert('RGBA')
            t=im.copy();t.thumbnail((256,256),RESAMPLE)
            board.alpha_composite(t,(x+(330-t.width)//2,y+30+(256-t.height)//2))
            for n,px in enumerate([64,48,32]):
                t=im.copy();t.thumbnail((px,px),RESAMPLE)
                xx=x+22+n*105
                board.alpha_composite(t,(xx+(64-t.width)//2,y+300+(64-t.height)//2))
                d.text((xx+18,y+371),str(px),font=font(11),fill=fg)
        board.convert('RGB').save(ROOT/f'contact-sheet-{mode}.png')
def verify():
    manifest_data=readj('manifest.json');errors=[]
    decisions=readj('visual-review.json');generation=readj('generation-metadata.json');checks=readj('measurements.json')
    expected={s['id'] for s in specs() if decisions.get(s['id'],{}).get('decision')=='pass'}
    if expected!={a['id'] for a in manifest_data['assets']}:errors.append('자체 통과 목록과 manifest 불일치')
    if len(decisions)!=len(specs()):errors.append('항목별 자체 검수 누락')
    if len(manifest_data['assets'])!=12:errors.append('요청된 12종 누락')
    for ident,entry in generation.items():
        for a in entry['attempts']:
            if not (ROOT/a['source']).exists():errors.append(a['source']+' 원본 없음')
    for a in manifest_data['assets']:
        p=ROOT/a['file'];im=Image.open(p);arr=np.asarray(im)
        if list(im.size)!=[a['width'],a['height']] or sha(p)!=a['artifactHash'] or a['status']!='draft':errors.append(a['id']+' 크기/해시/status')
        alpha=arr[:,:,3];border=np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
        if alpha.min()!=0 or alpha.max()!=255 or border.max()!=0:errors.append(a['id']+' 알파')
    for name in ['contact-sheet-light.png','contact-sheet-dark.png']:
        if Image.open(ROOT/name).size!=(1440,1300):errors.append(name)
    if list(ROOT.glob('*.preview.*')):errors.append('요청하지 않은 합성 미리보기')
    result={'assetCount':len(manifest_data['assets']),'sourceCount':sum(len(e['attempts']) for e in generation.values()),'errors':errors,'automatedPass':not errors,'visualApproval':'자체 1차 검수 완료, 총괄 인수 미실행','appBuild':'미실행: 앱 코드 변경 없음','e2e':'미실행: 앱 코드 변경 없음','scope':'ART-SS2 내부만 작성. 외부 동시 작업은 별도 소유.'}
    writej('logs/final-verification.json',result);print(json.dumps(result,ensure_ascii=False,indent=2));assert not errors
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','verify']);args=parser.parse_args();globals()[args.action]()
