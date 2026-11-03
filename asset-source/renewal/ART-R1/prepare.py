#!/usr/bin/env python3
"""ART-R1 재현 처리. uv run --no-project --with pillow --with numpy python <이 파일> prepare|preview|verify

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
        if s['id']=='prop.fence.v':
            assets[-1].update(displayWidthCells=1,displayHeightCells=2)
            assets[-1]['notes']+=' 세로 울타리는 긴 축 2칸이며 가로 폭 1칸. 표시 시 displayWidthCells/displayHeightCells 사용.'
    writej('manifest.json',{'schemaVersion':'1','jobId':'ART-R1','styleReferenceSha256':sha(PROJECT/'docs/assets/design-41-kingdom-expedition.png'),'assets':assets})
def contacts():
    ss=[s for s in specs() if (ROOT/f"{s['id']}.r1.png").exists()]
    for mode,bg,fg in [('light','#e8e1cb','#332c22'),('dark','#28392b','#eee6d2')]:
        board=Image.new('RGBA',(1290,200+math.ceil(len(ss)/3)*122),bg);d=ImageDraw.Draw(board)
        d.text((18,14),'ART-R1 | 32 / 48 / 64 px | 하단: 기존 인수 그림 비교',font=font(18),fill=fg)
        for i,s in enumerate(ss):
            x=(i%3)*430+16;y=55+(i//3)*122
            d.text((x,y),s['id'],font=font(),fill=fg)
            im=Image.open(ROOT/f"{s['id']}.r1.png").convert('RGBA')
            for n,px in enumerate([32,48,64]):
                t=im.copy();t.thumbnail((px,px),RESAMPLE)
                board.alpha_composite(t,(x+20+n*105+(64-t.width)//2,y+28+(64-t.height)//2))
                d.text((x+24+n*105,y+99),str(px),font=font(11),fill=fg)
        fy=65+math.ceil(len(ss)/3)*122
        for i,key in enumerate(['deco.tree','deco.stele','tower.archer','tower.cannon','tower.frost']):
            im=Image.open(PROJECT/'public/assets'/f'{key}.r1.png').convert('RGBA').resize((64,64),RESAMPLE)
            board.alpha_composite(im,(30+i*252,fy+15));d.text((30+i*252,fy+87),key,font=font(),fill=fg)
            weapon=PROJECT/'public/assets'/f'{key}.weapon.r1.png'
            if weapon.exists():board.alpha_composite(Image.open(weapon).convert('RGBA').resize((64,64),RESAMPLE),(30+i*252,fy+15))
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
def tile(im,size):
    a=np.asarray(im.convert('RGBA'));return Image.fromarray(np.tile(a,(math.ceil(size[1]/im.height),math.ceil(size[0]/im.width),1))[:size[1],:size[0]])
def rounded_path(points,radius=76):
    result=[points[0]]
    for i in range(1,len(points)-1):
        p=np.array(points[i],float);v0=np.array(points[i-1],float)-p;v1=np.array(points[i+1],float)-p
        if np.dot(v0,v1)/(np.linalg.norm(v0)*np.linalg.norm(v1))<-.999:result.append(tuple(p));continue
        a=p+v0/np.linalg.norm(v0)*radius;b=p+v1/np.linalg.norm(v1)*radius
        result.append(tuple(a))
        for t in np.linspace(0,1,18):result.append(tuple((1-t)**2*a+2*(1-t)*t*p+t*t*b))
    result.append(points[-1]);return result
def pathmask(size,points,width):
    im=Image.new('L',size);d=ImageDraw.Draw(im)
    d.line(points,fill=255,width=width,joint='curve');r=width/2
    for x,y in points:d.ellipse((x-r,y-r,x+r,y+r),fill=255)
    return im
def render(with_towers):
    layout=readj('garden_u.layout.json');maps=json.loads((PROJECT/'docs/contracts/maps.candidate.v0.4.json').read_text())
    m=next(v for v in maps['maps'] if v['id']=='garden_u');size=(1920,1152)
    decoration_cells_used=[]
    for p in layout['placements']:
        if not p.get('decorationIds'):continue
        cells=[cell for decoration in m['decorations'] if decoration['id'] in p['decorationIds'] for cell in decoration['cells']]
        assert len(cells)==len(p['decorationIds']),p['key']
        offset=p.get('decorationOffsetCells',[0,0]);p['x']=sum(c[0] for c in cells)/len(cells)+offset[0];p['y']=sum(c[1] for c in cells)/len(cells)+offset[1]
        decoration_cells_used.append({'placement':p['key'],'decorationIds':p['decorationIds'],'cells':cells})
    canvas=tile(Image.open(ROOT/'ground.grass.base.r1.png'),size)
    for z in layout['groundBlends']:
        mask=Image.new('L',size);d=ImageDraw.Draw(mask)
        for e in z['ellipses']:d.ellipse(tuple(round(v*128) for v in e),fill=z['opacity'])
        mask=mask.filter(ImageFilter.GaussianBlur(z['blurPx']))
        canvas=Image.composite(tile(Image.open(ROOT/f"{z['id']}.r1.png"),size),canvas,mask)
    # 풀밭 얼룩은 길 아래 지면층에만 합성한다.
    for p in layout['placements']:
        if not p['id'].startswith('ground.meadow.'):continue
        file=ROOT/f"{p['id']}.r1.png"
        if not file.exists():continue
        im=Image.open(file).convert('RGBA');width=round(3*128*p['scale']);im=im.resize((width,width),RESAMPLE)
        canvas.alpha_composite(im,(round((p['x']+.5)*128-width/2),round((p['y']+.5)*128-width/2)))
    # pathCells가 원천이고, 방향이 바뀌는 꼭짓점만 뽑아 둥근 이음으로 잇는다.
    cells=m['pathCells'];turns=[cells[0]]
    for i in range(1,len(cells)-1):
        if (cells[i][0]-cells[i-1][0],cells[i][1]-cells[i-1][1])!=(cells[i+1][0]-cells[i][0],cells[i+1][1]-cells[i][1]):turns.append(cells[i])
    turns.append(cells[-1]);points=[((x+.5)*128,(y+.5)*128) for x,y in turns]
    points[0]=(-60,points[0][1]);points[-1]=(1980,points[-1][1]);points=rounded_path(points)
    outer=pathmask(size,points,108);inner=pathmask(size,points,96)
    # 손으로 정한 좁고 넓은 구간. 난수/정현파 사용 없음.
    d=ImageDraw.Draw(inner)
    for x,y,r in layout['pathBulges']:d.ellipse(((x+.5)*128-r,(y+.5)*128-r,(x+.5)*128+r,(y+.5)*128+r),fill=255)
    inner=inner.filter(ImageFilter.GaussianBlur(.7));outer=outer.filter(ImageFilter.GaussianBlur(1))
    canvas=Image.composite(Image.new('RGBA',size,'#92904d'),canvas,outer)
    canvas=Image.composite(tile(Image.open(ROOT/'path.dirt.r1.png'),size),canvas,inner)
    # 굽이의 짧은 두 줄 바퀴 자국. 실제 경로 꼭짓점에서만 수동 지정한다.
    ruts=Image.new('RGBA',size);rd=ImageDraw.Draw(ruts)
    for box,start,end in layout.get('wheelRuts',[]):
        rd.arc(tuple(round(v*128) for v in box),start,end,fill=(165,130,80,65),width=3)
        inset=9;rd.arc(tuple(round(v*128)+(inset if i<2 else -inset) for i,v in enumerate(box)),start+8,end-8,fill=(165,130,80,48),width=2)
    ruts.putalpha(Image.fromarray((np.asarray(ruts.getchannel('A')).astype(float)*np.asarray(inner)/255).astype('uint8')))
    canvas.alpha_composite(ruts)
    placements=[];overlap=[]
    protected=Image.new('L',size);pd=ImageDraw.Draw(protected)
    for s in m['slots']:
        cx=(s['x']+.5)*128;cy=(s['y']+.5)*128;pd.ellipse((cx-53,cy-37,cx+53,cy+37),fill=255)
    # 길 중심 폭 68px를 보호한다. 풀 술과 자갈만 외곽에 닿도록 허용한다.
    pcenter=pathmask(size,points,68)
    for p in layout['placements']:
        file=PROJECT/p['file'] if p.get('file') else ROOT/f"{p['id']}.r1.png"
        if not file.exists():continue
        im=Image.open(file).convert('RGBA');sp=next((s for s in specs() if s['id']==p['id']),None)
        width=p.get('widthCells',(sp['displayCells'] if sp else 1.05))*128*p['scale']
        im=im.resize((max(1,round(width)),max(1,round(width*im.height/im.width))),RESAMPLE)
        if p['flipX']:im=ImageOps.mirror(im)
        ox,oy=p.get('origin',[.5,.5]);x=round((p['x']+.5)*128-im.width*ox);y=round((p['y']+.5)*128-im.height*oy)
        silhouette=Image.new('L',size);silhouette.paste(im.getchannel('A'),(x,y))
        sa=np.asarray(silhouette);slot_pixels=int(np.count_nonzero((sa>127)&(np.asarray(protected)>0)))
        path_pixels=int(np.count_nonzero((sa>127)&(np.asarray(pcenter)>0)))
        strict=not p['id'].startswith(('path.','ground.meadow.'))
        if not p['id'].startswith('ground.meadow.'):
            if slot_pixels or (strict and path_pixels):overlap.append({'placement':p['key'],'slotPixels':slot_pixels,'pathCenterPixels':path_pixels})
            canvas.alpha_composite(im,(x,y))
        placements.append({'key':p['key'],'id':p['id'],'bbox':[x,y,x+im.width,y+im.height]})
    for i,s in enumerate(m['slots']):
        im=Image.open(ROOT/f"slot.pad.{i%2}.r1.png").convert('RGBA');im=im.resize((102,102),RESAMPLE)
        canvas.alpha_composite(im,(round((s['x']+.5)*128-51),round((s['y']+.5)*128-51)))
    if with_towers:
        ref=json.loads((PROJECT/'asset-source/incoming/ART-SAMPLE-001/manifest.json').read_text())['assets']
        for tower in layout['towers']:
            s=next(s for s in m['slots'] if s['id']==tower['slotId']);ident=tower['id'];a=next(a for a in ref if a['id']==ident)
            width=round(a['displayCells']*128);cx=(s['x']+.5)*128;cy=(s['y']+.5)*128
            for file in [f'{ident}.r1.png',f'{ident}.weapon.r1.png']:
                im=Image.open(PROJECT/'public/assets'/file).convert('RGBA').resize((width,width),RESAMPLE)
                canvas.alpha_composite(im,(round(cx-width*a['originX']),round(cy-width*a['originY']+8)))
    suffix='towers' if with_towers else 'empty'
    canvas.convert('RGB').save(ROOT/f'garden_u.preview.{suffix}.png')
    if not with_towers:writej('layout-measurements.json',{'size':list(size),'pathCells':len(cells),'slots':len(m['slots']),'decorationCellsUsed':decoration_cells_used,'placements':placements,'protectedOverlap':overlap,'note':'얼룩은 길과 받침 아래 지면층. 풀술/자갈은 길 가장자리에 허용. 나머지 불투명 알파 128 이상과 길 중심 68px/설치 받침 영역 충돌을 센다.'})
def preview():
    render(False);render(True)
    # 새 받침과 기존 타워의 실제 표시 비율을 크게 확인하는 판.
    board=Image.new('RGBA',(1000,340),'#7cbc4c');d=ImageDraw.Draw(board)
    for i,key in enumerate(['tower.archer','tower.cannon','tower.frost']):
        x=190+i*300;y=230;pad=Image.open(ROOT/f'slot.pad.{i%2}.r1.png').convert('RGBA').resize((102,102),RESAMPLE)
        board.alpha_composite(pad,(x-51,y-51))
        for fn in [f'{key}.r1.png',f'{key}.weapon.r1.png']:
            im=Image.open(PROJECT/'public/assets'/fn).convert('RGBA').resize((141,141),RESAMPLE)
            board.alpha_composite(im,(x-71,y-round(141*.8125)+8))
        d.text((x-75,280),key,font=font(16),fill='#332c22')
    board.convert('RGB').save(ROOT/'slot-tower-check.png')
    manifest();print('preview complete')
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
    for name in ['garden_u.preview.empty.png','garden_u.preview.towers.png']:
        if Image.open(ROOT/name).size!=(1920,1152):errors.append(name)
    layout=readj('layout-measurements.json')
    if layout['protectedOverlap']:errors.append('길 중심 또는 받침 가림')
    if sum(len(e['cells']) for e in layout['decorationCellsUsed'])!=5:errors.append('장식 칸 연결 누락')
    r={'assetCount':len(manifest_data['assets']),'errors':errors,'protectedChangesSinceBaseline':changed,
       'sourceCount':sum(len(e['attempts']) for e in generation.values()),'maxAttemptsPerItem':max(len(e['attempts']) for e in generation.values()),
       'rejectedItems':[k for k,v in decisions.items() if v['decision']=='reject'],'protectedOverlap':layout['protectedOverlap'],
       'gitStatus':subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=all'],cwd=PROJECT,text=True),
       'automatedPass':not errors,'visualApproval':'총괄 인수 미실행','appBuild':'미실행: 앱 코드 변경 없음','e2e':'미실행: 앱 코드 변경 없음'}
    writej('logs/final-verification.json',r);print(json.dumps(r,ensure_ascii=False,indent=2))
    assert not errors
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','preview','verify']);args=parser.parse_args()
    globals()[args.action]()
