import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PauseReason } from '../../domain/types';
import type { FontScale } from '../../application/session';
import { PAUSE_COPY, RENDER_WAIT } from '../copy';
import { Button, Card, Segmented, Toggle } from '../kit';
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

/** 불투명 정지층. 문제·보기·해설은 이 층이 열린 동안 DOM에서 빠진다(PRD §3.6, §12.7). 수치 한계는 ‘계속’으로 풀 수 없어 나가기만 둔다. */
export function PauseOverlay(p: Props) {
  const first = useRef<HTMLButtonElement>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const blocked = p.reasons.includes('NUMERIC_LIMIT');
  const main = blocked ? 'NUMERIC_LIMIT' : p.reasons[p.reasons.length - 1] ?? 'USER';

  // 열 때 한 번만 첫 단추에 포커스를 주고, 닫으면 연 곳으로 돌려준다. 이유·글자 크기가 바뀌어도 다시 돌지 않는다.
  const box = useRef<HTMLDivElement>(null);
  const restore = useRef(p.restoreFocus);
  useLayoutEffect(() => { restore.current = p.restoreFocus; });
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    first.current?.focus();
    // 닫힐 때 정지 층이 먼저 빠지고 화면의 inert가 그 뒤에 풀리므로, 커밋이 끝난 다음 돌려준다.
    return () => queueMicrotask(() => {
      if (previous?.isConnected && previous !== document.body) previous.focus();
      if (document.activeElement === document.body || !document.activeElement) restore.current?.();
    });
  }, []);
  // 열린 채 막힘으로 바뀌면(끝내기 중 수치 한계) 누른 단추가 사라지므로 새 첫 단추로 옮긴다.
  useEffect(() => {
    first.current?.focus();
  }, [blocked]);

  /** Tab은 정지 카드 안에서만 돈다. */
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? [])];
    if (items.length === 0) return;
    const head = items[0]!, tail = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
    else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
  };

  // 학생이 직접 멈춘 경우 제목이 곧 설명이라 한 줄을 더 쓰지 않는다(ui-rules-v3 문장 규칙).
  const line = p.renderLost && !blocked ? RENDER_WAIT : main === 'USER' ? null : PAUSE_COPY[main];

  return (
    <div ref={box} className={css.layer} role="dialog" aria-modal="true" aria-labelledby="pause-title" onKeyDown={trap}>
      <Card float className={css.box}>
        <h2 id="pause-title" className={css.title}>{blocked ? '잠깐만요' : '일시정지'}</h2>
        {line && <p className={css.line}>{line}</p>}
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
            {confirmQuit ? (
              <Card sunk pad="sm" className={css.confirm}>
                <p>이번 판을 끝낼까요? 지금까지의 점수가 기록돼요.</p>
                <div className={css.row}>
                  <Button variant="danger" onClick={p.onQuit}>끝내기</Button>
                  <Button variant="secondary" onClick={() => setConfirmQuit(false)}>취소</Button>
                </div>
              </Card>
            ) : (
              <Button variant="ghost" block className={css.quit} onClick={() => setConfirmQuit(true)}>이번 판 끝내기</Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
