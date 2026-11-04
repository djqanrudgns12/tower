import { useId, useMemo, useState, type ReactNode } from 'react';
import type { MotionMode } from '../../application/session';
import { GUIDE_COPY as T } from '../copy';
import { BackIcon } from '../icons/ControlIcons';
import { ArtIcon, Button, Card, Modal } from '../kit';
import css from './GuideScreen.module.css';
import { buildGuideCards, type GuideCardSpec, type GuideCounterSpec } from './guide/guideModel';

interface Props {
  /** 지금은 쓰지 않는다(무대 캔버스를 걷어 냈다). 홈이 아직 넘기고 있어 받기만 한다. */
  motionMode?: MotionMode | undefined;
  /** 지금은 쓰지 않는다. */
  highContrastMap?: boolean | undefined;
  onBack(): void;
}

/**
 * 사용 설명서(R4 U3, PRD §10.3). 그림 카드 4장 + 타워 상성 1장, 카드마다 한 문장.
 * 기존 상세 글은 카드의 '자세히' 안에 있다.
 */
export function GuideScreen({ onBack }: Props) {
  const { cards, counters } = useMemo(() => buildGuideCards(), []);
  return (
    <Modal titleId="guideModalTitle" title={T.title} size="lg" onClose={onBack}>
      <div className={css.grid}>
        {cards.map(card => <GuideCard key={card.id} card={card} />)}
        <CounterCard counters={counters} />
      </div>
    </Modal>
  );
}

/** '자세히' 단추와 펼침 영역. 펼침 상태는 카드마다 따로 둔다. */
function Disclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <Button variant="ghost" className={css.more} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)}>
        {T.more}
        <span className={css.chevron} data-open={open} aria-hidden="true"><BackIcon size={20} /></span>
      </Button>
      <div id={panelId} className={css.detail} hidden={!open}>{children}</div>
    </>
  );
}

function GuideCard({ card }: { card: GuideCardSpec }) {
  return (
    <Card sunk as="article" className={css.card}>
      <img
        className={css.art}
        src={`${import.meta.env.BASE_URL}${card.illustrationUrl}`}
        alt={card.illustrationAlt}
        draggable={false}
      />
      <h3 className={css.title}>{card.title}</h3>
      <p className={css.sentence}>{card.sentence}</p>
      <Disclosure>
        <ul className={css.rows}>
          {card.details.map(d => (
            <li key={d.title}>
              <strong>{d.title}</strong>
              <span>{d.body}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </Card>
  );
}

function CounterCard({ counters }: { counters: GuideCounterSpec }) {
  return (
    <Card sunk as="article" className={`${css.card} ${css.counter}`}>
      <ul className={css.pairs}>
        {counters.pairs.map(p => (
          <li key={p.towerId} className={css.pair}>
            <ArtIcon name={p.trait} size={48} />
            <span className={css.enemy}>{p.enemy}</span>
            <span className={css.arrow} aria-hidden="true">→</span>
            <span className={css.tower}>{p.towerLabel}</span>
          </li>
        ))}
      </ul>
      <h3 className={css.title}>{counters.title}</h3>
      <p className={css.sentence}>{counters.sentence}</p>
      <Disclosure>
        <ul className={css.rows}>
          {counters.pairs.map(p => (
            <li key={p.towerId}>
              <strong>{p.towerLabel}</strong>
              <span>{p.note}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </Card>
  );
}
