import { buildBoard, loadMap } from './board.js';
import { enemies, makeEnemy, makeTower, towers } from './models.js';
import { makeRenderer, makeWorld, modelBounds, modelPreview } from './render.js';

const id = document.body.dataset.concept;
const world = makeWorld(id);
const app = document.querySelector('main');
const params = new URLSearchParams(location.search);
const page = params.get('view') ?? 'battle';
const still = params.has('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// 공개 3학년 어휘 문제 g3-argon-0003, revision 1.
const question = {
  sentence: '방을 치우니 마음이 뿌듯하다',
  word: '뿌듯하다',
  options: ['할 일이 없어 무척 심심하다', '어두운 길을 걸어 겁이 나다', '기쁨이 마음에 가득 차 벅차다', '배가 고파서 기운이 전혀 없다'],
  correct: 2,
  explanation: '여기서 ‘뿌듯하다’는 기쁨이 마음에 가득 차서 벅차다는 뜻이에요.',
};

const quiz = () => `
  <section class="quiz" aria-labelledby="question">
    <div class="quiz-intro">
      <div class="quiz-caption"><span>오늘의 어휘</span><span class="question-count">3 / 10</span></div>
      <h2 id="question">‘${question.sentence}’에서<br class="break-optional"> ‘<strong>${question.word}</strong>’의 뜻은?</h2>
      <p class="feedback" aria-live="polite"></p>
    </div>
    <div class="quiz-choices">
      <div class="answers">
        ${question.options.map((text, index) => `<button class="answer" data-answer="${index}">
          <span class="option-number">${index + 1}</span><span>${text}</span>
        </button>`).join('')}
      </div>
      <button class="skip">모르겠어요</button>
    </div>
  </section>`;

function wireQuiz() {
  const answerButtons = [...app.querySelectorAll('.answer')];
  const skip = app.querySelector('.skip');
  const feedback = app.querySelector('.feedback');
  const choose = (index) => {
    if (skip.disabled) return;
    answerButtons.forEach((button, i) => {
      button.disabled = true;
      button.classList.toggle('correct', i === question.correct);
      button.classList.toggle('chosen', i === index);
    });
    skip.disabled = true;
    feedback.textContent = index === question.correct ? '맞았어요. ' + question.explanation : question.explanation;
  };
  answerButtons.forEach((button, index) => button.addEventListener('click', () => choose(index)));
  skip.addEventListener('click', () => choose(-1));
}

function metrics(unitCount) {
  return [
    ['성문 체력', '18', '/ 20', '<span class="hp-track"><i></i></span>'],
    ['골드', '120', '', ''],
    ['웨이브', '3', '/ 8', ''],
    ['남은 적', String(unitCount), '', ''],
  ].map(([name, value, total, detail]) => `
    <div class="metric"><dt>${name}</dt><dd><strong>${value}</strong><span>${total}</span>${detail}</dd></div>
  `).join('');
}

async function battle() {
  const map = await loadMap();
  app.className = 'game';
  app.innerHTML = `
    <header class="hud">
      <div class="map-title"><h1>${world.theme.name}</h1><span>3학년</span></div>
      <dl class="metrics" aria-label="전투 정보"></dl>
    </header>
    <div class="battlefield">
      <section class="stage" aria-label="${world.theme.name} 3D 전장"></section>
      <aside class="arsenal" aria-labelledby="tower-title">
        <h2 id="tower-title">타워</h2>
        <div class="tower-list">${towers.map(({ id: tower, name, cost, role }, index) => `
          <button class="tower" data-tower="${tower}" aria-pressed="${index === 0}" aria-label="${name}, ${role}, ${cost}골드">
            <canvas width="48" height="48" aria-hidden="true"></canvas>
            <span class="tower-text"><strong>${name}</strong><small>${role}</small></span>
            <span class="cost">${cost}</span>
          </button>
        `).join('')}</div>
      </aside>
    </div>
    ${quiz()}`;
  const renderer = makeRenderer(world);
  const stage = app.querySelector('.stage');
  const buttons = [...app.querySelectorAll('.tower')];
  for (const button of buttons) {
    modelPreview(renderer, world, makeTower(world.k, button.dataset.tower), button.querySelector('canvas'), { pad: false });
  }
  stage.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const board = buildBoard(world, map, renderer, stage.clientWidth, stage.clientHeight);
  app.querySelector('.metrics').innerHTML = metrics(board.unitCount);
  board.select(towers[0].id);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
      board.select(button.dataset.tower);
      if (still) board.render(0);
    });
  }
  wireQuiz();
  board.render(0);
  if (!still) {
    const start = performance.now();
    let previous = start;
    const animate = (now) => {
      requestAnimationFrame(animate);
      if (now - previous < 1000 / 24 || document.hidden) return;
      board.render((now - start) / 1000);
      previous = now;
    };
    requestAnimationFrame(animate);
  }
}

