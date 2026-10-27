// Documentation migration only; no product implementation.
const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
let s=read('docs/prd_v0_2_additions.md');
s=s.replace('## 19. v0.2 확정 결정과 적용 우선순위','## 19. 확정 결정과 적용 우선순위');
s=s.replace('디자인 선택은 `docs/design_directions_v0_2.md`','확정 디자인은 `docs/style-lock-v1.md`');
s=s.replace('계약 보완 원본은 `docs/prd_v0_2_additions.md`','계약 보완 원본은 `docs/prd_v0_3_additions.md`와 `docs/prd_v0_3_decisions.md`');
const a=s.indexOf('**현재 기준(v0.7'),b=s.indexOf('\n\n전체 전장',a);if(a<0||b<0)throw Error('Design marker');
s=s.slice(0,a)+'**현재 기준(v0.3 인계):** 사용자가 **41번 왕국 원정대** 화풍을 선택했다. `docs/style-lock-v1.md`와 §25가 최종 디자인 방향이다. 한글·훈민정음·세종대왕은 일부 고정 장식물에만 사용하고, 자연물과 섞는다. 전투 자산 전체를 한글 소재로 통일하지 않는다. 41번 외 프로젝트 이미지는 삭제했으며 과거 비교 코드와 지시문은 `docs/archive/`의 이력이다.'+s.slice(b);
const c=s.indexOf('41–50번은 서로 다른'),d=s.indexOf('\n\n',c);if(c<0||d<0)throw Error('History marker');
s=s.slice(0,c)+'과거 41–50번은 정지 콘셉트, 동작 표본은 별도 예시였다. 현재는 41번 화풍만 확정했고 나머지 이미지는 삭제했다. 과거 표본의 모바일 중앙 확대는 최종 전체 맵 UX가 아니다. 선택 이미지의 길·슬롯·가격은 확정 데이터가 아니므로 실제 맵 좌표와 DOM/런타임 텍스트로 다시 구성한다. 사용자 첨부는 맵 형태만 참고했고 최종 자산은 자체 제작한다.'+s.slice(d);
const e=s.indexOf('## 24. 현재 증거와 다음 결정');if(e<0)throw Error('Completion marker');
s=s.slice(0,e)+`## 24. 현재 증거와 다음 결정

원문 보존, 실행 계약·위험 검토·단계별 계획·미술/문항 계약·시안 탐색·브라우저 동작 예시 검증을 완료했다. 사용자는 41번 왕국 원정대 화풍을 선택했다. 41번 외 프로젝트 이미지를 삭제했고, 비실행 이력 자료는 docs/archive에 보존한다.

제품 게임·실기기 성능·학생 사용성·외부 공동검수·승인 문항 은행·최종 에셋·배포는 미완료다. 7×7 맵 후보 검산은 최신 긴 경로의 최종 지도 검증이 아니다. 아직 필요한 결정은 §25의 고비 보상/무드/맵·실제 시험 기기·외부 검수 전달 방법이다. 다음 작업자는 docs/HANDOFF.md를 먼저 읽고 새 구현 지시를 기다린다.
`;
write('docs/prd_v0_3_additions.md',s);
const banner='> **인계 갱신(2026-10-27):** 화풍은 41번 왕국 원정대로 확정했습니다. 최신 기준은 `../vocabulary_td_prd_v0_3.md` §25, `style-lock-v1.md`, `HANDOFF.md`입니다. 이 문서의 과거 선택 대기·다른 시안·숫자 후보와 충돌하면 최신 기준이 우선합니다. 현재 제품 구현은 시작하지 않습니다.\n\n';
for(const name of ['implementation_plan_v0_2.md','art_and_content_contract_v0_2.md','completion_audit_v0_2.md','review_v0_2.md']){let t=read('docs/'+name);t=banner+t;if(name==='implementation_plan_v0_2.md'){t=t.replace('설계 보강 완료, 디자인 결정 대기','설계 인계, 41번 화풍 결정 완료').replace('| V01 | 10개 방향에서 1개 선택 | 현재 시안 | 사용자 | 방향·배제 스타일 기록 |','| V01 | 41번 왕국 원정대 화풍 선택 완료 | 사용자 결정 | 사용자 | style-lock-v1 및 PRD §25 |').replace('| S04 | 3학년 후보 맵·경로·20슬롯, 적 생성/이동 |','| S04 | 3학년 후보의 긴 경로·격자·장식·설치 수 확정, 적 생성/이동 |');t+='\n## v0.3 인계 추가 작업(구현 요청 후)\n\n- V02에 41번 화풍, 자연/문화 장식 분리, 무드 레이어, 포구 소켓과 보행 프레임 인수를 포함한다.\n- S09/S11에 5배수 고비의 적·보상 데이터, 보스 누출/0HP/중복 지급 규칙, 4→5→6·9→10→11·19→20→21 검증을 포함한다.\n- 무드 변화는 경로·점유·입력·타워 상태를 변경하지 않는다. 복원/정지/동작 줄이기/프레임 저하에서도 전투 결과가 같아야 한다.\n- 5배수 보상 수치와 최종 맵 좌표는 구현 전 계약으로 닫는다. 임의 확정값을 원문에 덧씌우지 않는다.\n';}write('docs/'+name,t);}
write('docs/READ_FIRST.md','# 문서 시작점\n\n현재 기준은 [통합 PRD v0.3](../vocabulary_td_prd_v0_3.md)과 [인계 문서](HANDOFF.md)입니다.\n\n화풍은 [41번 왕국 원정대](style-lock-v1.md)로 확정했습니다. 같은 맵의 웨이브별 분위기 변화와 5배수 고비의 강한 적/보상 방향도 반영했습니다. 숫자·무드표는 후속 검증 대상입니다.\n\n제품 구현은 미착수이며 새 구현 지시를 기다립니다. 다른 시안 이미지는 삭제했고 과거 비교/동작 코드는 archive에 보관했습니다. 현재 원화는 assets/design-41-kingdom-expedition.png 한 개뿐입니다.\n\n상세 계획과 역할/검수 절차의 전체 목록은 루트 README.md를 참고하세요.\n');
let paths=JSON.parse(read('docs/image-cleanup.paths.json').replace(/^\uFEFF/,''));write('docs/image-cleanup.paths.json',JSON.stringify({date:'2026-10-27',scope:'Project images only',kept:'docs/assets/design-41-kingdom-expedition.png',deletedCount:paths.length,deleted:paths.map(p=>path.relative(root,p.FullName).split(path.sep).join('/'))},null,2)+'\n');
console.log('Documentation migrated; no product code created.');
