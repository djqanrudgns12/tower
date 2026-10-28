import { useMemo, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import { gradeContent, MAPS } from '../../content';
import type { Settings } from '../../application/session';
import { cleanNickname, DIFFICULTY_COPY } from '../copy';
import kit from '../kit.module.css';
import css from './screens.module.css';

interface Props { settings: Settings; onBack(): void; onStart(input: { grade: number; difficulty: DifficultyId; nickname: string }): void }

/** 학년(어휘 범위·맵)과 난이도(전투 압박)를 따로 고른다(PRD §1.1, §2). */
export function NewGameScreen({ settings, onBack, onStart }: Props) {
  const [grade, setGrade] = useState(3);
  const [difficulty, setDifficulty] = useState<DifficultyId>((DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty) ? (settings.lastDifficulty as DifficultyId) : 'Normal');
  const [nickname, setNickname] = useState(settings.lastNickname);
  const [touched, setTouched] = useState(false);
  const nick = cleanNickname(nickname);
  const map = useMemo(() => MAPS.find(m => m.grade === grade)!, [grade]);

  return (
    <main className={css.page}>
      <form className={`${kit.board} ${css.card}`} onSubmit={e => { e.preventDefault(); setTouched(true); if (!nick.error) onStart({ grade, difficulty, nickname: nick.value }); }}>
        <h1 className={css.title}>새 게임</h1>
        <section className={css.stack}>
          <h2 className={css.h2}>학년</h2>
          <p className={kit.muted}>학년은 나오는 낱말과 지도를 정해요.</p>
          <div className={css.grid2} role="radiogroup" aria-label="학년">
            {[3, 4, 5, 6].map(g => {
              const ready = gradeContent(g).bank !== null;
              return (
                <button key={g} type="button" role="radio" aria-checked={grade === g} disabled={!ready} className={css.choice} onClick={() => setGrade(g)}>
                  <span className={css.choiceLabel}>{g}학년</span>
                  <span className={css.choiceHint}>{ready ? '문제 준비됨' : '문제 준비 중'}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className={css.stack}>
          <h2 className={css.h2}>난이도</h2>
          <p className={kit.muted}>난이도는 적의 세기만 바꿔요. 문제 수준은 그대로예요.</p>
          <div className={css.grid2} role="radiogroup" aria-label="난이도">
            {DIFFICULTY_IDS.map(id => (
              <button key={id} type="button" role="radio" aria-checked={difficulty === id} className={css.choice} onClick={() => setDifficulty(id)}>
                <span className={css.choiceLabel}>{DIFFICULTY_COPY[id].label}</span>
                <span className={css.choiceHint}>{DIFFICULTY_COPY[id].hint}</span>
              </button>
            ))}
          </div>
          <p className={kit.muted}>어려움·아주 어려움은 배치에 익숙해지면 추천해요.</p>
        </section>
        <section className={css.stack}>
          <label className={css.field}>
            <span className={css.h2}>별명</span>
            <span className={kit.muted}>진짜 이름 대신 별명을 써요. 두 글자에서 열두 글자까지.</span>
            <input className={css.input} value={nickname} maxLength={24} autoComplete="off" onChange={e => setNickname(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={touched && !!nick.error} />
          </label>
          <p className={kit.reason} role="status">{touched ? nick.error : ''}</p>
        </section>
        <section className={css.stack}>
          <h2 className={css.h2}>지도</h2>
          <MapPreview map={map} />
        </section>
        <div className={css.row}>
          <button type="submit" className={`${kit.button} ${kit.primary} ${kit.big}`}>시작하기</button>
          <button type="button" className={kit.button} onClick={onBack}>뒤로</button>
        </div>
      </form>
    </main>
  );
}

function MapPreview({ map }: { map: (typeof MAPS)[number] }) {
  const key = (x: number, y: number) => `${x},${y}`;
  const path = new Set(map.pathCells.map(([x, y]) => key(x, y)));
  const slots = new Set(map.slots.map(s => key(s.x, s.y)));
  const decor = new Set(map.decorations.flatMap(d => d.cells.map(([x, y]) => key(x, y))));
  const gate = key(map.exitCell[0], map.exitCell[1]);
  const cells = [];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) {
    const k = key(x, y);
    cells.push(<span key={k} className={css.previewCell} data-kind={k === gate ? 'gate' : path.has(k) ? 'path' : slots.has(k) ? 'slot' : decor.has(k) ? 'decor' : 'grass'} />);
  }
  return <div className={css.preview} role="img" aria-label="길과 설치 자리 미리보기">{cells}</div>;
}
