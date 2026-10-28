import type { GameContext } from '../domain/context';
import type { DomainEvent } from '../domain/events';
import { NumericLimitError } from '../domain/num';
import { advanceTick, applyCommand, replaceUnavailableQuestion, type Command, type CommandResult } from '../domain/run';
import type { PauseReason, RunState } from '../domain/types';
import { addRecord, clearSnapshot, writeSnapshot } from '../persistence/db';
import type { Ownership } from '../persistence/ownership';
import { selectView, viewKey, type ControllerView, type Notice } from './view';

export const TICK_MS = 1000 / 30;
const MAX_TICKS_PER_FRAME = 5;
const PERFORMANCE_PAUSE_MS = 250;
const PERIODIC_SAVE_TICKS = 60;
/** 학생이 ‘계속’으로 풀 수 있는 정지 이유. 저장 실패·소유권·숫자 한계는 원인이 풀려야 한다(PRD §12.7). */
export const USER_CLEARABLE: PauseReason[] = ['USER', 'HIDDEN', 'PERFORMANCE', 'RESTORED', 'CONTEXT_LOST'];

export type SaveStatus = ControllerView['saveStatus'];

/**
 * 도메인 상태의 유일한 작성자(PRD §14). 고정 30Hz 틱, 명령 순번, 저장 일정, 화면·렌더러 알림을 맡는다.
 * 화면(React)과 렌더러(Phaser)는 이 객체를 읽기만 하고 명령은 dispatch로만 보낸다.
 */
export class RunController {
  readonly ctx: GameContext;
  private s: RunState;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private key = '';
  private view: ControllerView;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(events: DomainEvent[]) => void>();
  private lastSavedTick = 0;
  private saveSeq: number;
  private saving: Promise<void> | null = null;
  private pendingSave: { strict: boolean } | null = null;
  private noticeSeq = 1;
  private hitches: number[] = [];
  /** 다음 논리 틱 시작에 반영할 답안·거래(PRD §3.4(2)). */
  private queue: Command[] = [];
  /** 대기 명령을 미리 적용해 본 사본. 화면이 거부 이유를 바로 받도록 하되 실제 상태는 틱 경계에서만 바꾼다. */
  private trial: RunState | null = null;
  private ownership: Ownership | null;
  saveStatus: SaveStatus;
  notices: Notice[] = [];
  readonly persist: boolean;

  constructor(ctx: GameContext, state: RunState, opts: { saveSeq: number; ownership: Ownership | null }) {
    this.ctx = ctx;
    this.s = state;
    this.saveSeq = opts.saveSeq;
    this.ownership = opts.ownership;
    this.persist = opts.ownership !== null;
    this.saveStatus = this.persist ? 'saved' : 'disabled';
    // 이어하기 사이에 철회된 미제출 문항은 시작 전에 바꾼다(PRD §9.5).
    replaceUnavailableQuestion(ctx, state);
    this.view = { ...selectView(ctx, state), notices: [], saveStatus: this.saveStatus };
    this.key = viewKey(state);
  }

  get state(): Readonly<RunState> { return this.s; }
  /** 렌더 보간용 0..1. */
  get alpha(): number { return Math.min(1, this.acc / TICK_MS); }

  // React useSyncExternalStore 연결.
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getView = () => this.view;
  onEvents(listener: (events: DomainEvent[]) => void) { this.eventListeners.add(listener); return () => { this.eventListeners.delete(listener); }; }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  dispose() {
    this.stop();
    this.listeners.clear();
    this.eventListeners.clear();
    this.ownership?.release();
    this.ownership = null;
  }

  /**
   * 같은 논리 틱 사이에 들어온 답안·거래는 모았다가 다음 틱 시작에 순번대로 반영한다. 정지는 바로 채택하고,
   * 그 틱에 모인 명령은 재개 뒤 자동 실행하지 않고 취소한다(PRD §3.4(1), §20.3). 루프가 돌지 않을 때는 바로 반영한다.
   */
  dispatch(cmd: Command): CommandResult {
    if (cmd.type === 'pause') this.cancelQueued();
    if (!this.running || cmd.type === 'pause' || cmd.type === 'resume' || cmd.type === 'quit') return this.apply(cmd);
    this.trial ??= structuredClone(this.s);
    let result: CommandResult;
    try {
      result = applyCommand(this.ctx, this.trial, cmd);
    } catch (error) {
      if (!(error instanceof NumericLimitError)) throw error;
      this.halt('NUMERIC_LIMIT');
      return { ok: false, error: 'NUMERIC_LIMIT' };
    }
    if (result.ok) this.queue.push(cmd);
    return result;
  }

