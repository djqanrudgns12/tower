import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(root,p)), {recursive:true}); fs.writeFileSync(path.join(root,p), s, 'utf8'); };
let prd = read('vocabulary_td_prd_claude_v0_1.md');
prd = prd.replaceAll('Claude', 'Codex');
prd = prd.replace('# 어휘력 타워 디펜스 — Codex 전달용 PRD', '# 어휘력 타워 디펜스 — 인계 PRD v0.3');
prd = prd.replace('버전: 0.1 · 작성일: 2026-10-26 · 상태: 초기 설계 착수용', '버전: 0.3 · 갱신일: 2026-10-27 · 상태: 41번 화풍 확정, 문서 인계, 제품 구현 미착수');
prd = prd.replace('대상 독자: 제품 기획자, Codex 설계 담당, Gemini Argon 콘텐츠 제작 담당, 검수 교사', '대상 독자: 사용자·베타테스터, Codex 설계/구현 담당, Gemini Argon 제작·검수 담당, Claude 독립 검수 담당');
const intro = '\n> 최신 결정: **41번 왕국 원정대 화풍 확정 / 같은 맵의 웨이브별 무드 변화 / 5·10·15·20… 고비의 강한 적과 보상 / 현재 구현 금지·문서 인계만 수행**. §25가 이전 선택 대기 문구 및 시안 설명보다 우선합니다. 원문 v0.1은 별도 보존하며 §1~18의 핵심 규칙, §19~24의 실행 계약을 유지합니다. 보상 배율·무드표·최종 맵 좌표는 아직 미정입니다. 다른 컴퓨터의 재개 지침은 `docs/HANDOFF.md`, 선택 화풍은 `docs/style-lock-v1.md`입니다. 이 문서는 게임 구현·실기기 검증·외부 공동검수 완료를 뜻하지 않습니다.\n';
prd = prd.replace('## 0. 이 문서의 사용법과 결정 우선순위', intro+'\n## 0. 이 문서의 사용법과 결정 우선순위');
prd = prd.replace('| Codex | **초기 기술·게임 설계**: 구조, 상태 전이, 데이터 계약, 개발 순서, 검증 계획 | 본 PRD를 근거로 구현 가능한 설계 묶음 제출. 후속 구현은 그 작업 단계에서 진행 |', '| Codex | **설계·구현·통합·검증 주도**: 구조, 상태 전이, 데이터 계약, UI, 도메인, 검사 도구, 에셋 패킹 | 이번에는 설계 묶음 작성; 디자인/제작 계약을 반영하여 후속 구현을 수행 |');
prd = prd.replace('### 1.3 v0.1 완료 범위', '### 1.3 전체 공개 MVP 완료 범위');
prd = prd.replace('그것을 최종 v0.1 전체 완료로 표시하지 않는다.', '그것을 전체 공개 MVP 완료로 표시하지 않는다. 사용자 결정에 따라 한 학년 비공개 검증 후 이 전체 범위로 공개한다.');
prd = prd.replaceAll('teacher_approved', 'joint_review_approved');
prd = prd.replace('| 교사·기획자 | 학년 적합성, 뜻과 정답의 정확성, 학습 경험 승인 | 승인·반려·수정 기록 유지 |', '| Argon·Codex·Claude 공동검수 | 근거/정답/오답/학년/문장 검토 | 독립 보고서와 불일치 해소 기록 유지; 실제 교사 검수로 표시하지 않음 |\n| 사용자 | 비공개 베타테스트와 공개 판단 | 조작·읽기·재미·이상 문항 피드백 |');
prd = prd.replaceAll('교사 승인', '공동검수 승인').replaceAll('교사가 승인', '공동검수가 승인').replaceAll('교사용', '검수용').replaceAll('교사 검수 시간', '공동검수·베타테스트 시간');
prd = prd.replace('교사 판단을 결합한다', 'Argon·Codex·Claude의 근거 기반 공동검토를 결합한다');
prd = prd.replace('1. 교사가 학년별 목표 어휘와 선정 근거를 승인한다.', '1. Argon·Codex·Claude가 학년별 목표 어휘와 실제 선정 근거를 공동검토한다.');
prd = prd.replace('6. 교사가 뜻의 정확성·정답 유일성·학년 적합성·자연스러운 한국어를 승인한다.', '6. Argon·Codex·Claude의 실제 독립 검토 보고서가 뜻의 정확성·정답 유일성·학년 적합성·자연스러운 한국어에 모두 통과하고 이견이 해소된 revision만 공동검수 승인한다. 사용자 베타테스트를 별도로 거친다.');
const oldStart = prd.indexOf('## Codex에게 그대로 전달할 시작 요청');
if(oldStart < 0) throw new Error('원문 마지막 인계 절을 찾지 못함');
prd = prd.slice(0,oldStart) + read('docs/prd_v0_3_additions.md') + '\n' + read('docs/prd_v0_3_decisions.md') + '\n';
write('vocabulary_td_prd_v0_3.md',prd.trimEnd()+'\n');

const specs = [
  ['garden_u',3,[[0,0],[6,0],[6,5],[0,5]],17],
  ['river_z',4,[[0,1],[5,1],[5,3],[1,3],[1,5],[6,5]],18],
  ['courtyard',5,[[0,0],[6,0],[6,6],[0,6],[0,2]],22],
  ['snow_step',6,[[0,0],[3,0],[3,2],[6,2],[6,4],[2,4],[2,6],[0,6]],18]
];
const maps = specs.map(([id,grade,waypoints,expectedLength])=>{
 const route=[waypoints[0]];
 for(let i=1;i<waypoints.length;i++){
  let [x,y]=waypoints[i-1]; const [ex,ey]=waypoints[i];
  if(x!==ex&&y!==ey)throw new Error('대각 경로');
  while(x!==ex||y!==ey){x+=Math.sign(ex-x);y+=Math.sign(ey-y);route.push([x,y]);}
 }
 const keys=new Set(route.map(p=>p.join(',')));
 const candidates=[];
 for(let y=0;y<7;y++)for(let x=0;x<7;x++)if(!keys.has(`${x},${y}`)) candidates.push({x,y,d:Math.min(...route.map(([px,py])=>(x-px)**2+(y-py)**2))});
 candidates.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
 const slots=candidates.slice(0,20).sort((a,b)=>a.y-b.y||a.x-b.x).map(({x,y},i)=>({id:`${id}-s${String(i+1).padStart(2,'0')}`,x,y}));
 return {id,grade,gridSize:7,waypoints,pathCells:route,pathLength:expectedLength,coordinateConvention:'cell centers: x+0.5,y+0.5',baseTravelTicks:720,slots,status:'candidate-unbalanced'};
});
write('docs/contracts/maps.candidate.v0.2.json',JSON.stringify({schemaVersion:'0.2',status:'structural-candidate-not-playtested',maps},null,2)+'\n');
console.log('인계 PRD v0.3 생성. 7×7 맵 파일은 과거 산술 검산 후보이며 최종 긴 경로 맵이 아닙니다.');
