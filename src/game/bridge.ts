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

/** 장착 홈에서 끌고 있는 타워와, 붙을 빈 자리(없으면 null). 끄는 동안 빈 자리를 강조하고 붙은 자리에 사거리를 그린다. */
export interface FieldDrag { type: TowerId; slotId: string | null }

/** 지금 화면에 보이는 세계 영역(세계 px). DOM 겹층이 칸 위치를 맞출 때 쓴다. */
export interface FieldView { x: number; y: number; width: number; height: number }

export interface FieldBridge {
  controller: RunController;
  selection: FieldSelection;
  /** 작은 화면에서 선택 칸 주변 확대(PRD §12.4). */
  magnify: boolean;
  /** 전장에 키보드 포커스가 있을 때 화살표로 옮기는 자리. 선택과 별개다(PRD §12.4). */
  keyboardSlotId: string | null;
  reducedMotion: boolean;
  /** 길·설치 받침 고대비 보조 윤곽선 표시. */
  highContrastMap: boolean;
  /** 장착 홈에서 끌어 놓는 중. */
  drag: FieldDrag | null;
  onTap(tap: FieldTap): void;
  /** 전장 그림과 같은 원본의 DOM 아이콘(data URL). */
  onIcons?(icons: Record<string, string>): void;
  /** 카메라가 바뀌면 보이는 세계 영역을 알린다. */
  onCamera?(view: FieldView): void;
}

/** React가 effect 안에서 update()로만 바꾸는 브리지 객체. Phaser는 매 프레임 필드를 읽는다. */
export class FieldBridgeHandle implements FieldBridge {
  selection: FieldSelection = { slotId: null, towerId: null, previewType: null, previewBranch: null };
  magnify = false;
  keyboardSlotId: string | null = null;
  reducedMotion = false;
  highContrastMap = false;
  drag: FieldDrag | null = null;
  onTap: (tap: FieldTap) => void = () => undefined;
  onIcons?: (icons: Record<string, string>) => void;
  onCamera?: (view: FieldView) => void;
  readonly controller: RunController;
  constructor(controller: RunController) { this.controller = controller; }
  update(next: Partial<Pick<FieldBridge, 'selection' | 'magnify' | 'keyboardSlotId' | 'reducedMotion' | 'highContrastMap' | 'drag' | 'onTap' | 'onIcons' | 'onCamera'>>) { Object.assign(this, next); }
}
