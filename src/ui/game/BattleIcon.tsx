import { LineIcon, type LineIconName } from '../icons/LineIcon';
import type { ArtIconName } from '../kit';

const names = {
  coin: 'hud/gold', gate: 'hud/gate', wave: 'hud/wave', star: 'hud/score', flame: 'hud/streak',
  note: 'hud/note', lock: 'hud/lock', chest: 'hud/chest',
  'trait.armor': 'traits/armor', 'trait.ward': 'traits/ward', 'trait.flying': 'traits/flying',
  'trait.swarm': 'traits/swarm', 'trait.fast': 'traits/fast', 'trait.split': 'traits/split',
  'trait.clay': 'traits/ward', 'trait.burrow': 'traits/siege',
} satisfies Record<ArtIconName, LineIconName>;

export function BattleIcon({ name, ...props }: { name: ArtIconName; size?: number; label?: string; className?: string | undefined }) {
  return <LineIcon name={names[name]} {...props} />;
}
