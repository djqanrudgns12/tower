import type { BranchId, TowerId } from '../contracts/balance';
import type { RunController } from '../application/RunController';

// React(관리 패널)와 Phaser(전장) 사이의 얇은 연결. 선택은 화면 상태이며 도메인 상태가 아니다.
export interface FieldSelection {
  slotId: string | null;
  towerId: number | null;
  previewType: TowerId | null;
  previewBranch: BranchId | null;
}

export type FieldTap = { kind: 'slot'; slotId: string } | { kind: 'tower'; towerId: number; slotId: string } | { kind: 'empty' };

export interface FieldBridge {
  controller: RunController;
  selection: FieldSelection;
  /** 작은 화면에서 선택 칸 주변 확대(PRD §12.4). */
  magnify: boolean;
  reducedMotion: boolean;
  onTap(tap: FieldTap): void;
  /** 전장 그림과 같은 원본의 DOM 아이콘(data URL). */
  onIcons?(icons: Record<string, string>): void;
}

/** React가 effect 안에서 update()로만 바꾸는 브리지 객체. Phaser는 매 프레임 필드를 읽는다. */
export class FieldBridgeHandle implements FieldBridge {
  selection: FieldSelection = { slotId: null, towerId: null, previewType: null, previewBranch: null };
  magnify = false;
  reducedMotion = false;
  onTap: (tap: FieldTap) => void = () => undefined;
  onIcons?: (icons: Record<string, string>) => void;
  readonly controller: RunController;
  constructor(controller: RunController) { this.controller = controller; }
  update(next: Partial<Pick<FieldBridge, 'selection' | 'magnify' | 'reducedMotion' | 'onTap' | 'onIcons'>>) { Object.assign(this, next); }
}
