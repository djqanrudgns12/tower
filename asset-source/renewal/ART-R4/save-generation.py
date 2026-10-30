from pathlib import Path
import json,shutil,sys,fcntl
r=Path(__file__).resolve().parent
ident,attempt,generated=sys.argv[1:];attempt=int(attempt)
prompts=json.loads((r/'prompts.json').read_text());spec=next(s for s in prompts['prompts'] if s['id']==ident)
source=f'sources/{ident}.attempt{attempt}.generated.png';shutil.copy2(generated,r/source)
lock=(r/'logs/generation.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX)
metadata=json.loads((r/'generation-metadata.json').read_text());entry=metadata.setdefault(ident,{'attempts':[]})
record={'id':ident,'attempt':attempt,'tool':'image_gen.imagegen','source':source,'generatedPath':generated,'prompt':spec['prompt'],'references':spec.get('references',[])}
entry['attempts'].append(record);entry['selectedSource']=source
(r/'generation-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
(r/f'logs/{ident}.attempt{attempt}.generation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(source)
from datetime import datetime
with (r/'PROGRESS.md').open('a') as progress:
 progress.write(f"- {datetime.now().astimezone().isoformat(timespec='seconds')}: `{ident}` {attempt}차 원본 저장 → `{source}`. 후보 상태, 축소/합성 검수 전.\n")
