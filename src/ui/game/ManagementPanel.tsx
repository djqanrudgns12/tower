import { useState } from 'react';
import type { BranchId, TowerId } from '../../contracts/balance';
import type { GameView, TowerView } from '../../application/view';
import type { GameContext } from '../../domain/context';
import { attackIntervalTicks, attacks, bannerAura, buildCost, needsBranch, sellRefund, towerStats, upgradeCost } from '../../domain/towers';
import type { FieldSelection } from '../../game/bridge';
import { BRANCH_MARK, fmtCells, fmtDamage, fmtSeconds, TOWER_COPY, withRo } from '../copy';
import { BranchMarkIcon, LockPadIcon, TowerShieldPortrait } from '../icons/GameIcons';
import kit from '../kit.module.css';
import css from './ManagementPanel.module.css';

export type PanelMode = 'idle' | 'slot' | 'tower' | 'branch' | 'sell';
export type TowerRoleGroup = 'fast' | 'area' | 'slow' | 'support';
export type TowerRoleFilter = 'all' | TowerRoleGroup;

export const TOWER_ROLE_GROUP: Record<TowerId, TowerRoleGroup> = {
  archer: 'fast',
  crossbow: 'fast',
  mage: 'fast',
  spear: 'fast',
  cannon: 'area',
  lightning: 'area',
  flame: 'area',
  frost: 'slow',
  guardian: 'support',
  banner: 'support',
};

const ROLE_FILTERS: readonly { id: TowerRoleFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'fast', label: '빠른 공격' },
  { id: 'area', label: '범위' },
  { id: 'slow', label: '느리게' },
  { id: 'support', label: '지원' },
];

interface Props {
  ctx: GameContext;
  view: GameView;
  towers: readonly TowerId[];
  selection: FieldSelection;
  mode: PanelMode;
  icons: Record<string, string>;
  compact: boolean;
  compactRail?: boolean;
  onPickType(type: TowerId): void;
  onBuild(): void;
  onUpgrade(branch?: BranchId): void;
  onPreviewBranch(branch: BranchId | null): void;
  onMode(mode: PanelMode): void;
  onSell(): void;
  onClear(): void;
}

/**
 * 타워 장착함·관리 패널(PRD §12.3 + 시안 1 v3 음각 사암 소켓함).
 * 같은 자리에서 idle / slot / tower / branch / sell 중 하나만 보여주며 중앙 모달을 연쇄로 열지 않는다.
 */
