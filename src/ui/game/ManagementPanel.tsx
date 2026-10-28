import type { BranchId, TowerId } from '../../contracts/balance';
import type { GameView, TowerView } from '../../application/view';
import type { GameContext } from '../../domain/context';
import { attackIntervalTicks, buildCost, needsBranch, sellRefund, towerStats, upgradeCost } from '../../domain/towers';
import type { FieldSelection } from '../../game/bridge';
import { fmtCells, fmtDamage, fmtSeconds, TOWER_COPY, withRo } from '../copy';
import kit from '../kit.module.css';
import css from './ManagementPanel.module.css';

export type PanelMode = 'idle' | 'slot' | 'tower' | 'branch' | 'sell';

interface Props {
  ctx: GameContext;
  view: GameView;
  towers: readonly TowerId[];
  selection: FieldSelection;
  mode: PanelMode;
  icons: Record<string, string>;
  compact: boolean;
  onPickType(type: TowerId): void;
  onBuild(): void;
  onUpgrade(branch?: BranchId): void;
  onPreviewBranch(branch: BranchId | null): void;
  onMode(mode: PanelMode): void;
  onSell(): void;
  onClear(): void;
}

/** 관리 패널: 같은 자리에서 idle/slot/tower/branch/sell 하나만 보인다(PRD §12.3). 중앙 모달을 연쇄로 열지 않는다. */
export function ManagementPanel(p: Props) {
  const b = p.ctx.balance;
  const trading = p.view.phase === 'BUILD' || p.view.phase === 'BATTLE';
  const lock = p.view.phase === 'PREP_QUIZ' ? '준비 문제를 먼저 풀어 주세요' : p.view.phase === 'WAVE_WRAPUP' ? '다음 웨이브 준비 중이에요' : null;
  const tower = p.selection.towerId !== null ? p.view.towers.find(t => t.id === p.selection.towerId) ?? null : null;
  const shortage = (cost: number) => (p.view.gold < cost ? `골드 ${cost - p.view.gold} 부족` : null);

  if (tower && p.mode === 'branch') return <BranchChoice {...p} tower={tower} trading={trading} lock={lock} shortage={shortage} />;
  if (tower && p.mode === 'sell') {
    const refund = sellRefund(b, tower);
    return (
      <div className={css.panel}>
        <TowerHeader tower={tower} icons={p.icons} ctx={p.ctx} />
        <p>판매하면 낸 골드의 60%를 돌려받아요.</p>
        <div className={css.row}>
          <button type="button" className={`${kit.button} ${kit.danger}`} disabled={!trading} onClick={p.onSell}>{refund}골드에 판매</button>
          <button type="button" className={kit.button} onClick={() => p.onMode('tower')}>취소</button>
        </div>
        {!trading && <p className={kit.reason}>{lock}</p>}
      </div>
    );
  }
  if (tower) {
    const next = upgradeCost(b, tower.type, tower.level);
    const stats = towerStats(b, tower.type, tower.level, tower.branch);
    const after = next !== null && !needsBranch(b, tower.level) ? towerStats(b, tower.type, tower.level + 1, tower.branch) : null;
    const reason = !trading ? lock : next !== null ? shortage(next) : null;
    return (
      <div className={css.panel}>
        <TowerHeader tower={tower} icons={p.icons} ctx={p.ctx} />
        <Stats ctx={p.ctx} type={tower.type} level={tower.level} branch={tower.branch} />
        {b.branches[tower.type] && tower.branch && <p className={css.effect}>{b.branches[tower.type]![tower.branch].label}: {b.branches[tower.type]![tower.branch].summary}</p>}
        {next === null ? <p className={kit.muted}>최고 레벨이에요.</p> : needsBranch(b, tower.level) ? (
          <button type="button" className={`${kit.button} ${kit.primary} ${kit.block}`} disabled={!trading} onClick={() => p.onMode('branch')}>진화할 길 고르기 · {next}골드</button>
        ) : (
          <button type="button" className={`${kit.button} ${kit.primary} ${kit.block}`} disabled={!trading || p.view.gold < next} onClick={() => p.onUpgrade()}>
            <span className={css.upgrade}><span>강화 · {next}골드</span>{after && <span className={css.delta}>힘 {fmtDamage(stats.damage)} → {fmtDamage(after.damage)}</span>}</span>
          </button>
        )}
        <p className={kit.reason}>{reason}</p>
        <div className={css.row}>
          <button type="button" className={kit.button} disabled={!trading} onClick={() => p.onMode('sell')}>판매</button>
          <button type="button" className={`${kit.button} ${kit.quiet}`} onClick={p.onClear}>닫기</button>
        </div>
      </div>
    );
  }

  const picking = p.selection.previewType;
  const cost = picking ? buildCost(b, picking) : 0;
  return (
    <div className={css.panel}>
      <p className={css.title}>{p.selection.slotId ? '어떤 타워를 놓을까요?' : '타워'}</p>
      {!p.selection.slotId && <p className={kit.muted}>{picking ? '빛나는 돌 받침을 눌러 자리를 고르세요.' : '빈 돌 받침을 누르거나 타워를 먼저 고르세요.'}</p>}
      <div className={p.compact ? css.listCompact : css.list} role="listbox" aria-label="타워 목록">
        {p.towers.map(type => {
          const price = buildCost(b, type);
          return (
            <button key={type} type="button" role="option" aria-selected={picking === type} className={`${css.item} ${picking === type ? css.picked : ''}`} onClick={() => p.onPickType(type)}>
              <Icon type={type} icons={p.icons} size={p.compact ? 36 : 44} />
              <span className={css.itemText}>
                <span className={css.nameRow}><span className={css.name}>{b.towers[type].label}</span>{!p.compact && <span className={css.price} data-short={p.view.gold < price}>{price}</span>}</span>
                {!p.compact && <span className={css.role}>{TOWER_COPY[type]?.role}</span>}
              </span>
              {p.compact && <span className={css.price} data-short={p.view.gold < price}>{price}</span>}
            </button>
          );
        })}
      </div>
      {picking && (
        <>
          {!p.compact && <Stats ctx={p.ctx} type={picking} level={1} branch={null} />}
          {p.selection.slotId && (
            <div className={css.row}>
              <button type="button" className={`${kit.button} ${kit.primary}`} disabled={!trading || p.view.gold < cost} onClick={p.onBuild}>설치 · {cost}골드</button>
              <button type="button" className={kit.button} onClick={p.onClear}>취소</button>
            </div>
          )}
          <p className={kit.reason}>{!trading ? lock : shortage(cost)}</p>
        </>
      )}
      {!picking && lock && <p className={kit.reason}>{lock}</p>}
    </div>
  );
}

