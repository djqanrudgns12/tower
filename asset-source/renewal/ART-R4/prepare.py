#!/usr/bin/env python3
"""ART-R3 prepare.py 재사용: 원본/알파 보존, support8+bbox4, 비율유지 LANCZOS, 해시/접촉판/manifest.
신규 기본형용 변경: 기존 타워 하단 덮어쓰기 제외, bottom170, 무기 장착점 합성, 20종 로스터.
uv run --no-project --with pillow --with numpy python asset-source/renewal/ART-R4/prepare.py prepare|preview|verify
"""
from pathlib import Path
import argparse, hashlib, json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
R1=ROOT.parent/'ART-R1'
RESAMPLE=Image.Resampling.LANCZOS
OLD=['archer','cannon','frost','crossbow','mage','lightning','flame','spear','guardian','banner']
NEW=['sling','ballista','falcon','mortar','hwacha','roller','alchemist','wind','trap','bell']
NAMES=dict(zip(OLD+NEW,['궁수탑','포탑','서리탑','석궁탑','마법탑','번개탑','화염탑','창병초소','수호기사','깃발초소','투석초소','거대노포','매사냥대','박격포대','화차대','통나무굴림대','약병투척소','바람개비탑','덫공방초소','종각초소']))
def readj(name): return json.loads((ROOT/name).read_text())
def writej(name,obj): (ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def specs(): return readj('prompts.json')['prompts']
def font(size=14): return ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc',size)
def resolve(tower,weapon=False): return (PROJECT/'public/assets' if tower in OLD else ROOT)/f'tower.{tower}{".weapon" if weapon else ""}.r1.png'
def body_spec(tower): return next(s for s in specs() if s['id']==f'tower.{tower}')
def prepare():
    report=readj('measurements.json') if (ROOT/'measurements.json').exists() else {}
    meta=readj('generation-metadata.json');processed=[];reused=[]
    for s in specs():
        entry=meta.get(s['id'],{});source=entry.get('selectedSource')
        if not source: continue
        source=ROOT/source;target=ROOT/f"{s['id']}.r1.png"
        key=hashlib.sha256(json.dumps([sha(source),s['fit'],s.get('anchorBottom'),s.get('pivot'), 'ART-R3 support8+bbox4;LANCZOS;alpha-preserved;new-body']).encode()).hexdigest()
        if report.get(s['id'],{}).get('processingKey')==key and target.exists() and sha(target)==report[s['id']]['artifactHash']:
            reused.append(s['id']);continue
        im=Image.open(source).convert('RGBA');a=np.asarray(im)
        assert a[:,:,3].min()==0 and a[:,:,3].max()==255,s['id']+' 실제 알파 없음'
        support=Image.fromarray((a[:,:,3]>=8).astype('uint8')*255).getbbox()
        bbox=(max(0,support[0]-4),max(0,support[1]-4),min(im.width,support[2]+4),min(im.height,support[3]+4))
        crop=im.crop(bbox);crop.thumbnail(tuple(s['fit']),RESAMPLE)
        out=Image.new('RGBA',(192,192));x=(192-crop.width)//2
        y=s['anchorBottom']-crop.height if s['layer']=='body' else (192-crop.height)//2
        if s.get('pivot'):
            px,py=s['pivot'];x=round(96-(px-bbox[0])*crop.width/(bbox[2]-bbox[0]));y=round(96-(py-bbox[1])*crop.height/(bbox[3]-bbox[1]))
        out.alpha_composite(crop,(x,y));out.save(target);alpha=np.asarray(out)[:,:,3]
        border=np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]])
        report[s['id']]={'technicalPass':bool(alpha.min()==0 and alpha.max()==255 and border.max()==0),'processingKey':key,'width':192,'height':192,'pngColorType':target.read_bytes()[25],'source':str(source.relative_to(ROOT)),'sourceSize':list(im.size),'sourceBBox':bbox,'sourceHash':sha(source),'artifactHash':sha(target),'alphaMin':int(alpha.min()),'alphaMax':int(alpha.max()),'borderAlphaMax':int(border.max()),'placedCrop':[x,y,crop.width,crop.height],'visibleBBox':list(Image.fromarray(alpha).getbbox()),'origin':[s['originX'],s['originY']]}
        processed.append(s['id'])
    writej('measurements.json',report);contacts();manifest();print(json.dumps({'processed':processed,'reused':reused},ensure_ascii=False))
