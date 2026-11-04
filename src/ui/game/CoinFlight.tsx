import type { CSSProperties } from 'react';
import { ArtIcon } from '../kit';
import css from './CoinFlight.module.css';

export interface Flight { id: number; from: { x: number; y: number }; to: { x: number; y: number }; coins: number }

/** 정답 보상 금화 수: 2~5개. 골드가 클수록 많이. */
export const coinsFor = (gold: number) => Math.max(2, Math.min(5, Math.round(gold / 8)));

/**
 * 보상 → 금화가 받은 자리(정답 답안 키·보스 처치 자리·성문)에서 골드 칸으로 날아간다(ui-rules-v2 §5, R5 B8). 보상은 이미 상태에 반영된 뒤의 연출이다(PRD §10.3).
 * 동전 그림은 상태 카드·타워 칸과 같은 원화 coin이다(R5 C6).
 * 바깥 층은 가로로 곧게, 안쪽 층은 위로 솟았다 내려오며 날아 호를 그린다. 600ms 안에 끝나고 스스로 지워진다.
 */
export function CoinFlight({ flights, onDone }: { flights: readonly Flight[]; onDone(id: number): void }) {
  return (
    <div className={css.layer} aria-hidden="true">
      {flights.map(f => (
        Array.from({ length: f.coins }, (_, i) => {
          const spread = (i - (f.coins - 1) / 2) * 14;
          const style = {
            left: f.from.x + spread,
            top: f.from.y,
            '--dx': `${f.to.x - f.from.x - spread}px`,
            '--dy': `${f.to.y - f.from.y}px`,
            animationDelay: `${i * 40}ms`,
          } as CSSProperties;
          return (
            <span
              key={`${f.id}-${i}`}
              className={css.x}
              style={style}
              onAnimationEnd={i === f.coins - 1 ? () => onDone(f.id) : undefined}
            >
              <span className={css.y} style={{ animationDelay: `${i * 40}ms` }}>
                <ArtIcon name="coin" size={20} />
              </span>
            </span>
          );
        })
      ))}
    </div>
  );
}
