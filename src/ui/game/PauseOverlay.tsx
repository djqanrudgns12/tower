import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PauseReason } from '../../domain/types';
import type { FontScale } from '../../application/session';
import { PAUSE_COPY, RENDER_WAIT } from '../copy';
import { Button, Card, Modal, Segmented, Toggle } from '../kit';
import css from './PauseOverlay.module.css';

interface Props {
  reasons: PauseReason[];
  /** 화면(WebGL)이 아직 돌아오지 않았다. ‘계속’을 막되 포커스는 받도록 aria-disabled를 쓴다. */
  renderLost: boolean;
  fontScale: FontScale;
  soundOn: boolean;
  onResume(): void;
  onFont(scale: FontScale): void;
  onSound(on: boolean): void;
  /** 이번 판 끝내기(확인 뒤). 기록·오답 노트·결과 화면으로 간다. */
  onQuit(): void;
  /** 수치 한계로 막힌 판에서 처음 화면으로 나간다. 그 판은 기록하지 않는다. */
  onLeave(): void;
  /** 연 단추를 찾지 못했을 때(정지 층이 열리며 화면이 비활성화돼 포커스가 풀린 경우) 돌아갈 곳. */
  restoreFocus?(): void;
}

/** 정지 창은 닫기 단추·Esc·막 누르기로 닫히지 않는다(계속하기로만 돌아간다). Modal은 dismissable={false}라 이것을 부르지 않는다. */
const stay = () => undefined;

/**
 * 정지 창(R5 B15): kit `Modal`(나무 창 한 벌, ui-rules-v4 §4.7)을 불투명 정지층 위에 띄운다. 문제·보기·해설은 이 층이 열린 동안
 * DOM에서 빠진다(PRD §3.6, §12.7). 수치 한계는 ‘계속’으로 풀 수 없어 나가기만 둔다.
 * 포커스: 첫 포커스 = 계속하기(막힘이면 처음 화면으로), Tab은 창 안에서만 돌고, 닫히면 연 단추로 돌아간다(Modal). Esc로는 닫히지 않는다.
 */
export function PauseOverlay(p: Props) {
  const first = useRef<HTMLButtonElement>(null);
  const quitRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const blocked = p.reasons.includes('NUMERIC_LIMIT');
  const main = blocked ? 'NUMERIC_LIMIT' : p.reasons[p.reasons.length - 1] ?? 'USER';

  // 연 단추로 돌려주기는 Modal이 한다. 연 단추가 사라졌으면(자동 정지 때 포커스가 있던 보기처럼 정지 동안 DOM에서 빠진 것)
  // Modal 정리와 화면 inert 해제가 끝난 다음 화면이 알려 준 곳으로 돌려준다.
  const restore = useRef(p.restoreFocus);
  useLayoutEffect(() => { restore.current = p.restoreFocus; });
  useEffect(() => () => queueMicrotask(() => {
    if (document.activeElement === document.body || !document.activeElement) restore.current?.();
  }), []);
  // 열린 채 막힘으로 바뀌면(끝내기 중 수치 한계) 누른 단추가 사라지므로 새 첫 단추로 옮긴다.
  useEffect(() => {
    first.current?.focus();
  }, [blocked]);

  // 이유 한 줄: 학생이 직접 멈추면 "잠시 멈췄어요."(옛 정지 창, pre-r4 10a), 그 밖에는 멈춘 까닭.
  const line = p.renderLost && !blocked ? RENDER_WAIT : PAUSE_COPY[main];

  return (
    <div className={css.cover}>
      <Modal titleId="pause-title" title={blocked ? '잠깐만요' : '일시정지'} size="sm" dismissable={false} onClose={stay}>
        <p className={css.line}>{line}</p>
        {blocked ? (
          <div className={css.stack}>
            <Button ref={first} variant="primary" size="lg" block onClick={p.onLeave}>처음 화면으로</Button>
          </div>
        ) : (
          <div className={css.stack}>
            <Button ref={first} variant="primary" size="lg" block aria-disabled={p.renderLost || undefined} onClick={() => { if (!p.renderLost) p.onResume(); }}>계속하기</Button>
            <div className={css.setting}>
              <span className={css.label} id="pause-font">글자 크기</span>
              <Segmented
                label="글자 크기"
                value={p.fontScale}
                onChange={p.onFont}
                options={[{ value: 'base', label: '보통' }, { value: 'large', label: '크게' }, { value: 'xlarge', label: '아주 크게' }]}
              />
            </div>
            <Toggle label="소리" checked={p.soundOn} onChange={p.onSound} className={css.toggle} />
            <div className={css.quitSlot}>
              {confirmQuit ? (
                <Card sunk pad="sm" className={css.confirm}>
                  <p>이번 판을 끝낼까요? 지금까지의 점수가 기록돼요.</p>
                  <div className={css.row}>
                    <Button variant="danger" onClick={p.onQuit}>끝내기</Button>
                    <Button
                      ref={cancelRef}
                      variant="secondary"
                      onClick={() => {
                        setConfirmQuit(false);
                        requestAnimationFrame(() => quitRef.current?.focus());
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </Card>
              ) : (
                <Button
                  ref={quitRef}
                  variant="ghost"
                  block
                  className={css.quit}
                  onClick={() => {
                    setConfirmQuit(true);
                    requestAnimationFrame(() => cancelRef.current?.focus());
                  }}
                >
                  이번 판 끝내기
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
