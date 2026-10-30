import { useMemo, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import { gradeContent, MAPS } from '../../content';
import type { Settings } from '../../application/session';
import { DIFFICULTY_COPY, fmtNumber } from '../copy';
import kit from '../kit.module.css';
import { ModalShell } from './home/ModalShell';
import homeCss from './home/home.module.css';
import css from './screens.module.css';

interface Props {
  settings: Settings;
  onBack(): void;
  onEditNickname?(): void;
  onStart(input: { grade: 3 | 4 | 5 | 6; difficulty: DifficultyId; nickname: string }): void;
}

/**
 * 출정 조건 설정(랜딩 PRD §2.5).
 * 별명은 첫 화면 출정 데크에서 정해 승계하며, 여기서는 학년·난이도·지도만 고른다.
 */
export function NewGameScreen({ settings, onBack, onEditNickname, onStart }: Props) {
  const initialGrade: 3 | 4 | 5 | 6 =
    gradeContent(settings.lastGrade).bank !== null ? settings.lastGrade : 3;
  const [grade, setGrade] = useState<3 | 4 | 5 | 6>(initialGrade);
  const [difficulty, setDifficulty] = useState<DifficultyId>(
    (DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty)
      ? (settings.lastDifficulty as DifficultyId)
      : 'Normal',
  );
  const map = useMemo(() => MAPS.find(m => m.grade === grade)!, [grade]);
  const confirmedNickname = settings.lastNickname.trim();

  return (
    <ModalShell titleId="newGameModalTitle" title="새 게임 출정 설정" onClose={onBack}>
      <form
        className={css.stack}
        style={{ gap: 16 }}
        onSubmit={e => {
          e.preventDefault();
          if (!confirmedNickname) {
            onEditNickname?.();
            return;
          }
          onStart({ grade, difficulty, nickname: confirmedNickname });
        }}
      >
        <div className={homeCss.inheritedNickBar}>
          <div>
            <span className={kit.muted}>출정 대원 별명 </span>
            <strong className={homeCss.nickLabel}>{confirmedNickname}</strong>
          </div>
          {onEditNickname && (
            <button type="button" className={homeCss.smallBtn} onClick={onEditNickname}>
              별명 바꾸기
            </button>
          )}
        </div>

        <section className={css.stack}>
          <h3 className={css.h2}>학년</h3>
          <p className={kit.muted}>학년은 초등 교과 수준에 맞는 낱말 범위와 지도를 정해요.</p>
          <div className={homeCss.choiceGrid2} role="radiogroup" aria-label="학년">
            {([3, 4, 5, 6] as const).map(g => {
              const bank = gradeContent(g).bank;
              const ready = bank !== null;
              return (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={grade === g}
                  disabled={!ready}
                  className={css.choice}
                  onClick={() => setGrade(g)}
                >
                  <span className={css.choiceLabel}>{g}학년</span>
                  <span className={css.choiceHint}>
                    {ready ? `문제 준비됨 · ${fmtNumber(bank.questions.length)}문항` : '문제 준비 중'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={css.stack}>
          <h3 className={css.h2}>난이도</h3>
          <p className={kit.muted}>난이도가 높을수록 적도 강해지고 심화 어휘·지역 방언도 나와요.</p>
          <div className={homeCss.choiceGrid2} role="radiogroup" aria-label="난이도">
            {DIFFICULTY_IDS.map(id => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={difficulty === id}
                className={css.choice}
                onClick={() => setDifficulty(id)}
              >
                <span className={css.choiceLabel}>{DIFFICULTY_COPY[id].label}</span>
                <span className={css.choiceHint}>{DIFFICULTY_COPY[id].hint}</span>
              </button>
            ))}
          </div>
          <p className={kit.muted}>쉬움·보통은 기본·심화 표준어만 나오고, 어려움부터 속담·방언이 더해져요.</p>
        </section>

        <section className={css.stack}>
          <h3 className={css.h2}>지도 미리보기</h3>
          <MapPreview map={map} />
        </section>

        <div className={css.row}>
          <button type="submit" className={`${kit.button} ${kit.primary} ${kit.big}`}>
            시작하기
          </button>
          <button type="button" className={kit.button} onClick={onBack}>
            뒤로
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function MapPreview({ map }: { map: (typeof MAPS)[number] }) {
  const key = (x: number, y: number) => `${x},${y}`;
  const path = new Set(map.pathCells.map(([x, y]) => key(x, y)));
  const slots = new Set(map.slots.map(s => key(s.x, s.y)));
  const decor = new Set(map.decorations.flatMap(d => d.cells.map(([x, y]) => key(x, y))));
  const gate = key(map.exitCell[0], map.exitCell[1]);
  const cells = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 15; x++) {
      const k = key(x, y);
      cells.push(
        <span
          key={k}
          className={css.previewCell}
          data-kind={k === gate ? 'gate' : path.has(k) ? 'path' : slots.has(k) ? 'slot' : decor.has(k) ? 'decor' : 'grass'}
        />,
      );
    }
  }
  return <div className={css.preview} role="img" aria-label="길과 설치 자리 미리보기">{cells}</div>;
}