  pause(reason: PauseReason) { this.dispatch({ type: 'pause', reason }); }

  /** ‘계속’ 버튼: 학생이 풀 수 있는 이유만 지운다. */
  resume() {
    for (const reason of USER_CLEARABLE) if (this.s.pause.includes(reason)) applyCommand(this.ctx, this.s, { type: 'resume', reason });
    this.acc = 0;
    this.last = performance.now();
    this.publish([]);
  }

  /** 저장 후 나가기. 밀린 저장까지 모두 끝나야 성공을 알린다(PRD §14.1). */
  async saveAndExit(): Promise<boolean> {
    if (!this.persist) return false;
    this.pause('USER');
    try {
      await this.flush(true);
      while (this.saving) await this.saving;
      return this.saveStatus === 'saved';
    } catch {
      return false;
    }
  }

  private apply(cmd: Command): CommandResult {
    let result: CommandResult;
    try {
      result = applyCommand(this.ctx, this.s, cmd);
    } catch (error) {
      // 명령은 원자적으로 반영되므로 던졌다면 상태는 그대로다. 학생 패배가 아니라 복구 정지로 바꾼다(PRD §8.6).
      if (!(error instanceof NumericLimitError)) throw error;
      this.halt('NUMERIC_LIMIT');
      return { ok: false, error: 'NUMERIC_LIMIT' };
    }
    if (!result.ok) return result;
    if (cmd.type === 'pause' || cmd.type === 'resume') this.acc = 0;
    this.publish(result.events);
    if (cmd.type !== 'resume') this.save(false);
    if (cmd.type === 'quit') void this.finish();
    return result;
  }

  private cancelQueued() {
    this.queue = [];
    this.trial = null;
  }

  private applyQueued() {
    const queue = this.queue;
    this.cancelQueued();
    for (const cmd of queue) this.apply(cmd);
  }

  /** 원인이 풀려야 하는 정지(저장 실패·수치 한계). 같은 틱의 명령을 취소하고, 이 상태를 저장하지 않는다. */
  private halt(reason: PauseReason) {
    this.cancelQueued();
    applyCommand(this.ctx, this.s, { type: 'pause', reason });
    this.publish([]);
  }

