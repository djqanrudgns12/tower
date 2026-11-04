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
  /** 이 판을 저장할 수 있다(연습 판·저장 불가 브라우저는 false). */
  canSave: boolean;
  fontScale: FontScale;
  soundOn: boolean;
  /** 마지막 저장이 실패했다. */
  saveError: boolean;
  onResume(): void;
  onFont(scale: FontScale): void;
  onSound(on: boolean): void;
  /** 저장이 끝나야 true. 실패하면 false이고 화면을 떠나지 않는다(PRD §12.7, §14.1). */
  onSaveExit(): Promise<boolean>;
  /** 같은 상태를 다시 저장한다. 성공하면 true. */
  onRetrySave(): Promise<boolean>;
  onQuit(): void;
  onLeaveUnsaved(): void;
  /** 연 단추를 찾지 못했을 때(정지 층이 열리며 화면이 비활성화돼 포커스가 풀린 경우) 돌아갈 곳. */
  restoreFocus?(): void;
}

type Mode = 'storage' | 'blocked' | 'normal';

/** 불투명 정지층. 문제·보기·해설은 이 층이 열린 동안 DOM에서 빠진다(PRD §3.6, §12.7). */
export function PauseOverlay(p: Props) {
  const first = useRef<HTMLButtonElement>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const blocked = p.reasons.includes('STORAGE') || p.reasons.includes('OWNERSHIP') || p.reasons.includes('NUMERIC_LIMIT');
  const main = blocked ? p.reasons.find(r => r === 'STORAGE' || r === 'OWNERSHIP' || r === 'NUMERIC_LIMIT')! : p.reasons[p.reasons.length - 1] ?? 'USER';
  const mode: Mode = p.reasons.includes('STORAGE') ? 'storage' : blocked ? 'blocked' : 'normal';

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
  // 저장 실패처럼 열린 채 내용이 바뀌면 누른 단추가 사라지므로 새 첫 단추로 옮긴다.
  useEffect(() => {
    first.current?.focus();
  }, [mode]);

  const saveExit = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await p.onSaveExit().catch(() => false);
    setBusy(false);
    if (!ok) setFailed(true);
  };
  const retry = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await p.onRetrySave().catch(() => false);
    setBusy(false);
    if (!ok) setFailed(true);
  };

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
        {mode === 'storage' ? (
          <div className={css.stack}>
            <Button ref={first} variant="primary" size="lg" block disabled={busy} aria-busy={busy} onClick={retry}>
              {busy ? '저장하는 중…' : '다시 저장하기'}
            </Button>
            {failed && <p className={css.reason} role="status">아직 저장되지 않았어요. 잠시 뒤 다시 눌러 주세요.</p>}
            <Button variant="secondary" block disabled={busy} onClick={p.onLeaveUnsaved}>저장하지 않고 나가기</Button>
            <p className={css.muted}>마지막으로 저장된 곳까지만 이어할 수 있어요.</p>
          </div>
        ) : mode === 'blocked' ? (
          <div className={css.stack}>
            <Button ref={first} variant="primary" size="lg" block onClick={p.onLeaveUnsaved}>처음 화면으로</Button>
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
            {p.canSave && (
              <Button variant="secondary" block disabled={busy} aria-busy={busy} onClick={saveExit}>
                {busy ? '저장하는 중…' : '저장하고 나가기'}
              </Button>
            )}
            {(failed || p.saveError) && <p className={css.reason} role="status">아직 저장되지 않았어요. 다시 눌러 주세요.</p>}
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