def assembled(tower):
    p=resolve(tower)
    if not p.exists():return None
    body=Image.open(p).convert('RGBA');w=resolve(tower,True)
    if not w.exists():return body
    if tower in OLD:mount=(96,156-192*.64/1.1);ratio=.8/1.1
    else:
        mount=body_spec(tower)['weaponMount'];weapon_spec=next(s for s in specs() if s['id']==f'tower.{tower}.weapon');ratio=weapon_spec['displayCells']/body_spec(tower)['displayCells']
    sz=round(192*ratio);weapon=Image.open(w).convert('RGBA').resize((sz,sz),RESAMPLE)
    out=body.copy();out.alpha_composite(weapon,(round(mount[0]-sz/2),round(mount[1]-sz/2)))
    return out

def contacts():
    composites=ROOT/'composites';composites.mkdir(exist_ok=True)
    for tower in NEW:
        im=assembled(tower)
        if im:im.save(composites/f'tower.{tower}.assembled.png')
    pad=Image.open(R1/'slot.pad.0.r1.png').convert('RGBA');pad=pad.crop(pad.getchannel('A').getbbox())
    for mode,bg,fg in [('light','#e8e1cb','#332c22'),('dark','#28392b','#eee6d2')]:
        board=Image.new('RGBA',(2460,860),bg);d=ImageDraw.Draw(board)
        d.text((20,14),'ART-R4 기본형 20종 | 기존 10 + 신규 10 | 자체 검수 후보 / 총괄 인수 전',font=font(23),fill=fg)
        rows=[('본체 64',105,64,False),('합성 64',220,64,True),('합성 48',335,48,True),('합성 32',440,32,True)]
        for i,t in enumerate(OLD+NEW):
            x=95+i*117;cx=x+48
            d.text((x,58),t,font=font(15),fill=fg);d.text((x,80),NAMES[t],font=font(13),fill=fg)
            p=resolve(t);im=Image.open(p).convert('RGBA') if p.exists() else None
            full=assembled(t)
            if im is None:
                d.text((x,145),'미완료',font=font(15),fill=fg);continue
            for label,yy,px,combined in rows:
                small=(full if combined else im).resize((px,px),RESAMPLE)
                board.alpha_composite(small,(cx-px//2,yy))
            for yy,px in [(585,64),(690,48),(775,32)]:
                pp=pad.copy();pp.thumbnail((round(px*.8),round(px*.8)),RESAMPLE)
                board.alpha_composite(pp,(cx-pp.width//2,yy-pp.height//2))
                sz=round(px*1.05);small=full.resize((sz,sz),RESAMPLE)
                board.alpha_composite(small,(cx-sz//2,yy-round(sz*.8125)))
            if t in NEW:
                review=readj('visual-review.json') if (ROOT/'visual-review.json').exists() else {}
                decision=review.get('tower.'+t,{}).get('decision','대기')
                d.text((x,824),decision,font=font(13),fill=fg)
        for label,yy,px,c in rows:d.text((10,yy+16),label,font=font(14),fill=fg)
        for label,yy in [('받침64',575),('받침48',680),('받침32',765)]:d.text((10,yy),label,font=font(14),fill=fg)
        d.line((95+10*117-9,54,95+10*117-9,845),fill='#aa7750',width=2)
        board.convert('RGB').save(ROOT/f'roster-contact-{mode}.png')
    detail=Image.new('RGBA',(1920,650),'#e8e1cb');d=ImageDraw.Draw(detail)
    for i,t in enumerate(NEW):
        x=i*192;d.text((x+8,8),t,font=font(17),fill='#332c22')
        for yy,p in [(42,resolve(t)),(240,resolve(t,True)),(440,composites/f'tower.{t}.assembled.png')]:
            if p.exists():detail.alpha_composite(Image.open(p).convert('RGBA'),(x,yy))
    detail.convert('RGB').save(ROOT/'new-layers-detail.png')
def manifest():
    checks=readj('measurements.json') if (ROOT/'measurements.json').exists() else {}
    reviews=readj('visual-review.json') if (ROOT/'visual-review.json').exists() else {};assets=[];holds=[]
    for s in specs():
        m=checks.get(s['id'],{});rev=reviews.get(s['id'],{})
        if not m.get('technicalPass') or rev.get('decision')!='pass':
            holds.append({'id':s['id'],'decision':rev.get('decision','pending'),'reason':rev.get('reason','생성/검수 전')});continue
        a={k:s[k] for k in ['id','width','height','displayCells','layer','originX','originY']}
        if s.get('muzzle'):a['muzzle']=s['muzzle'];a['muzzleCalibration']=s['muzzleCalibration']
        if s.get('weaponMount'):a['weaponMount']={'x':s['weaponMount'][0],'y':s['weaponMount'][1],'weaponScaleToBody':next(w['displayCells'] for w in specs() if w['id']==s['id']+'.weapon')/s['displayCells']}
        a.update(revision=1,file=f"{s['id']}.r1.png",frames=1,status='draft',sourceHash=m['sourceHash'],artifactHash=m['artifactHash'],producer='image_gen.imagegen / 내장 도구; 세부 모델 버전 미공개',license='자체 생성, 프로젝트 전용',notes='ART-R3 prepare.py 알파 보존·비율 유지 축소 재사용. 자체 검수 후보, 총괄 인수 전. rotor는 애니메이션 층이며 공격 muzzle 없음.')
        assets.append(a)
    writej('manifest.json',{'schemaVersion':'1','jobId':'ART-R4','styleReferenceSha256':sha(PROJECT/'docs/assets/design-41-kingdom-expedition.png'),'assets':assets,'holds':holds,'integrationStatus':'미실행: src/public/docs 변경 없음'})
def verify():
    errors=[];checks=readj('measurements.json');reviews=readj('visual-review.json');meta=readj('generation-metadata.json');assets=readj('manifest.json')['assets']
    expected={k for k,v in reviews.items() if v['decision']=='pass'}
    if expected!={a['id'] for a in assets}:errors.append('자체 통과 목록과 manifest 불일치')
    if set(reviews)!={s['id'] for s in specs()}:errors.append('항목별 검수 누락')
    attempts={}
    for s in specs():
        ident=s['id'];entry=meta.get(ident,{});attempts[ident]=len(entry.get('attempts',[]))
        if not 1<=attempts[ident]<=3:errors.append(ident+' 시도 누락/3회 초과')
        for a in entry.get('attempts',[]):
            if not (ROOT/a['source']).exists():errors.append(a['source']+' 원본 없음')
        p=ROOT/f'{ident}.r1.png'
        if not p.exists():errors.append(ident+' 처리본 없음');continue
        im=Image.open(p);arr=np.asarray(im);alpha=arr[:,:,3]
        if im.size!=(192,192) or im.mode!='RGBA' or p.read_bytes()[25]!=6:errors.append(ident+' RGBA192 규격')
        if sha(p)!=checks[ident]['artifactHash']:errors.append(ident+' hash 불일치')
        if alpha.min()!=0 or alpha.max()!=255 or np.concatenate([alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]]).max()!=0:errors.append(ident+' 알파/외곽')
        if (s['originX'],s['originY']) != ((.5,.8125) if s['layer']=='body' else (.5,.5)):errors.append(ident+' 기준점 오류')
        if s['layer']=='weapon' and not s.get('muzzle'):errors.append(ident+' muzzle 누락')
        if s.get('muzzle') and not all(0<=v<192 for v in s['muzzle'].values()):errors.append(ident+' muzzle 범위')
    changed=[]
    for name,h in readj('preservation-baseline.json')['protected'].items():
        p=PROJECT/name
        if not p.exists() or sha(p)!=h:changed.append(name)
    status=subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=all'],cwd=PROJECT,text=True)
    r={'assetCount':len(assets),'sourceCount':sum(attempts.values()),'attempts':attempts,'errors':errors,'automatedPass':not errors,'protectedChangesSinceBaseline':changed,'scopeNote':'동료 변경과 구분: 이 작업의 쓰기는 ART-R4 안에서만. 기준선 이후 다른 경로 변경은 기록만 한다.','visualApproval':'자체 검수만 실행, 총괄 인수 미실행','appBuild':'미실행: 앱 코드 변경 없음','e2e':'미실행: 앱 코드 변경 없음','gitStatus':status}
    writej('logs/final-verification.json',r)
    (ROOT/'file-list.txt').write_text('\n'.join(sorted({str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file()}|{'file-list.txt'}))+'\n')
    print(json.dumps({k:v for k,v in r.items() if k!='gitStatus'},ensure_ascii=False,indent=2));assert not errors
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','preview','verify']);args=parser.parse_args()
    if args.action=='preview':contacts();manifest()
    else:globals()[args.action]()
