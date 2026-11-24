import type { Balance } from '../../contracts/balance';
import { R6_TOWERS, type R6TowerId } from '../../contracts/balanceV2';
import { buildCost, towerStats } from '../../domain/towers';
import { isR6Tower } from '../../domain/r6Towers';
import { Badge, Button, Modal, Panel } from '../kit';
import { LineIcon } from '../icons/LineIcon';
import { BattleTowerPortrait } from './BattleTowerPortrait';
import { battleTheme, battleTowerRole, WEAPON_RANKS } from './r6Display';
import { statBars } from './statBars';
import { StatRows } from './TowerDetail';
import css from './BattleDialogs.module.css';

export function TowerUnlockModal({ balance, tower, wave, owned, icons, onClose }: {
  balance: Balance;
  tower: R6TowerId;
  wave: number;
  owned: readonly string[];
  icons: Record<string, string>;
  onClose(): void;
}) {
  if (!balance.r6 || !isR6Tower(tower)) return null;
  const rules = balance.r6.rules;
  const theme = battleTheme(rules);
  const stats = towerStats(balance, tower, 1, 'base');
  return (
    <Modal titleId="tower-unlock-title" title="새 타워 해금" dismissable={false} onClose={onClose}>
      <div><Badge tone="amber">{wave}웨이브 완료</Badge></div>
      <Panel className={css.unlock} aria-label="해금 타워 정보">
        <div className={css.identity}>
          <h3>{theme.towers[tower].name}</h3>
          <Badge tone="amber"><LineIcon name="hud/gold" size={14} />{buildCost(balance, tower)} 골드</Badge>
        </div>
        <p>{battleTowerRole(balance, tower)}{stats.canHitFlyer ? ' · 공중 공격 가능' : ''}</p>
        <div className={css.unlockGrid}>
          <div className={css.blueprint}>
            <BattleTowerPortrait level={1} type={tower} icons={icons} size={108} />
            <StatRows bars={statBars(balance, tower, 1, 'base')} />
          </div>
          <section>
            <h3>무기 단계 I ~ IV</h3>
            <ol className={css.roadmap}>
              {rules.levels.weaponAt.map((at, index) => {
                const rank = WEAPON_RANKS[index]!;
                const weapon = theme.weapon(tower, rank);
                return <li key={rank}><Badge tone={index === 0 ? 'teal' : undefined}>{rank}</Badge> <span>Lv{at} · {weapon.summary}</span></li>;
              })}
            </ol>
          </section>
        </div>
      </Panel>
      <ul className={css.roster} aria-label="타워 해금 현황">
        {R6_TOWERS.map(type => {
          const at = Object.entries(rules.unlocks.afterCompletedWave).find(([, value]) => value === type)?.[0];
          return (
            <li key={type} data-new={type === tower || undefined}>
              <span>{theme.towers[type].name}</span>
              <small>{type === tower ? '새 해금' : owned.includes(type) ? '보유' : <><LineIcon name="hud/lock" size={12} />{at}웨이브</>}</small>
            </li>
          );
        })}
      </ul>
      <div className={css.actions}><Button variant="primary" onClick={onClose}><LineIcon name="hud/check" size={18} />확인</Button></div>
    </Modal>
  );
}