  async retrySave(): Promise<void> {
    await this.flush(false);
    if (this.saveStatus === 'saved') applyCommand(this.ctx, this.s, { type: 'resume', reason: 'STORAGE' });
    this.publish([]);
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = now - this.last;
    this.last = now;
    if (this.s.pause.length > 0 || this.s.phase === 'GAME_OVER') { this.acc = 0; return; }
    // 한 번의 긴 끊김(텍스처 생성·GC·탭 전환 직후)은 따라잡지 않고 그 시간을 버린다. 게임 안에서는 세상이 멈춘 것과 같고
    // 결과(틱별 판정)는 바뀌지 않는다. 5초 안에 세 번 반복되면 기기가 따라오지 못하는 것으로 보고 정지한다(PRD §13.3, §14).
    if (dt > PERFORMANCE_PAUSE_MS) {
      this.acc = 0;
      this.hitches = this.hitches.filter(t => now - t < 5000);
      this.hitches.push(now);
      if (this.hitches.length >= 3) { this.hitches = []; this.pause('PERFORMANCE'); }
      return;
    }
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
      this.acc -= TICK_MS;
      n++;
      if (!this.step()) return;
    }
    // 처리할 틱을 버려 게임 속도를 기기마다 다르게 만들지 않는다. 밀리면 정지시키고 수동 재개를 받는다(PRD §13.3).
    if (this.acc > PERFORMANCE_PAUSE_MS) { this.acc = 0; this.pause('PERFORMANCE'); }
  };

  private step(): boolean {
    this.applyQueued();
    if (this.s.pause.length > 0 || this.s.phase === 'GAME_OVER') return false;
    let events: DomainEvent[];
    try {
      events = advanceTick(this.ctx, this.s);
    } catch (error) {
      if (error instanceof NumericLimitError) {
        this.halt('NUMERIC_LIMIT');
        return false;
      }
      throw error;
    }
    const important = events.some(e => e.type === 'phase' || e.type === 'waveComplete' || e.type === 'answered');
    this.publish(events);
    if (events.some(e => e.type === 'gameOver')) { void this.finish(); return false; }
    if (important || (this.s.phase === 'BATTLE' && this.s.tick - this.lastSavedTick >= PERIODIC_SAVE_TICKS)) this.save(false);
    return true;
  }

  private publish(events: DomainEvent[]) {
    for (const e of events) {
      if (e.type === 'waveComplete') this.notify(e.milestoneGold > 0 ? `${e.wave}웨이브 생존 +${e.milestoneGold}골드` : `${e.wave}웨이브를 지켰어요. 성문이 다시 튼튼해졌어요.`, e.milestoneGold > 0 ? 'reward' : 'info');
      if (e.type === 'burning') this.notify(`버닝: 타워가 더 빨리 공격해요 · ${this.ctx.balance.burning.durationMs / 1000}초`, 'reward');
      if (e.type === 'phase' && e.phase === 'BATTLE' && this.s.wave % this.ctx.balance.waves.bossEveryWaves === 0) this.notify(`${this.s.wave}웨이브 고비: 강한 적이 와요`, 'warn');
    }
    if (events.length) for (const l of this.eventListeners) l(events);
    const key = viewKey(this.s);
    if (key !== this.key || events.length === 0) {
      this.key = key;
      this.refresh();
    }
  }

  private refresh() {
    this.view = { ...selectView(this.ctx, this.s), notices: this.notices, saveStatus: this.saveStatus };
    for (const l of this.listeners) l();
  }

  private notify(text: string, tone: Notice['tone']) {
    const notice = { id: this.noticeSeq++, text, tone };
    this.notices = [...this.notices.slice(-1), notice];
    this.view = { ...this.view, notices: this.notices };
    queueMicrotask(() => { for (const l of this.listeners) l(); });
    // 알림은 입력을 막지 않고 짧게 보인다(PRD §4.6: 1.2초).
    setTimeout(() => {
      this.notices = this.notices.filter(n => n.id !== notice.id);
      this.view = { ...this.view, notices: this.notices };
      for (const l of this.listeners) l();
    }, tone === 'info' ? 1800 : 1200);
  }

  private save(strict: boolean) {
    if (!this.persist || this.s.phase === 'GAME_OVER') return;
    this.lastSavedTick = this.s.tick;
    void this.flush(strict).catch(() => undefined);
  }

  /** 쓰기는 하나씩만. 밀린 요청은 최신 상태 하나로 합친다. */
  private async flush(strict: boolean): Promise<void> {
    if (!this.persist) return;
    if (this.saving) {
      this.pendingSave = { strict: strict || (this.pendingSave?.strict ?? false) };
      await this.saving;
      return;
    }
    this.saveStatus = 'saving';
    const snapshot = structuredClone(this.s);
    this.saving = writeSnapshot(snapshot, ++this.saveSeq, strict)
      .then(() => { this.saveStatus = 'saved'; if (this.view.saveStatus !== 'saved') this.refresh(); })
      .catch(() => {
        this.saveStatus = 'error';
        // 메모리 최신 상태를 보존한 채 정지하고 같은 상태의 재저장을 제공한다(PRD §14.1).
        this.halt('STORAGE');
      })
      .finally(() => { this.saving = null; });
    await this.saving;
    const pending = this.pendingSave;
    this.pendingSave = null;
    if (pending) await this.flush(pending.strict);
  }

  private async finish() {
    this.stop();
    if (!this.persist) return;
    const s = this.s;
    try {
      await addRecord({
        runId: s.config.runId, nickname: s.config.nickname, grade: s.config.grade, difficulty: s.config.difficulty, mapId: s.config.mapId,
        pt: s.pt, completedWave: s.completedWave, endedAtWave: s.endedAtWave ?? s.wave, correct: s.stats.correct, wrong: s.stats.wrong, skipped: s.stats.skipped,
        endedAt: new Date().toISOString(), endReason: s.endReason ?? 'QUIT', contentMode: s.config.contentMode, balanceVersion: s.config.balanceVersion, bankVersion: s.config.bankVersion,
      });
      await clearSnapshot();
    } catch {
      this.saveStatus = 'error';
    }
    this.publish([]);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden' && this.s.phase !== 'GAME_OVER') {
      this.pause('HIDDEN');
      void this.flush(true).catch(() => undefined);
    } else {
      this.last = performance.now();
      this.acc = 0;
    }
  };

  private onPageHide = () => { if (this.s.phase !== 'GAME_OVER') this.pause('HIDDEN'); };
}
