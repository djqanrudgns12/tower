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
BASE=PROJECT/'public/assets/tower.archer.r1.png'
FOOT_Y=128

def readj(name):return json.loads((ROOT/name).read_text())
def writej(name,obj):(ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def specs():return readj('prompts.json')['prompts']
def font(size=14):return ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc',size)
def resolve(ident):
    p=ROOT/f'{ident}.r1.png'
    return p if p.exists() else R1/f'{ident}.r1.png'
def prepare():
    report=readj('measurements.json') if (ROOT/'measurements.json').exists() else {}
    meta=readj('generation-metadata.json');processed=[];reused=[]
    for s in specs():
        entry=meta.get(s['id'],{});source=entry.get('selectedSource')
        if not source:continue
        source=ROOT/source;target=ROOT/f"{s['id']}.r1.png"
        key=hashlib.sha256(json.dumps([sha(source),s['width'],s['height'],sha(BASE) if s['layer']=='tower' else None,FOOT_Y,'alpha-bbox;LANCZOS;anchor-bottom160;8px-margin']).encode()).hexdigest()
        if report.get(s['id'],{}).get('processingKey')==key and target.exists() and sha(target)==report[s['id']]['artifactHash']:
            reused.append(s['id']);continue
        im=Image.open(source).convert('RGBA');a=np.asarray(im)
        assert a[:,:,3].min()==0 and a[:,:,3].max()==255,s['id']+' 실제 알파 없음'
        bbox=im.getchannel('A').getbbox();crop=im.crop(bbox);out=Image.new('RGBA',(s['width'],s['height']))
        if s['layer']=='tower':
            crop.thumbnail((168,150),RESAMPLE);x=(192-crop.width)//2;y=160-crop.height
            out.alpha_composite(crop,(x,y))
            base=Image.open(BASE).convert('RGBA')
            out.paste(base.crop((0,FOOT_Y,192,192)),(0,FOOT_Y))
        else:
            crop.thumbnail((s['width']-8,s['height']-8),RESAMPLE);x=(s['width']-crop.width)//2;y=(s['height']-crop.height)//2
            out.alpha_composite(crop,(x,y))
        out.save(target);aa=np.asarray(out);alpha=aa[:,:,3]
        border=np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
        record={'technicalPass':bool(alpha.min()==0 and alpha.max()==255 and border.max()==0),'processingKey':key,'width':out.width,'height':out.height,'pngColorType':target.read_bytes()[25],'source':str(source.relative_to(ROOT)),'sourceSize':list(im.size),'sourceBBox':bbox,'sourceHash':sha(source),'artifactHash':sha(target),'alphaMin':int(alpha.min()),'alphaMax':int(alpha.max()),'borderAlphaMax':int(border.max()),'placedCrop':[x,y,crop.width,crop.height]}
        if s['layer']=='tower':record.update(baseSliceStartY=FOOT_Y,baseSliceHash=hashlib.sha256(aa[FOOT_Y:].tobytes()).hexdigest(),baseSliceExact=bool(np.array_equal(aa[FOOT_Y:],np.asarray(base)[FOOT_Y:])),anchor=[96,156])
        if s['layer']=='edge':
            interior=np.asarray(Image.fromarray((alpha>32).astype('uint8')*255).filter(ImageFilter.MinFilter(9)))>0
            record['semiTransparentInteriorPixels']=int(((alpha<245)&(alpha>16)&interior).sum())
        report[s['id']]=record;processed.append(s['id'])
    writej('measurements.json',report);contacts();manifest();print(json.dumps({'processed':processed,'reused':reused},ensure_ascii=False))
def manifest():
    checks=readj('measurements.json') if (ROOT/'measurements.json').exists() else {}
    reviews=readj('visual-review.json') if (ROOT/'visual-review.json').exists() else {};assets=[]
    for s in specs():
        m=checks.get(s['id'],{})
        if not m.get('technicalPass') or reviews.get(s['id'],{}).get('decision')!='pass':continue
        assets.append({k:s[k] for k in ['id','width','height','displayCells','layer','originX','originY']})
        assets[-1].update(revision=1,file=f"{s['id']}.r1.png",frames=1,status='draft',sourceHash=m['sourceHash'],artifactHash=m['artifactHash'],producer='image_gen.imagegen / 내장 도구; 세부 모델 버전 미공개',license='자체 생성, 프로젝트 전용',notes='원본 생성 알파 보존·비율 유지 축소. 자체 시각 검수 통과, 총괄 인수 전 draft.'+(' 기본형 y128..191 RGBA 완전 동일. 본체만, 무기 없음.' if s['layer']=='tower' else ' 명암·손맛은 시각 검수 기준.'))
        if 'displayHeightCells' in s:assets[-1]['displayHeightCells']=s['displayHeightCells']
    writej('manifest.json',{'schemaVersion':'1','jobId':'ART-R2','styleReferenceSha256':sha(PROJECT/'docs/assets/design-41-kingdom-expedition.png'),'baseReferenceSha256':sha(BASE),'assets':assets})
def contacts():
    forms=['base','A','B','A1','A2','B1','B2']
    for mode,bg,fg in [('light','#e8e1cb','#332c22'),('dark','#28392b','#eee6d2')]:
        board=Image.new('RGBA',(1680,870),bg);d=ImageDraw.Draw(board)
        d.text((22,12),'ART-R2 궁수 진화 | 본체만 · 상부 사선 · 기본형 하단 원본 보존',font=font(21),fill=fg)
        for i,f in enumerate(forms):
            p=BASE if f=='base' else ROOT/f'tower.archer.{f}.r1.png'
            if not p.exists():continue
            im=Image.open(p).convert('RGBA');x=i*240+24
            d.text((x,52),f'{f} / '+({'base':'기본','A':'속사','B':'정찰','A1':'톱니','A2':'깃털','B1':'매','B2':'과녁'}[f]),font=font(17),fill=fg)
            board.alpha_composite(im,(x,80))
            for row,px in enumerate([64,48,32]):
                yy=310+row*100;small=im.resize((px,px),RESAMPLE)
                board.alpha_composite(small,(x+(192-px)//2,yy));d.text((x+6,yy+10),str(px),font=font(13),fill=fg)
            pad=Image.open(R1/'slot.pad.0.r1.png').convert('RGBA');pad=pad.crop(pad.getchannel('A').getbbox());pad.thumbnail((102,102),RESAMPLE)
            cx=x+96;cy=745;board.alpha_composite(pad,(cx-pad.width//2,cy-pad.height//2))
            full=im.resize((134,134),RESAMPLE);board.alpha_composite(full,(cx-67,cy-round(134*.8125)))
            d.line([(cx-5,cy),(cx+5,cy)],fill='#a44c36',width=1)
        d.text((22,825),'하단: slot.pad.0 알파 영역을 0.8칸에 맞춤 + 타워1.05칸, origin=(0.5,0.8125), 기준점 고정',font=font(17),fill=fg)
        board.convert('RGB').save(ROOT/f'evolution-lineup-{mode}.png')
        plants=[s for s in specs() if s['layer']=='edge' and resolve(s['id']).exists()]
        b=Image.new('RGBA',(1440,630),bg);dd=ImageDraw.Draw(b)
        dd.text((20,15),'ART-R2 숲 · 덤불 | 위: 256px 범위 / 아래: 64·48·32px | 우측 기존 나무',font=font(19),fill=fg)
        for i,s in enumerate(plants):
            x=i*240+10;im=Image.open(resolve(s['id'])).convert('RGBA');t=im.copy();t.thumbnail((222,270),RESAMPLE)
            dd.text((x,60),s['id'],font=font(16),fill=fg);b.alpha_composite(t,(x+(222-t.width)//2,105+(270-t.height)//2))
            for row,px in enumerate([64,48,32]):
                t=im.copy();t.thumbnail((px,px),RESAMPLE);yy=405+row*65;b.alpha_composite(t,(x+80,yy));dd.text((x+20,yy+6),str(px),font=font(12),fill=fg)
        ref=Image.open(PROJECT/'public/assets/deco.tree.r1.png').convert('RGBA');b.alpha_composite(ref,(1220,130));dd.text((1220,60),'기존 deco.tree',font=font(16),fill=fg)
        b.convert('RGB').save(ROOT/f'contact-sheet-{mode}.png')

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
    canvas=tile(Image.open(R1/'ground.grass.base.r1.png'),size)
    for z in layout['groundBlends']:
        mask=Image.new('L',size);d=ImageDraw.Draw(mask)
        for e in z['ellipses']:d.ellipse(tuple(round(v*128) for v in e),fill=z['opacity'])
        mask=mask.filter(ImageFilter.GaussianBlur(z['blurPx']))
        canvas=Image.composite(tile(Image.open(resolve(z['id'])),size),canvas,mask)
    # 풀밭 얼룩은 길 아래 지면층에만 합성한다.
    for p in layout['placements']:
        if not p['id'].startswith('ground.meadow.'):continue
        file=resolve(p['id'])
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
    canvas=Image.composite(tile(Image.open(R1/'path.dirt.r1.png'),size),canvas,inner)
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
        file=PROJECT/p['file'] if p.get('file') else resolve(p['id'])
        if not file.exists():continue
        im=Image.open(file).convert('RGBA');sp=next((s for s in specs()+json.loads((R1/'prompts.json').read_text())['prompts'] if s['id']==p['id']),None)
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
        im=Image.open(R1/f"slot.pad.{i%2}.r1.png").convert('RGBA');im=im.resize((102,102),RESAMPLE)
        canvas.alpha_composite(im,(round((s['x']+.5)*128-51),round((s['y']+.5)*128-51)))
    if with_towers:
        ref=json.loads((PROJECT/'asset-source/incoming/ART-SAMPLE-001/manifest.json').read_text())['assets']
        for tower in layout['towers']:
            s=next(s for s in m['slots'] if s['id']==tower['slotId']);ident=tower['id'];a=next(a for a in ref if a['id']==ident)
            width=round(a['displayCells']*128);cx=(s['x']+.5)*128;cy=(s['y']+.5)*128
            for file in [f'{ident}.r1.png',f'{ident}.weapon.r1.png']:
                im=Image.open(PROJECT/'public/assets'/file).convert('RGBA').resize((width,width),RESAMPLE)
                canvas.alpha_composite(im,(round(cx-width*a['originX']),round(cy-width*a['originY'])))
    if with_towers:
        for tower in layout['evolvedTowers']:
            slotid=tower['slotId'];p=ROOT/f"{tower['id']}.r1.png"
            if not p.exists():continue
            slot=next(v for v in m['slots'] if v['id']==slotid);width=round(1.05*128)
            im=Image.open(p).convert('RGBA').resize((width,width),RESAMPLE)
            cx=(slot['x']+.5)*128;cy=(slot['y']+.5)*128
            canvas.alpha_composite(im,(round(cx-width*.5),round(cy-width*.8125)))
    tower_bounds=[]
    for tower in layout['evolvedTowers']:
        file=ROOT/f"{tower['id']}.r1.png"
        if not file.exists():continue
        slot=next(v for v in m['slots'] if v['id']==tower['slotId']);width=round(tower['displayCells']*128)
        im=Image.open(file).convert('RGBA').resize((width,width),RESAMPLE);b=im.getchannel('A').getbbox()
        x=round((slot['x']+.5)*128-width*.5);y=round((slot['y']+.5)*128-width*.8125)
        bounds=[x+b[0],y+b[1],x+b[2],y+b[3]]
        tower_bounds.append({'id':tower['id'],'slotId':tower['slotId'],'opaqueBBox':bounds,'clipped':bounds[0]<0 or bounds[1]<0 or bounds[2]>size[0] or bounds[3]>size[1]})
    suffix='towers' if with_towers else 'empty'
    canvas.convert('RGB').save(ROOT/f'garden_u.preview.{suffix}.png')
    if not with_towers:writej('layout-measurements.json',{'size':list(size),'pathCells':len(cells),'slots':len(m['slots']),'decorationCellsUsed':decoration_cells_used,'placements':placements,'protectedOverlap':overlap,'evolvedTowerBounds':tower_bounds,'towerViewportClips':[t for t in tower_bounds if t['clipped']],'note':'얼룩은 길과 받침 아래 지면층. 풀술/자갈은 길 가장자리에 허용. 나머지 불투명 알파 128 이상과 길 중심 68px/설치 받침 영역 충돌을 센다.'})

def preview():
    render(False);render(True);contacts();manifest();print('preview complete')
def verify():
    baseline=readj('preservation-baseline.json');protected_changes=[]
    for name,h in baseline['protected'].items():
        p=PROJECT/name
        if not p.exists() or sha(p)!=h:protected_changes.append(name)
    errors=[];interior_alpha={};spec_by_id={s['id']:s for s in specs()};reviews=readj('visual-review.json');meta=readj('generation-metadata.json');checks=readj('measurements.json');assets=readj('manifest.json')['assets']
    expected={k for k,v in reviews.items() if v['decision']=='pass'}
    if expected!={a['id'] for a in assets}:errors.append('자체 통과 목록과 manifest 불일치')
    if set(reviews)!=set(spec_by_id):errors.append('항목별 검수 누락')
    for ident,e in meta.items():
        if len(e['attempts'])>3:errors.append(ident+' 3회 초과')
        for attempt in e['attempts']:
            if not (ROOT/attempt['source']).exists():errors.append(attempt['source']+' 원본 없음')
    base=np.asarray(Image.open(BASE).convert('RGBA'))
    for a in assets:
        p=ROOT/a['file'];im=Image.open(p).convert('RGBA');arr=np.asarray(im);alpha=arr[:,:,3]
        if im.size!=(a['width'],a['height']) or sha(p)!=a['artifactHash'] or a['status']!='draft':errors.append(a['id']+' 규격/hash/status')
        if alpha.min()!=0 or alpha.max()!=255 or np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]]).max()!=0:errors.append(a['id']+' 알파/테두리')
        if a['layer']=='edge':
            interior=np.asarray(Image.fromarray((alpha>32).astype('uint8')*255).filter(ImageFilter.MinFilter(9)))>0
            interior_alpha[a['id']]=int(((alpha<245)&(alpha>16)&interior).sum())
            if interior_alpha[a['id']]:errors.append(a['id']+' 수관/덤불 내부 반투명 얼룩')
        if a['layer']=='tower':
            if not np.array_equal(arr[FOOT_Y:],base[FOOT_Y:]):errors.append(a['id']+' 하단 변경')
            if (a['originX'],a['originY'])!=(.5,.8125):errors.append(a['id']+' 기준점 변경')
    layout=readj('layout-measurements.json')
    if layout['protectedOverlap']:errors.append('길/설치 받침 가림')
    if layout['towerViewportClips']:errors.append('진화 타워 뷰포트 잘림')
    for name in ['garden_u.preview.empty.png','garden_u.preview.towers.png']:
        if Image.open(ROOT/name).size!=(1920,1152):errors.append(name+' 크기')
    # 원문 경로/앱 파일은 보호하되, 다른 동료의 변경은 사실 그대로 따로 기록한다.
    status=subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=all'],cwd=PROJECT,text=True)
    r={'assetCount':len(assets),'sourceCount':sum(len(e['attempts']) for e in meta.values()),'maxAttemptsPerItem':max((len(e['attempts']) for e in meta.values()),default=0),'errors':errors,'automatedPass':not errors,'protectedChangesSinceBaseline':protected_changes,'protectedOverlap':layout['protectedOverlap'],'towerViewportClips':layout['towerViewportClips'],'floraInteriorAlphaPixels':interior_alpha,'towerBaseExact':{a['id']:checks[a['id']].get('baseSliceExact') for a in assets if a['layer']=='tower'},'visualApproval':'총괄 인수 미실행','appBuild':'미실행: 앱 코드 변경 없음','e2e':'미실행: 앱 코드 변경 없음','gitStatus':status}
    writej('logs/final-verification.json',r)
    (ROOT/'file-list.txt').write_text('\n'.join(sorted({str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file()}|{'file-list.txt'}))+'\n')
    print(json.dumps({k:v for k,v in r.items() if k!='gitStatus'},ensure_ascii=False,indent=2));assert not errors
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','preview','verify']);args=parser.parse_args();globals()[args.action]()
