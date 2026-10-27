const notes={
41:['장비함의 홈, 방패 초상화, 눌리는 목제 답안 키. 익숙한 모험 게임의 읽기 쉬운 조합입니다.','후보 중 비교적 정통 판타지입니다. 최종 제작에서는 나뭇결과 금속 장식의 작은 디테일을 덜어냅니다.'],
42:['육각 장착부와 기계식 스위치, 흰색 외장과 코발트 대비. 전투 유닛도 다리가 있는 작업 로봇으로 연결합니다.','49번의 둥근 우주선보다 각진 산업용 조작부가 중심입니다. 최종 UI에는 텍스트보다 선택·장착 상태를 먼저 보이게 합니다.'],
43:['접힌 종이 지형과 돌출된 탭, 얇은 절단면 그림자. UI까지 같은 종이 구조로 이어집니다.','책·문자 전투가 아닌 종이 재료의 세계입니다. 접힌 모서리는 장식이고 실제 점유 판정은 사각 셀로 유지합니다.'],
44:['굵은 외곽선, 과장된 표정, 비대칭 판과 큰 답안 키. 움직임의 눌림과 튕김이 가장 잘 어울리는 방향입니다.','배경의 세부 묘사를 줄여 캐릭터가 먼저 보이게 합니다. 만화 효과음이나 말풍선은 문항 위에 띄우지 않습니다.'],
45:['기물을 끼우는 원형 트레이와 단계 다이얼. 펠트판·목제 미니어처·도미노 답안 키로 실제 보드게임 감각을 만듭니다.','풀밭 묘사를 걷어내고 넓은 펠트 면과 파인 경로로 다시 정리한 안입니다. 이미지의 길 접속과 점유 좌표는 최종 맵 데이터로 다시 구성합니다.'],
46:['포트홀, 조타륜 초상화, 돛천 문제판. 게·해안포·작살의 형태로 해양 모험의 개성을 만듭니다.','산호와 밧줄 밀도는 최종 작은 화면에서 낮춥니다. 길·포구·적 실루엣이 장식보다 먼저 읽히게 합니다.'],
47:['계단형 테두리와 장비 인벤토리, 선명한 도트 실루엣. 다른 후보와 달리 픽셀 단위를 제작 기준으로 삼습니다.','확대 배율과 도트 밀도를 잠근 뒤 프레임을 제작해야 합니다. 생성 그림 자체가 최종 픽셀 규격이나 타일셋은 아닙니다.'],
48:['뿌리에 달린 잎 장착부, 나무 옹이 초상화, 자작나무 문제판. 다람쥐·도토리·버섯을 전투 테마로 씁니다.','세밀한 배경을 덜고 큰 캐릭터와 두 단계 면 채색으로 다시 그린 안입니다. 실제 설치 공간은 이미지의 세 자리로 제한하지 않고 격자 데이터로 정합니다.'],
49:['둥근 도킹 포트와 캡슐 모니터, 우주선 조작 키. 산호색 행성과 흰 외장으로 밝은 레트로 SF를 만듭니다.','42번보다 곡선·구형 기물·가벼운 부유감에 집중합니다. 발광은 짧은 발사·명중 순간으로 제한합니다.'],
50:['블록처럼 맞물리는 외장, 큰 원형 기물 핀, 눌리는 플라스틱 키. 가장 간결하고 통통 튀는 방향입니다.','낮은 연령대 전용처럼 보이지 않도록 눈·장식·원색 수를 절제합니다. 기물 반동은 스프링의 짧은 압축으로 표현합니다.']};
const $=s=>document.querySelector(s);let active=0;
for(const [i,v] of VARIANTS.entries()){
 const b=document.createElement('button');b.innerHTML=`<img src="${v.file}" alt=""><span>${v.id} ${v.name}</span>`;b.onclick=()=>select(i);b.setAttribute('aria-label',`${v.id} ${v.name}`);$('#strip').append(b);
 const c=document.createElement('button');c.innerHTML=`<img src="${v.file}" loading="lazy" alt="${v.name} 게임 화면"><strong>${v.id} ${v.name}</strong><p>${v.description}</p>`;c.onclick=()=>{select(i);$('.viewer').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};$('#contact').append(c);
}
function select(i){active=(i+VARIANTS.length)%VARIANTS.length;const v=VARIANTS[active];$('#number').textContent=v.id;$('#name').textContent=v.name;$('#description').textContent=v.description;$('#hero').src=v.file;$('#hero').alt=v.name+' 전체 게임 화면 시안';$('#original').href=$('#imageLink').href=v.file;$('#difference').textContent=notes[v.id][0];$('#limit').textContent=notes[v.id][1];$('#strip').querySelectorAll('button').forEach((b,n)=>b.setAttribute('aria-pressed',String(n===active)));history.replaceState(null,'','#'+v.id);}
$('#prev').onclick=()=>select(active-1);$('#next').onclick=()=>select(active+1);select(Math.max(0,VARIANTS.findIndex(v=>v.id===location.hash.slice(1))));window.selectVariant=select;document.body.dataset.ready='true';
