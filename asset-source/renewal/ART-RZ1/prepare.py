#!/usr/bin/env python3
"""ART-RZ1 재현 처리. uv run --no-project --with pillow --with numpy python <이 파일> prepare|preview|verify

원본은 보존한다. 소품은 생성 알파를 유지한 잘라내기/비율 유지 축소만 한다.
지면만 ART-002와 같은 평균색 및 16px 경계 연결을 한다. 미술 통과 항목만 manifest에 쓴다.
"""
from pathlib import Path
import argparse, hashlib, json, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
RESAMPLE = Image.Resampling.LANCZOS
TARGETS = {'river_z.ground.base':(120,184,90),'river_z.ground.light':(136,196,106),
           'river_z.ground.shade':(105,163,78),'river_z.path.dirt':(216,196,142)}
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
        processing_key=hashlib.sha256(json.dumps([sha(source),s['width'],s['height'],s['transparent'],TARGETS.get(s['id']),'.28 grass/.6 dirt;16px edge;8px margin;alpha bbox;garden pad core-width and center;LANCZOS'],sort_keys=True).encode()).hexdigest()
        old=previous.get(s['id'],{});target=ROOT/f"{s['id']}.r1.png"
        if old.get('processingKey')==processing_key and target.exists() and old.get('artifactHash')==sha(target):
            report[s['id']]=old;reused.append(s['id']);continue
        im=Image.open(source).convert('RGBA');raw=np.asarray(im)
        alpha_peak_min=32 if s['id'].startswith('river_z.meadow.') else 250
        if s['transparent'] and (raw[:,:,3].min()!=0 or raw[:,:,3].max()<alpha_peak_min):
            report[s['id']]={'technicalPass':False,'reason':'생성 원본의 실제 알파 없음','source':str(source.relative_to(ROOT))};continue
        size=(s['width'],s['height']); bbox=None
        if s['transparent']:
            bbox=im.getchannel('A').getbbox()
            crop=im.crop(bbox)
            fit=(size[0]-8,size[1]-8)
            if s['id'].startswith('river_z.slot.pad.'):
                ref=Image.open(PROJECT/'asset-source/renewal/ART-R1'/f"{s['id'].removeprefix('river_z.')}.r1.png").convert('RGBA')
                reference_core=ref.getchannel('A').point(lambda value:255 if value>127 else 0).getbbox()
                source_core=crop.getchannel('A').point(lambda value:255 if value>127 else 0).getbbox()
                scale=(reference_core[2]-reference_core[0])/(source_core[2]-source_core[0])
                scale=min(scale,fit[0]/crop.width,fit[1]/crop.height)
                crop=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),RESAMPLE)
                x=round((reference_core[0]+reference_core[2])/2-(source_core[0]+source_core[2])*scale/2)
                y=round((reference_core[1]+reference_core[3])/2-(source_core[1]+source_core[3])*scale/2)
            else:
                crop.thumbnail(fit,RESAMPLE)
                x=(size[0]-crop.width)//2
                y=(size[1]-crop.height)//2
            out=Image.new('RGBA',size)
            out.alpha_composite(crop,(x,y))
        else:
            out=im.resize(size,RESAMPLE)
            a=np.asarray(out).copy()
            assert a[:,:,3].min()==255, s['id']
            before=seam(a)
            mean=a[:,:,:3].mean(axis=(0,1))
            contrast=.28 if s['id'].startswith('river_z.ground.') else .6
            a[:,:,:3]=np.clip(np.rint((a[:,:,:3].astype(float)-mean)*contrast+np.array(TARGETS[s['id']])),0,255)
            out=Image.fromarray(connect(a))
        target=ROOT/f"{s['id']}.r1.png";out.save(target)
        a=np.asarray(out); alpha=a[:,:,3]; border=np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
        record={'technicalPass':True,'processingKey':processing_key,'width':out.width,'height':out.height,'pngColorType':target.read_bytes()[25],
                'source':str(source.relative_to(ROOT)),'sourceSize':list(im.size),'sourceBBox':bbox,
                'sourceHash':sha(source),'artifactHash':sha(target),'alphaMin':int(alpha.min()),'alphaMax':int(alpha.max()),
                'borderAlphaMax':int(border.max()),'meanRGB':[round(float(x),3) for x in a[:,:,:3][alpha>127].mean(axis=0)],
                'visibleBBox':Image.fromarray((alpha>127).astype('uint8')*255).getbbox()}
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
        assets.append({'id':s['id'],'revision':1,'file':f"{s['id']}.r1.png",'width':s['width'],'height':s['height'],
            'originX':0 if not s['transparent'] else .5,'originY':0 if not s['transparent'] else .5,
            'displayCells':s['displayCells'],'layer':s['layer'],'frames':1,'status':'draft',
            'sourceHash':m['sourceHash'],'artifactHash':m['artifactHash'],
            'producer':'image_gen.imagegen / 내장 도구; 세부 모델 버전 미공개','license':'자체 생성, 프로젝트 전용',
            'notes':f"원본 {m['source']}. "+('평균색·요청된 저대비 보정·16px 양축 경계 연결.' if not s['transparent'] else '생성 알파 보존, 비율 유지 축소 및 투명 여백.')+(' 정원 동일 번호 받침의 불투명 알파 폭·중심에 맞춤.' if s['id'].startswith('river_z.slot.pad.') else '')+' 1차 자체 검수 통과, 총괄 인수 전 draft.'})
    writej('manifest.json',{'schemaVersion':'1','jobId':'ART-RZ1','styleReferenceSha256':sha(PROJECT/'docs/assets/design-41-kingdom-expedition.png'),'assets':assets})
