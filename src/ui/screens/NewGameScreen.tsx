import { useState } from 'react';
import { DIFFICULTY_IDS, type DifficultyId } from '../../contracts/balance';
import { gradeContent, MAPS } from '../../content';
import type { Settings } from '../../application/session';
import { DIFFICULTY_COPY, HOME_COPY, MAP_NAMES } from '../copy';
import { ArtIcon, Button, Modal, Segmented, type SegmentOption } from '../kit';
import css from './home/lobby.module.css';

const GRADES = [3, 4, 5, 6] as const;
type Grade = (typeof GRADES)[number];

const gradeReady = (g: Grade) => gradeContent(g).bank !== null;

interface Props {
  settings: Settings;
  onBack(): void;
  onStart(input: { grade: Grade; difficulty: DifficultyId; nickname: string }): void;
}

/** 새 게임 창: 왼쪽에서 학년 · 난이도를 고르고, 오른쪽 열의 지도 썸네일 아래 큰 '시작'을 누른다. 닉네임은 홈에서 정한 것을 그대로 쓴다. */
export function NewGameScreen({ settings, onBack, onStart }: Props) {
  const [grade, setGrade] = useState<Grade>(gradeReady(settings.lastGrade) ? settings.lastGrade : 3);
  const [difficulty, setDifficulty] = useState<DifficultyId>(
    (DIFFICULTY_IDS as readonly string[]).includes(settings.lastDifficulty) ? (settings.lastDifficulty as DifficultyId) : 'Normal',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const map = MAPS.find(m => m.grade === grade)!;
  const mapName = MAP_NAMES[map.id] ?? map.id;
  const nickname = settings.lastNickname.trim();

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
      size="lg"
      onClose={onBack}
    >
      <div className={css.newGame}>
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
            <p className={css.groupNote}>{DIFFICULTY_COPY[difficulty].hint}</p>
          </div>
        </div>

        {/* 오른쪽 열: 지도 썸네일 아래 맨 밑에 '시작'. 이 창에서 가장 크고 눈에 띄는 것이 지금 할 일이다. */}
        <div className={css.newGameSide}>
          <figure className={css.mapFigure}>
            <img
              src={`${import.meta.env.BASE_URL}assets/maps/${map.id}.thumb.webp`}
              width={280}
              height={168}
              alt={`${mapName} 지도`}
              draggable={false}
              className={css.mapThumb}
            />
            <figcaption className={css.mapName}>{mapName}</figcaption>
          </figure>
          <Button variant="primary" size="lg" block disabled={nickname === ''} onClick={() => onStart({ grade, difficulty, nickname })}>
            {HOME_COPY.start}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