function BranchChoice(p: Props & { tower: TowerView; trading: boolean; lock: string | null; shortage(cost: number): string | null }) {
  const b = p.ctx.balance;
  const branches = b.branches[p.tower.type];
  const cost = upgradeCost(b, p.tower.type, p.tower.level)!;
  const chosen = p.selection.previewBranch;
  if (!branches) return null;
  return (
    <div className={css.panel}>
      <p className={css.title}>{b.towers[p.tower.type].label}의 진화 길</p>
      {(['A', 'B'] as const).map(id => {
        const br = branches[id];
        const stats = towerStats(b, p.tower.type, 3, id);
        return (
          <button key={id} type="button" className={`${css.branch} ${chosen === id ? css.picked : ''}`} aria-pressed={chosen === id} onClick={() => p.onPreviewBranch(id)}>
            <BranchMark id={id} />
            <span className={css.itemText}>
              <span className={css.name}>{br.label}</span>
              <span className={css.role}>{br.summary}</span>
              <span className={css.role}>힘 {fmtDamage(stats.damage)} · {fmtSeconds(attackIntervalTicks(b, stats, 0))} · {fmtCells(stats.range)}</span>
            </span>
          </button>
        );
      })}
      <button type="button" className={`${kit.button} ${kit.primary} ${kit.block}`} disabled={!chosen || !p.trading || p.view.gold < cost} onClick={() => chosen && p.onUpgrade(chosen)}>
        {chosen ? `${withRo(branches[chosen].label)} 진화 · ${cost}골드` : '길을 하나 골라요'}
      </button>
      <p className={kit.reason}>{!p.trading ? p.lock : p.shortage(cost)}</p>
      <button type="button" className={`${kit.button} ${kit.quiet}`} onClick={() => { p.onPreviewBranch(null); p.onMode('tower'); }}>뒤로</button>
    </div>
  );
}

/** 분기 표식: A 동그라미, B 마름모(copy.ts BRANCH_MARK). 반경 토큰을 쓰지 않도록 도형으로 그린다(PRD §12.8). */
function BranchMark({ id }: { id: BranchId }) {
  return (
    <svg className={css.branchMark} data-branch={id} viewBox="0 0 22 22" aria-hidden="true">
      {id === 'A' ? <circle cx="11" cy="11" r="8.5" /> : <polygon points="11,2 20,11 11,20 2,11" />}
    </svg>
  );
}

function TowerHeader({ tower, icons, ctx }: { tower: TowerView; icons: Record<string, string>; ctx: GameContext }) {
  const b = ctx.balance;
  return (
    <div className={css.header}>
      <Icon type={tower.type} icons={icons} size={56} />
      <div>
        <p className={css.name}>{b.towers[tower.type].label} <span className={css.level}>레벨 {tower.level}</span></p>
        <p className={css.role}>{TOWER_COPY[tower.type]?.role}</p>
      </div>
    </div>
  );
}

function Stats({ ctx, type, level, branch }: { ctx: GameContext; type: TowerId; level: number; branch: BranchId | null }) {
  const b = ctx.balance;
  const s = towerStats(b, type, level, branch);
  return (
    <p className={css.stats}>
      {/* ‘힘 8 · 1초마다 · 2.5칸’(PRD §2.3). 구분점은 읽기 프로그램도 읽도록 글자로 둔다. */}
      {[
        <>힘 <strong>{fmtDamage(s.damage)}</strong></>,
        <strong>{fmtSeconds(attackIntervalTicks(b, s, 0))}</strong>,
        <strong>{fmtCells(s.range)}</strong>,
        s.slowBP > 0 && <>느리게 <strong>{s.slowBP / 100}%</strong></>,
        s.splashRadius > 0 && <>최대 <strong>{s.maxTargets}마리</strong></>,
      ].filter(Boolean).map((part, i) => <span key={i}>{i > 0 && ' · '}{part}</span>)}
    </p>
  );
}

export function Icon({ type, icons, size }: { type: TowerId; icons: Record<string, string>; size: number }) {
  const body = icons[`tower.${type}`], weapon = icons[`tower.${type}.weapon`];
  return (
    <span className={css.icon} style={{ width: size, height: size }} aria-hidden="true">
      {body && <img src={body} alt="" style={{ width: size, height: size * 1.25, top: -size * 0.12 }} />}
      {weapon && <img src={weapon} alt="" style={{ width: size * 0.7, height: size * 0.7, left: size * 0.15, top: type === 'frost' ? size * 0.02 : size * 0.06, transform: type === 'frost' ? undefined : 'rotate(-90deg)' }} />}
    </span>
  );
}