export function ManagementPanel(p: Props) {
  const b = p.ctx.balance;
  const [scope, setScope] = useState<'basic' | 'all'>('basic');
  const [roleFilter, setRoleFilter] = useState<TowerRoleFilter>('all');
  const trading = p.view.phase === 'BUILD' || p.view.phase === 'BATTLE';
  const lock = p.view.phase === 'PREP_QUIZ'
    ? '준비 문제를 먼저 풀어 주세요'
    : p.view.phase === 'WAVE_WRAPUP'
      ? '다음 웨이브 준비 중이에요'
      : null;
  const tower = p.selection.towerId !== null ? p.view.towers.find(t => t.id === p.selection.towerId) ?? null : null;
  const shortage = (cost: number) => (p.view.gold < cost ? `골드 ${cost - p.view.gold} 부족` : null);

  if (tower && p.mode === 'branch') {
    return <BranchChoice {...p} tower={tower} trading={trading} lock={lock} shortage={shortage} />;
  }

  if (tower && p.mode === 'sell') {
    const refund = sellRefund(b, tower);
    return (
      <div className={css.panel}>
        <TowerHeader tower={tower} icons={p.icons} ctx={p.ctx} />
        <div className={css.statWell}>
          <p className={css.sellNote}>
            판매하면 투자한 골드의 60%인 <strong>{refund}골드</strong>를 돌려받아요.
          </p>
        </div>
        <div className={css.secondaryRow}>
          <button type="button" className={`${kit.button} ${kit.danger}`} disabled={!trading} onClick={p.onSell}>
            {refund}골드에 판매
          </button>
          <button type="button" className={`${kit.button} ${kit.quietWood}`} onClick={() => p.onMode('tower')}>
            취소
          </button>
        </div>
        {!trading && lock && (
          <p className={css.lockBanner}>
            <LockPadIcon size={14} />
            <span>{lock}</span>
          </p>
        )}
      </div>
    );
  }

  if (tower) {
    const next = upgradeCost(b, tower.type, tower.level);
    const linearNextLevel = next !== null && !needsBranch(b, tower.level) ? tower.level + 1 : null;
    const delta = linearNextLevel !== null ? strengthDelta(b, tower.type, tower.level, tower.branch) : null;
    const refund = sellRefund(b, tower);
    const shortMsg = next !== null ? shortage(next) : null;
    return (
      <div className={css.panel}>
        <TowerHeader tower={tower} icons={p.icons} ctx={p.ctx} />
        <Stats ctx={p.ctx} type={tower.type} level={tower.level} nextLevel={linearNextLevel} branch={tower.branch} />
        {b.branches[tower.type] && tower.branch && (
          <div className={css.branchActive}>
            <BranchMarkIcon id={tower.branch} size={18} />
            <span>
              <strong>{b.branches[tower.type]![tower.branch].label}</strong> · {b.branches[tower.type]![tower.branch].summary}
            </span>
          </div>
        )}
        {next === null ? (
          <p className={css.maxBadge}>최고 단계 달성</p>
        ) : needsBranch(b, tower.level) ? (
          <button type="button" className={`${kit.button} ${kit.primary} ${kit.block}`} disabled={!trading} onClick={() => p.onMode('branch')}>
            진화할 길 고르기 · {next}골드
          </button>
        ) : (
          <button
            type="button"
            className={`${kit.button} ${kit.primary} ${kit.block}`}
            disabled={!trading || p.view.gold < next}
            onClick={() => p.onUpgrade()}
          >
            <span className={css.upgrade}>
              <span>강화 · {next}골드</span>
              {delta && <span className={css.delta}>{delta}</span>}
            </span>
          </button>
        )}
        {!trading && lock ? (
          <p className={css.lockBanner}>
            <LockPadIcon size={14} />
            <span>{lock}</span>
          </p>
        ) : shortMsg ? (
          <p className={kit.reason}>{shortMsg}</p>
        ) : null}
        <div className={css.secondaryRow}>
          <button type="button" className={`${kit.button} ${kit.quietWood}`} disabled={!trading} onClick={() => p.onMode('sell')}>
            판매 ({refund}골드)
          </button>
          <button type="button" className={`${kit.button} ${kit.quietWood}`} onClick={p.onClear}>
            선택 해제
          </button>
        </div>
      </div>
    );
  }

  const hasExtraTowers = p.towers.length > 3;
  const allScope = hasExtraTowers && scope === 'all';
  const visibleTowers = !hasExtraTowers || scope === 'basic'
    ? p.towers.slice(0, 3)
    : roleFilter === 'all'
      ? p.towers
      : p.towers.filter(t => TOWER_ROLE_GROUP[t] === roleFilter);
  const picking = p.selection.previewType;
  const cost = picking ? buildCost(b, picking) : 0;
  const shortMsg = picking ? shortage(cost) : null;
  const iconSize = allScope ? 32 : p.compact ? 36 : p.compactRail ? 34 : 42;
  const listClass = allScope ? css.listAllGrid : p.compact ? css.listCompact : css.list;
  const compactCard = allScope || p.compact;

  return (
    <div className={`${css.panel} ${p.compactRail ? css.panelCompactRail : ''}`}>
      <div className={css.mgmtHead}>
        <p className={css.title}>{p.selection.slotId ? '어떤 타워를 놓을까요?' : '타워 장착함'}</p>
        {hasExtraTowers ? (
          <div className={css.scopeTabs} role="tablist" aria-label="타워 표시 범위">
            <button
              type="button"
              role="tab"
              className={css.scopeTab}
              aria-selected={scope === 'basic'}
              onClick={() => setScope('basic')}
            >
              기본 3종
            </button>
            <button
              type="button"
              role="tab"
              className={css.scopeTab}
              aria-selected={scope === 'all'}
              onClick={() => setScope('all')}
            >
              전체 {p.towers.length}종
            </button>
          </div>
        ) : (
          <span className={css.scopeBadge}>기본 {p.towers.length}종</span>
        )}
      </div>

      {allScope && (
        <div className={css.roleBar} role="group" aria-label="타워 역할 필터">
          {ROLE_FILTERS.map(r => (
            <button
              key={r.id}
              type="button"
              className={css.roleChip}
              aria-pressed={roleFilter === r.id}
              onClick={() => setRoleFilter(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {!p.selection.slotId && !p.compactRail && !allScope && (
        <p className={css.guide}>
          {picking ? '빛나는 돌 받침을 눌러 자리를 고르세요.' : '빈 돌 받침을 누르거나 타워를 먼저 고르세요.'}
        </p>
      )}

      <div className={css.socketWell}>
        <div className={listClass} role="listbox" aria-label="타워 목록">
          {visibleTowers.map(type => {
            const price = buildCost(b, type);
            const selected = picking === type;
            return (
              <button
                key={type}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${css.item} ${p.compactRail ? css.itemCompactRail : ''} ${selected ? css.picked : ''}`}
                onClick={() => p.onPickType(type)}
              >
                <TowerShieldPortrait type={type} icons={p.icons} size={iconSize} />
                <span className={css.itemText}>
                  <span className={css.nameRow}>
                    <span className={css.name}>{b.towers[type].label}</span>
                    {!compactCard && (
                      <span className={css.price} data-short={p.view.gold < price}>
                        {price}골드
                      </span>
                    )}
                  </span>
                  {!compactCard && !p.compactRail && <span className={css.role}>{TOWER_COPY[type]?.role}</span>}
                </span>
                {compactCard && (
                  <span className={css.price} data-short={p.view.gold < price}>
                    {price}골드
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {picking && (
        <>
          {!p.compact && !p.compactRail && <Stats ctx={p.ctx} type={picking} level={1} branch={null} />}
          {p.selection.slotId && (
            <div className={css.actionRow}>
              <button
                type="button"
                className={`${kit.button} ${kit.primary} ${css.grow}`}
                disabled={!trading || p.view.gold < cost}
                onClick={p.onBuild}
              >
                설치 · {cost}골드
              </button>
              <button type="button" className={`${kit.button} ${kit.quietWood}`} onClick={p.onClear}>
                취소
              </button>
            </div>
          )}
          {!trading && lock ? (
            <p className={css.lockBanner}>
              <LockPadIcon size={14} />
              <span>{lock}</span>
            </p>
          ) : shortMsg ? (
            <p className={kit.reason}>{shortMsg}</p>
          ) : null}
        </>
      )}

      {!picking && !trading && lock && (
        <p className={css.lockBanner}>
          <LockPadIcon size={14} />
          <span>{lock}</span>
        </p>
      )}
    </div>
  );
}

function BranchChoice(p: Props & { tower: TowerView; trading: boolean; lock: string | null; shortage(cost: number): string | null }) {
  const b = p.ctx.balance;
  const branches = b.branches[p.tower.type];
  const cost = upgradeCost(b, p.tower.type, p.tower.level)!;
  const chosen = p.selection.previewBranch;
  if (!branches) return null;
  const shortMsg = p.shortage(cost);
  return (
    <div className={css.panel}>
      <div className={css.mgmtHead}>
        <p className={css.title}>{b.towers[p.tower.type].label}의 진화 길</p>
        <span className={css.scopeBadge}>레벨 2 → 3</span>
      </div>
      <div className={css.socketWell}>
        <div className={css.branchList}>
          {(['A', 'B'] as const).map(id => {
            const br = branches[id];
            return (
              <button
                key={id}
                type="button"
                className={`${css.branch} ${chosen === id ? css.picked : ''}`}
                aria-pressed={chosen === id}
                onClick={() => p.onPreviewBranch(id)}
              >
                <BranchMarkIcon id={id} size={24} />
                <span className={css.itemText}>
                  <span className={css.nameRow}>
                    <span className={css.name}>{br.label}</span>
                    <span className={css.branchPathTag} data-branch={id}>{BRANCH_MARK[id]}</span>
                  </span>
                  <span className={css.role}>{br.summary}</span>
                  <span className={css.branchStats}>{statText(b, p.tower.type, 3, id)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className={`${kit.button} ${kit.primary} ${kit.block}`}
        disabled={!chosen || !p.trading || p.view.gold < cost}
        onClick={() => chosen && p.onUpgrade(chosen)}
      >
        {chosen ? `${withRo(branches[chosen].label)} 진화 · ${cost}골드` : '길을 하나 골라요'}
      </button>
      {!p.trading && p.lock ? (
        <p className={css.lockBanner}>
          <LockPadIcon size={14} />
          <span>{p.lock}</span>
        </p>
      ) : shortMsg ? (
        <p className={kit.reason}>{shortMsg}</p>
      ) : null}
      <button
        type="button"
        className={`${kit.button} ${kit.quietWood} ${kit.block}`}
        onClick={() => {
          p.onPreviewBranch(null);
          p.onMode('tower');
        }}
      >
        뒤로
      </button>
    </div>
  );
}

function TowerHeader({ tower, icons, ctx }: { tower: TowerView; icons: Record<string, string>; ctx: GameContext }) {
  const b = ctx.balance;
  return (
    <div className={css.header}>
      <TowerShieldPortrait type={tower.type} icons={icons} size={56} />
      <div className={css.headerMeta}>
        <div className={css.headerTitleRow}>
          <span className={css.name}>{b.towers[tower.type].label}</span>
          <span className={css.levelTag}>레벨 {tower.level}</span>
        </div>
        <p className={css.role}>{TOWER_COPY[tower.type]?.role}</p>
      </div>
    </div>
  );
}

/** 강화 단추의 변화 한 줄: 공격 타워는 힘, 깃발은 주변 효과. */
function strengthDelta(b: GameContext['balance'], type: TowerId, level: number, branch: BranchId | null): string {
  if (!attacks(b, type)) return `${auraText(bannerAura(b, { type, level, branch }))} → ${auraText(bannerAura(b, { type, level: level + 1, branch }))}`;
  return `힘 ${fmtDamage(towerStats(b, type, level, branch).damage)} → ${fmtDamage(towerStats(b, type, level + 1, branch).damage)}`;
}

/** 깃발 효과(PRD §7.1·§7.3): 피해 보너스 또는 공격 속도 보너스. */
const auraText = (a: { damageBP: number; speedBP: number }) => (a.speedBP > 0 ? `주변 속도 +${a.speedBP / 100}%` : `주변 힘 +${a.damageBP / 100}%`);

/** 분기 고르기의 한 줄 요약. */
function statText(b: GameContext['balance'], type: TowerId, level: number, branch: BranchId | null): string {
  if (!attacks(b, type)) return `${auraText(bannerAura(b, { type, level, branch }))} · ${fmtCells(b.towers[type].rangeMilli)}`;
  const s = towerStats(b, type, level, branch);
  return `힘 ${fmtDamage(s.damage)} · ${fmtSeconds(attackIntervalTicks(b, s, 0))} · ${fmtCells(s.range)}`;
}

function Stats({
  ctx,
  type,
  level,
  nextLevel = null,
  branch,
}: {
  ctx: GameContext;
  type: TowerId;
  level: number;
  nextLevel?: number | null;
  branch: BranchId | null;
}) {
  const b = ctx.balance;
  if (!attacks(b, type)) {
    const curAura = auraText(bannerAura(b, { type, level, branch }));
    const nextAura = nextLevel !== null ? auraText(bannerAura(b, { type, level: nextLevel, branch })) : null;
    return (
      <div className={css.statWell}>
        <p className={css.stats}>
          <strong>{nextAura ? `${curAura} → ${nextAura}` : curAura}</strong> · <strong>{fmtCells(b.towers[type].rangeMilli)}</strong> 안 공격 타워
        </p>
      </div>
    );
  }
  const s = towerStats(b, type, level, branch);
  const nextS = nextLevel !== null ? towerStats(b, type, nextLevel, branch) : null;
  return (
    <div className={css.statWell}>
      <p className={css.stats}>
        {/* ‘힘 8 → 10.4 · 1초마다 · 2.5칸’(PRD §2.3, §6.3). 구분점은 읽기 프로그램도 읽도록 글자로 둔다. */}
        {[
          <>힘 <strong>{nextS ? `${fmtDamage(s.damage)} → ${fmtDamage(nextS.damage)}` : fmtDamage(s.damage)}</strong></>,
          <strong>{fmtSeconds(attackIntervalTicks(b, s, 0))}</strong>,
          <strong>{fmtCells(s.range)}</strong>,
          s.slowBP > 0 && <>느리게 <strong>{s.slowBP / 100}%</strong></>,
          s.splashRadius > 0 && <>최대 <strong>{s.maxTargets}마리</strong></>,
        ].filter(Boolean).map((part, i) => (
          <span key={i}>{i > 0 && ' · '}{part}</span>
        ))}
      </p>
    </div>
  );
}

export const Icon = TowerShieldPortrait;
