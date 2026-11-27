import { Button, Modal } from '../kit';
import css from './RecordConsentModal.module.css';

interface Props {
  onDecide(shareRecords: boolean): void;
  onClose(): void;
}

/**
 * 첫 새 게임 진입 시 1회 표시되는 순위표 기록 공유 동의 모달(WP-Q1b).
 * 학교명 없이 공개되는 5가지 항목만 고지하고, 두 선택지를 동등한 버튼 무게로 제시한다.
 */
export function RecordConsentModal({ onDecide, onClose }: Props) {
  return (
    <Modal
      titleId="recordConsentTitle"
      title="순위표에 기록을 올릴까요?"
      size="sm"
      onClose={onClose}
    >
      <div className={css.body}>
        <p className={css.lead}>
          게임을 마치면 다른 친구들과 함께 보는 순위표에 내 기록을 올릴 수 있어요.
        </p>
        <p className={css.fields}>
          공유되는 항목: 닉네임 · 학년 · 난이도 · 점수 · 웨이브
        </p>
        <p className={css.note}>
          어떤 쪽을 골라도 게임과 내 기기 기록 저장은 그대로 동작하며, 홈 화면 설정에서 언제든 바꿀 수 있어요.
        </p>
        <div className={css.actions}>
          <Button
            variant="secondary"
            size="lg"
            block
            className={css.choiceBtn ?? ''}
            onClick={() => onDecide(true)}
          >
            순위표에 올리기
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            className={css.choiceBtn ?? ''}
            onClick={() => onDecide(false)}
          >
            이 기기에만 저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}