def contacts():
    ss=[s for s in specs() if (ROOT/f"{s['id']}.r1.png").exists()]
    for mode,bg,fg in [('light','#e8e1cb','#332c22'),('dark','#28392b','#eee6d2')]:
        board=Image.new('RGBA',(1290,200+math.ceil(len(ss)/3)*122),bg);d=ImageDraw.Draw(board)
        d.text((18,14),'ART-RZ1 | 32 / 48 / 64 px | 하단 정원 받침 및 기존 인수 그림 비교',font=font(18),fill=fg)
        for i,s in enumerate(ss):
            x=(i%3)*430+16;y=55+(i//3)*122
            d.text((x,y),s['id'],font=font(),fill=fg)
            im=Image.open(ROOT/f"{s['id']}.r1.png").convert('RGBA')
            for n,px in enumerate([32,48,64]):
                t=im.copy();t.thumbnail((px,px),RESAMPLE)
                board.alpha_composite(t,(x+20+n*105+(64-t.width)//2,y+28+(64-t.height)//2))
                d.text((x+24+n*105,y+99),str(px),font=font(11),fill=fg)
        fy=65+math.ceil(len(ss)/3)*122
        reference_files=[('garden slot 0',PROJECT/'asset-source/renewal/ART-R1/slot.pad.0.r1.png'),
                         ('garden slot 1',PROJECT/'asset-source/renewal/ART-R1/slot.pad.1.r1.png')]
        reference_files += [(key,PROJECT/'public/assets'/f'{key}.r1.png') for key in ['deco.tree','deco.stele','tower.archer','tower.cannon','tower.frost']]
        for i,(key,path) in enumerate(reference_files):
            im=Image.open(path).convert('RGBA').resize((64,64),RESAMPLE)
            board.alpha_composite(im,(30+i*180,fy+15))
            d.text((30+i*180,fy+87),key,font=font(),fill=fg)
            weapon=PROJECT/'public/assets'/f'{key}.weapon.r1.png'
            if weapon.exists():board.alpha_composite(Image.open(weapon).convert('RGBA').resize((64,64),RESAMPLE),(30+i*180,fy+15))
        board.convert('RGB').save(ROOT/f'contact-sheet-{mode}.png')
    # 원본 크기 2x2 반복: 각 질감의 이음매와 반복을 시각 확인한다.
    tiles=Image.new('RGB',(2048,550),'#e8e1cb');d=ImageDraw.Draw(tiles)
    for i,key in enumerate(TARGETS):
        p=ROOT/f'{key}.r1.png'
        if not p.exists():continue
        im=Image.open(p).convert('RGB')
        for y in range(2):
            for x in range(2):tiles.paste(im,(i*512+x*256,38+y*256))
        d.text((i*512+12,10),key,font=font(),fill='#332c22')
    tiles.save(ROOT/'tile-check.png')
def verify():
    baseline=readj('preservation-baseline.json');changed=[]
    for p,h in baseline['protected'].items():
        f=PROJECT/p
        if not f.exists() or sha(f)!=h:changed.append(p)
    # 동시 작업은 별도 기록하고, 이 패키지의 출력 파일만 검사한다.
    manifest_data=readj('manifest.json');errors=[]
    decisions=readj('visual-review.json');generation=readj('generation-metadata.json')
    expected={s['id'] for s in specs() if decisions.get(s['id'],{}).get('decision')=='pass'}
    if expected!={a['id'] for a in manifest_data['assets']}:errors.append('자체 통과 목록과 manifest 불일치')
    if len(decisions)!=len(specs()):errors.append('항목별 자체 검수 누락')
    for ident,entry in generation.items():
        if len(entry['attempts'])>3:errors.append(ident+' 생성 횟수 초과')
        for a in entry['attempts']:
            if not (ROOT/a['source']).exists():errors.append(a['source']+' 원본 없음')
    for a in manifest_data['assets']:
        p=ROOT/a['file'];im=Image.open(p)
        if list(im.size)!=[a['width'],a['height']] or sha(p)!=a['artifactHash'] or a['status']!='draft':errors.append(a['id'])
    if len(manifest_data['assets'])!=12:errors.append('12장 draft 미완료')
    measurements=readj('measurements.json')
    for spec in specs():
        entry=measurements.get(spec['id'],{})
        if not entry.get('technicalPass'):errors.append(spec['id']+' 기술 검사 실패')
        path=ROOT/f"{spec['id']}.r1.png"
        if not path.exists():continue
        image=Image.open(path).convert('RGBA')
        alpha=np.asarray(image)[:,:,3]
        if spec['transparent']:
            border=np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
            if alpha.min()!=0 or border.max()!=0:errors.append(spec['id']+' 알파/여백 오류')
        elif alpha.min()!=255 or any(seam(np.asarray(image))[key]!=0 for key in ['edgeX','edgeY']):
            errors.append(spec['id']+' 불투명/이음매 오류')
    for mode in ['light','dark']:
        if not (ROOT/f'contact-sheet-{mode}.png').exists():errors.append('접촉판 누락 '+mode)
    r={'assetCount':len(manifest_data['assets']),'errors':errors,'protectedChangesSinceBaseline':changed,
       'sourceCount':sum(len(e['attempts']) for e in generation.values()),'maxAttemptsPerItem':max(len(e['attempts']) for e in generation.values()),
       'rejectedItems':[k for k,v in decisions.items() if v['decision']=='reject'],
       'gitStatus':subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=all'],cwd=PROJECT,text=True),
       'automatedPass':not errors,'visualApproval':'총괄 인수 미실행','appBuild':'미실행. 아트 재료만 변경','e2e':'미실행. 아트 재료만 변경'}
    writej('logs/final-verification.json',r);print(json.dumps(r,ensure_ascii=False,indent=2))
    assert not errors
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','verify']);args=parser.parse_args()
    globals()[args.action]()
