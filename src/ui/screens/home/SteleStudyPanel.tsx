import { useEffect, useMemo, useRef, useState } from 'react';
import {
  kstDateKey,
  pickRandomStudyIndex,
  selectDailySteleCards,
} from '../../../application/lobby';
import { useLobbySprites, type SpriteMap } from './canvasAssets';
import { HomeUiArt, ShuffleIcon } from './HomeIcons';
import { drawSpriteGrounded } from './terrainBaker';
import css from './home.module.css';

interface Props {
  preferredGrade: number;
}

function renderSteleGarden(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sprites: SpriteMap,
  glyph: string,
): void {
  // 맑은 봄하늘 단색 바탕 + 몽글 크림 구름 2조각 (그라데이션 없음)
  ctx.fillStyle = '#dcecf4';
  ctx.fillRect(0, 0, w, h);

  const drawCloud = (cx: number, cy: number, r: number) => {
    ctx.fillStyle = '#fbf6ea';
    const puffs: readonly [number, number, number][] = [
      [-r * 0.85, r * 0.16, r * 0.72],
      [0, -r * 0.1, r],
      [r * 0.85, r * 0.18, r * 0.68],
    ];
    for (const [dx, dy, cr] of puffs) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, cr, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawCloud(w * 0.24, h * 0.19, 8.2);
  drawCloud(w * 0.78, h * 0.23, 7);

  // 뒤쪽 봄꽃나무 수관이 살짝 비치는 정원 깊이감
  const blossom = sprites.get('map.courtyard.tree.0')?.img;
  if (blossom) {
    ctx.drawImage(blossom, -14, h * 0.18, 46, 46);
  }

  // 2단 초록 잔디 언덕
  ctx.fillStyle = '#8cb956';
  ctx.beginPath();
  ctx.ellipse(w * 0.52, h * 0.94, w * 0.8, h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#719e41';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 1.02, w * 0.72, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  const flowerbed = sprites.get('prop.flowerbed')?.img;
  if (flowerbed) {
    ctx.drawImage(flowerbed, -5, h - 30, 36, 26);
    ctx.drawImage(flowerbed, w - 31, h - 28, 34, 25);
  }

  const size = Math.min(w * 0.78, h * 0.74);
  const sx = w * 0.5;
  const sy = h * 0.87;
  if (!drawSpriteGrounded(ctx, sprites, 'deco.stele', sx, sy, size, size, 0.22)) {
    ctx.fillStyle = '#c8c0b4';
    ctx.strokeStyle = '#6c6258';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sx - size * 0.3, sy - size * 0.76, size * 0.6, size * 0.68, [12, 12, 4, 4]);
    ctx.fill();
    ctx.stroke();
  }

  const bf = sprites.get('fx.butterfly.yellow.0')?.img;
  if (bf) {
    ctx.drawImage(bf, sx + size * 0.2, sy - size * 0.88, 14, 14);
  }

  ctx.fillStyle = '#3f352e';
  ctx.font = `800 ${Math.max(14, Math.round(size * 0.25))}px "Pretendard Variable", Pretendard, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, sx, sy - size * 0.49);
}

function SteleGardenCanvas({ glyph, sprites }: { glyph: string; sprites: SpriteMap }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(64, Math.round(rect.width || 96));
      const h = Math.max(68, Math.round(rect.height || 104));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderSteleGarden(ctx, w, h, sprites, glyph);
    };

    paint();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(paint) : null;
    ro?.observe(canvas);
    return () => ro?.disconnect();
  }, [glyph, sprites]);

  return <canvas ref={ref} className={css.steleGardenCanvas} aria-hidden="true" />;
}

export function SteleStudyPanel({ preferredGrade }: Props) {
  const date = kstDateKey();
  const cards = useMemo(() => selectDailySteleCards(preferredGrade, new Date(`${date}T00:00:00+09:00`)), [preferredGrade, date]);
  const key = `${date}:${preferredGrade}`;
  const [selection, setSelection] = useState({ key, index: 0, visited: [0] });
  const index = selection.key === key ? selection.index : 0;
  const sprites = useLobbySprites();

  if (cards.length === 0) {
    return (
      <section className={css.subCard} aria-label="오늘의 낱말">
        <div className={css.cardHeaderRow}>
          <div className={css.cardTitleWrap}>
            <span className={css.sectionIconBadge} aria-hidden="true">
              <HomeUiArt file="relic.lucky_pouch.webp" className={css.sectionIcon} />
            </span>
            <h2 className={css.sectionTitle}>오늘의 낱말</h2>
          </div>
        </div>
        <p className={css.exampleText}>검수된 오늘의 낱말을 준비하는 중이에요.</p>
      </section>
    );
  }

  const safeIndex = index % cards.length;
  const card = cards[safeIndex]!;

  const handleRandom = () => {
    const visited = new Set(selection.key === key ? selection.visited : [safeIndex]);
    if (visited.size >= cards.length) {
      visited.clear();
      visited.add(safeIndex);
    }
    const next = pickRandomStudyIndex(cards, safeIndex, visited);
    visited.add(next);
    setSelection({ key, index: next, visited: [...visited] });
  };

  return (
    <section className={css.subCard} aria-label="오늘의 낱말">
      <div className={css.cardHeaderRow}>
        <div className={css.cardTitleWrap}>
          <span className={css.sectionIconBadge} aria-hidden="true">
            <HomeUiArt file="relic.lucky_pouch.webp" className={css.sectionIcon} />
          </span>
          <h2 className={css.sectionTitle}>오늘의 낱말</h2>
          <span className={css.metaTag}>
            {card.gradeLabel} · {card.levelLabel}
          </span>
        </div>
        <button
          type="button"
          className={css.keyBtnSm}
          onClick={handleRandom}
        >
          <ShuffleIcon className={css.btnIconSvg} />
          랜덤
        </button>
      </div>

      <div className={css.wordStudyBody}>
        <div className={css.steleGardenFrame} aria-hidden="true">
          <SteleGardenCanvas glyph={card.glyph} sprites={sprites} />
        </div>

        <div className={css.wordStudyContent}>
          <div className={css.lemmaHeader}>
            <strong className={css.lemmaWord}>{card.lemma}</strong>
            <span className={css.posTag}>{card.partOfSpeech}</span>
          </div>

          <div className={css.noteGridBox}>
            <div className={css.noteGridRow}>
              <span className={css.noteRowLabel}>뜻풀이</span>
              <span className={css.meaningText} data-content>{card.meaning}</span>
            </div>
            <div className={css.noteRowDivider} aria-hidden="true" />
            <div className={css.noteGridRow}>
              <span className={css.noteRowLabelMuted}>예문</span>
              <p className={css.exampleText} data-content>
                ‘{card.examplePrefix}
                {card.exampleHighlight && <mark className={css.exampleHighlight}>{card.exampleHighlight}</mark>}
                {card.exampleSuffix}’
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
