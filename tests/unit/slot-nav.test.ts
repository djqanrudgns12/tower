import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/content';
import { nextSlot } from '../../src/ui/game/SlotList';

// PRD §12.4: 전장 키보드는 화살표로 슬롯 이동. 좌표 입력을 요구하지 않는다.
describe('전장 키보드 자리 이동', () => {
  const slots = MAPS.find(m => m.id === 'garden_u')!.slots;
  const at = (x: number, y: number) => slots.find(s => s.x === x && s.y === y)!.id;

  it('처음에는 첫 자리에서 시작한다', () => {
    expect(nextSlot(slots, null, 'ArrowRight')).toBe(slots[0]!.id);
  });
  it('그 방향의 가장 가까운 자리로 가고, 옆으로 벗어난 거리는 두 배로 친다', () => {
    expect(nextSlot(slots, at(0, 0), 'ArrowRight')).toBe(at(3, 0));
    expect(nextSlot(slots, at(0, 0), 'ArrowDown')).toBe(at(0, 2));
    expect(nextSlot(slots, at(8, 2), 'ArrowUp')).toBe(at(8, 0));
  });
  it('그 방향에 자리가 없으면 그대로 둔다', () => {
    expect(nextSlot(slots, at(0, 0), 'ArrowLeft')).toBe(at(0, 0));
    expect(nextSlot(slots, at(0, 0), 'ArrowUp')).toBe(at(0, 0));
  });
  it('모든 자리에 화살표만으로 닿을 수 있다', () => {
    const seen = new Set<string>([slots[0]!.id]);
    const queue = [slots[0]!.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const) {
        const next = nextSlot(slots, id, key)!;
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    expect(seen.size).toBe(slots.length);
  });
});
