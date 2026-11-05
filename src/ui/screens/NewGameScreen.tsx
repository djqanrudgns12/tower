import { useId, useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import { gradeContent, MAPS } from '../../content';
import type { Settings } from '../../application/session';
import { DIFFICULTY_COPY, HOME_COPY, MAP_NAMES } from '../copy';
import { ArtIcon, Button, Card, Modal, Segmented, type SegmentOption } from '../kit';
import { difficultyReadout } from './guide/difficultyReadout';
import { NEWGAME_COPY as N, nickProblemOf } from './home/homeCopy';
import css from './home/lobby.module.css';

const GRADES = [3, 4, 5, 6] as const;
type Grade = (typeof GRADES)[number];

const gradeReady = (g: Grade) => gradeContent(g).bank !== null;

interface Props {
  settings: Settings;
  onBack(): void;
  /** '닉네임 바꾸기': 창을 닫고 홈의 닉네임 입력칸에 포커스를 준다(홈이 처리한다). */
  onEditNickname(): void;
  onStart(input: { grade: Grade; difficulty: DifficultyId; nickname: string }): void;
}

/**
 * 새 게임 창: 위에서 학년 · 난이도를 고르고(난이도 아래에 설명과 판독 한 줄, 오른쪽 열에 지도 썸네일), 창 맨 아래 고정 줄에서 '닉네임 ○○ · 바꾸기'를 보고 큰 '시작'을 누른다.
 * 시작 줄은 내용이 길어 스크롤되는 좁고 낮은 화면에서도 늘 보인다(R5 N1·N2). 닉네임은 홈에서 정한 것을 쓰고, 비면 이유를 보이며 시작을 막는다.
 */
export function NewGameScreen({ settings, onBack, onEditNickname, onStart }: Props) {
  const [grade, setGrade] = useState<Grade>(gradeReady(settings.lastGrade) ? settings.lastGrade : 3);
  const [difficulty, setDifficulty] = useState<DifficultyId>(
    (DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty) ? (settings.lastDifficulty as DifficultyId) : 'Normal',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const problemId = useId();
  const map = MAPS.find(m => m.grade === grade)!;
  const mapName = MAP_NAMES[map.id] ?? map.id;
  const { nickname, problem } = nickProblemOf(settings.lastNickname);

  const gradeOptions: SegmentOption<`${Grade}`>[] = GRADES.map(g => ({
    value: `${g}`,
    label: (
      <>
        {!gradeReady(g) && <ArtIcon name="lock" size={16} />}
        <span>{g}<span className={css.unit}>학년</span></span>
      </>
    ),
    ariaLabel: gradeReady(g) ? `${g}학년` : `${g}학년, 문제 준비 중`,
    disabled: !gradeReady(g),
  }));
  const difficultyOptions: SegmentOption<DifficultyId>[] = DIFFICULTY_IDS.map(id => ({ value: id, label: DIFFICULTY_COPY[id].label }));

  return (
    <Modal
      titleId="newGameModalTitle"
      title="새 게임"
      size="md"
      fixed
      onClose={onBack}
    >
      <div className={css.newGame}>
        <div className={css.newGameScroll}>
          <div className={css.newGameControls}>
            <div className={css.group}>
              <div className={css.groupHead}>
                <span className={css.groupLabel}>학년</span>
                <p className={css.groupWarn} role="status">{notice}</p>
              </div>
              <Segmented
                label="학년"
                options={gradeOptions}
                value={`${grade}`}
                onChange={v => { setNotice(null); setGrade(Number(v) as Grade); }}
                onBlocked={() => setNotice(HOME_COPY.gradeSoon)}
              />
            </div>

            <div className={css.group}>
              <span className={css.groupLabel}>난이도</span>
              <Segmented<DifficultyId> label="난이도" options={difficultyOptions} value={difficulty} onChange={v => setDifficulty(v)} />
              {/* N3: 고른 난이도 설명 한 줄 + 판독 한 줄(성문 · 첫 정답 골드 · 낱말 범위). 고르면 읽히도록 polite. */}
              <Card sunk pad="sm" className={css.difficultyInfo} aria-live="polite">
                <p className={css.groupNote}>{DIFFICULTY_COPY[difficulty].hint}</p>
                <p className={css.readout}>{difficultyReadout(difficulty).line}</p>
              </Card>
            </div>
          </div>

          <figure className={css.mapFigure}>
            <img
              src={`${import.meta.env.BASE_URL}assets/maps/${map.id}.thumb.webp`}
              width={204}
              height={122}
              alt={`${mapName} 지도`}
              draggable={false}
              className={css.mapThumb}
            />
            <figcaption className={css.mapName}>{mapName}</figcaption>
          </figure>
        </div>

        {/* 시작 줄: 스크롤 영역 밖이라 내용이 길어도 창 아래에 붙어 늘 보인다. 닉네임을 보여 주고, 비면 이유를 적고 시작을 막는다. */}
        <div className={css.startBar}>
          <div className={css.nickLine}>
            <span className={css.nickLabel}>{N.nickname}</span>
            {nickname !== '' && <strong className={css.nickName}>{nickname}</strong>}
            <Button size="md" aria-label={N.changeLabel} onClick={onEditNickname}>{N.change}</Button>
            {problem !== null && <p id={problemId} className={css.nickProblem}>{problem}</p>}
          </div>
          <Button
            variant="primary"
            size="lg"
            className={css.startBtn ?? ''}
            aria-disabled={problem !== null || undefined}
            aria-describedby={problem !== null ? problemId : undefined}
            onClick={() => { if (problem === null) onStart({ grade, difficulty, nickname }); }}
          >
            {HOME_COPY.start}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