const towerEvolutions = ['개방형 석궁 받침', '측면 버팀벽과 넓어진 석궁', '덮개와 보조 장전 구조'];

function sheet(kind) {
  const isTower = kind === 'towers';
  app.className = 'sheet ' + kind;
  const banner = (heading, label) => `
    <header class="sheet-header"><h1>${heading}</h1><span>${world.theme.name} · ${label}</span></header>
  `;
  const figure = (item) => `
    <figure class="figure">
      <canvas width="1" height="1" aria-hidden="true"></canvas>
      <figcaption>
        <strong>${item.name}${item.level ? ` <span>Lv${item.level}</span>` : ''}</strong>
        <small>${item.role}</small>
      </figcaption>
    </figure>`;
  const upgrades = [1, 4, 7].map((level, index) => ({ ...towers[0], level, role: towerEvolutions[index] }));
  const items = isTower ? [...upgrades, ...towers.slice(1).map((tower) => ({ ...tower, level: 1 }))] : enemies;
  app.innerHTML = isTower
    ? `${banner('타워 형태', '진화와 종류')}
      <div class="tower-sheet">${items.map(figure).join('')}</div>
      <div class="scale-strip" aria-label="48픽셀 크기의 타워 미리 보기">
        <strong>48px 보기</strong>
        ${items.map((item) => `
          <div class="scale-item"><canvas width="48" height="48" aria-hidden="true"></canvas>
          <span>${item.name} Lv${item.level}</span></div>`).join('')}
      </div>`
    : `${banner('적 형태', '일반 4종 · 보스 1종')}
      <div class="enemy-sheet">${items.map(figure).join('')}</div>`;
  const renderer = makeRenderer(world);
  const modelFor = (item) => isTower ? makeTower(world.k, item.id, item.level) : makeEnemy(world.k, item.id);
  const turn = isTower ? -0.16 : 0.13;
  const archerFrame = isTower ? modelBounds(modelFor(upgrades.at(-1)), turn) : null;
  const frameFor = (index) => index < upgrades.length ? archerFrame : null;
  [...app.querySelectorAll('.figure canvas')].forEach((canvas, index) => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    modelPreview(renderer, world, modelFor(items[index]), canvas, {
      turn, margin: isTower ? 0.90 : 0.92, frame: frameFor(index),
    });
  });
  [...app.querySelectorAll('.scale-item canvas')].forEach((canvas, index) => {
    modelPreview(renderer, world, modelFor(items[index]), canvas, { pad: false, turn, frame: frameFor(index) });
  });
  renderer.dispose();
  renderer.forceContextLoss();
}

try {
  if (page === 'towers' || page === 'enemies') sheet(page);
  else await battle();
  await document.fonts.ready;
  document.documentElement.dataset.ready = 'true';
} catch (error) {
  app.textContent = '3D 목업을 불러오지 못했습니다. 저장소 루트에서 로컬 HTTP 서버로 다시 여세요.';
  document.documentElement.dataset.ready = 'error';
  console.error(error);
}
