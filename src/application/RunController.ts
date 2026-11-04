import type { GameContext } from '../domain/context';
import type { DomainEvent } from '../domain/events';
import { NumericLimitError } from '../domain/num';
import { advanceTick, applyCommand, replaceUnavailableQuestion, type Command, type CommandResult } from '../domain/run';
import type { PauseReason, RunState } from '../domain/types';
import { addRecord, clearSnapshot, writeSnapshot } from '../persistence/db';
import { queueAndFlushCompletedRun } from '../persistence/lobbyClient';
import type { Ownership } from '../persistence/ownership';
import { recordFinishedRun, type ReviewDelta } from '../persistence/reviewNote';
import { buildRunRecord } from './runRecord';
import { selectView, viewKey, type ControllerView, type Notice } from './view';

export const TICK_MS = 1000 / 30;
const MAX_TICKS_PER_FRAME = 5;
const PERFORMANCE_PAUSE_MS = 250;
/** 전투 중 주기 저장 간격(PRD §14.1: 2초 = 60틱). */
export const PERIODIC_SAVE_TICKS = 60;
/** 학생이 ‘계속’으로 풀 수 있는 정지 이유. 저장 실패·소유권·숫자 한계는 원인이 풀려야 한다(PRD §12.7). */
export const USER_CLEARABLE: PauseReason[] = ['USER', 'HIDDEN', 'PERFORMANCE', 'RESTORED', 'CONTEXT_LOST'];

export type SaveStatus = ControllerView['saveStatus'];

export interface RunControllerOptions {
  /** 마지막으로 완료된 스냅샷 순번. 새 판은 0, 이어하기는 불러온 슬롯의 순번. */
  saveSeq?: number;
  /** Web Locks 소유권. 있어야 스냅샷을 쓴다(한 판은 한 탭만, PRD §14). */
  ownership: Ownership | null;
  /** 끝난 판을 개인 기록·공개 제출 큐에 남길지. 연습 판은 false. 기본은 소유권이 있을 때. */
  recordOnFinish?: boolean;
  /** 소유권이 있어도 저장소를 쓸 수 없으면 false로 자동 저장을 끈다(§16.2 브라우저 저장 차단). */
  autosave?: boolean;
}

/**
 * 도메인 상태의 유일한 작성자(PRD §14). 고정 30Hz 틱, 명령 순번, 저장 일정, 종료 기록, 화면·렌더러 알림을 맡는다.
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
  /** 진행 중인 쓰기 묶음. 쓰기는 하나씩만 하고, 그동안 들어온 요청은 dirty로 합쳐 최신 상태 하나로 쓴다(§14.1). */
  private saving: Promise<void> | null = null;
  private dirty = false;
  private strictPending = false;
  private finished = false;
  /** 끝난 판이 오답 노트에 담고 졸업시킨 낱말 수. 결과 화면이 읽는다. 끝나기 전·연습 판은 null. */
  private reviewDelta: ReviewDelta | null = null;
  private noticeSeq = 1;
  private hitches: number[] = [];
  /** 다음 논리 틱 시작에 반영할 답안·거래(PRD §3.4(2)). */
  private queue: Command[] = [];
  /** 대기 명령을 미리 적용해 본 사본. 화면이 거부 이유를 바로 받도록 하되 실제 상태는 틱 경계에서만 바꾼다. */
  private trial: RunState | null = null;
  private ownership: Ownership | null;
  private renderLost = false;
  private readonly recordOnFinish: boolean;
  saveStatus: SaveStatus;
  notices: Notice[] = [];
  /** 이 판을 스냅샷으로 저장하는지(저장 후 나가기·이어하기 가능 여부). */
  readonly persist: boolean;

  constructor(ctx: GameContext, state: RunState, opts: RunControllerOptions) {
    this.ctx = ctx;
    this.s = state;
    this.saveSeq = opts.saveSeq ?? 0;
    this.ownership = opts.ownership;
    this.persist = opts.ownership !== null && (opts.autosave ?? true);
    this.recordOnFinish = opts.recordOnFinish ?? (opts.ownership !== null);
    this.saveStatus = this.persist ? 'saved' : 'disabled';
    // 이어하기 사이에 철회된 미제출 문항은 시작 전에 바꾼다(PRD §9.5).
    replaceUnavailableQuestion(ctx, state);
    this.view = { ...selectView(ctx, state), notices: [], saveStatus: this.saveStatus, renderLost: false, reviewDelta: null };
    this.key = viewKey(state);
  }

  get state(): Readonly<RunState> { return this.s; }
  /** 렌더 보간용 0..1. */
  get alpha(): number { return Math.min(1, this.acc / TICK_MS); }
  /** 마지막으로 완료된 스냅샷 순번. */
  get savedSeq(): number { return this.saveSeq; }

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

  /** 화면을 떠날 때. 진행 중인 쓰기가 끝난 뒤 소유권을 놓아, 다음 판의 저장과 섞이지 않게 한다. */
  dispose() {
    this.stop();
    this.finished = true;
    this.listeners.clear();
    this.eventListeners.clear();
    const ownership = this.ownership;
    this.ownership = null;
    if (ownership) void this.settle().finally(() => ownership.release());
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

  /** ‘계속’ 버튼: 학생이 풀 수 있는 이유만 지운다. 화면이 아직 돌아오지 않았으면 CONTEXT_LOST는 남긴다. */
  resume() {
    for (const reason of USER_CLEARABLE) {
      if (reason === 'CONTEXT_LOST' && this.renderLost) continue;
      if (this.s.pause.includes(reason)) applyCommand(this.ctx, this.s, { type: 'resume', reason });
    }
    this.acc = 0;
    this.last = performance.now();
    this.publish([]);
  }

  /**
   * WebGL 문맥 손실(PRD §12.7 CONTEXT_LOST). 보이지 않는 전장에서 전투가 흐르지 않게 정지한다.
   * 렌더러가 자원을 되살리면 정지는 그대로 두고 학생이 ‘계속’을 누른다(§14 수동 재개).
   */
  rendererLost() {
    this.renderLost = true;
    this.pause('CONTEXT_LOST');
    this.refresh();
  }

  rendererRestored() {
    this.renderLost = false;
    this.refresh();
  }

  /**
   * 저장 후 나가기. 정지한 뒤 밀린 저장까지 모두 끝나야 성공을 알린다(PRD §14.1, §12.7).
   * 저장이 실패하면 false이고 STORAGE 정지로 바뀌어 재시도·미저장 종료를 고르게 한다.
   */
  async saveAndExit(): Promise<boolean> {
    if (!this.persist || this.finished || this.s.phase === 'GAME_OVER') return false;
    if (this.s.pause.includes('STORAGE')) return false;
    this.pause('USER');
    await this.requestSave(true);
    return this.saveStatus === 'saved' && !this.s.pause.includes('STORAGE');
  }

  /**
   * 저장 실패 정지에서 ‘다시 저장하기’. 메모리의 최신 상태를 같은 순번으로 다시 쓴다. 채점·골드·회복은 다시 실행하지 않는다.
   * 저장이 돌아와도 바로 흐르지 않고 학생이 ‘계속’을 눌러 다시 시작한다(§14 수동 재개).
   */
  async retrySave(): Promise<boolean> {
    if (!this.persist || this.finished) return false;
    await this.requestSave(true, true);
    if (this.saveStatus !== 'saved' || !this.s.pause.includes('STORAGE')) return this.saveStatus === 'saved';
    applyCommand(this.ctx, this.s, { type: 'pause', reason: 'USER' });
    applyCommand(this.ctx, this.s, { type: 'resume', reason: 'STORAGE' });
    this.publish([]);
    return true;
  }

  /** 진행 중인 쓰기(합쳐진 요청 포함)가 모두 끝날 때까지 기다린다. */
  async settle(): Promise<void> {
    while (this.saving) await this.saving;
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
    // 채점·거래·전투 시작·정지 직후 저장한다(§14.1). 재개는 상태를 바꾸지 않으므로 쓰지 않는다.
    if (cmd.type !== 'resume') void this.requestSave(false);
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

  /** 원인이 풀려야 하는 정지(저장 실패·수치 한계). 같은 틱의 명령을 취소하고, 이 정지 자체는 저장하지 않는다. */
  private halt(reason: PauseReason) {
    this.cancelQueued();
    applyCommand(this.ctx, this.s, { type: 'pause', reason });
    this.publish([]);
  }

  /**
   * 저장 요청. 쓰기 중이면 dirty만 세워 두고, 지금 쓰기가 끝나면 그때의 최신 상태 하나만 더 쓴다.
   * STORAGE 정지 중에는 자동 저장을 멈추고, ‘다시 저장하기’(force)만 쓴다.
   */
  private requestSave(strict: boolean, force = false): Promise<void> {
    const idle = this.saving ?? Promise.resolve();
    if (!this.persist || this.finished || this.s.phase === 'GAME_OVER') return idle;
    if (!force && this.s.pause.includes('STORAGE')) return idle;
    this.lastSavedTick = this.s.tick;
    this.dirty = true;
    this.strictPending ||= strict;
    this.saving ??= this.drain();
    return this.saving;
  }

  private async drain(): Promise<void> {
    try {
      // 같은 동기 구간의 요청을 하나로 모은다. 또 this.saving이 먼저 정해진 뒤에 finally가 돌게 한다.
      await Promise.resolve();
      while (this.dirty && !this.finished && this.s.phase !== 'GAME_OVER') {
        const strict = this.strictPending;
        this.dirty = false;
        this.strictPending = false;
        // 실패하면 순번을 올리지 않는다. 재시도는 같은 순번으로 같은 슬롯에 쓴다(§14.1 같은 순번 재시도).
        const seq = this.saveSeq + 1;
        const snapshot = structuredClone(this.s);
        this.saveStatus = 'saving';
        try {
          await writeSnapshot(snapshot, seq, strict);
        } catch {
          this.dirty = false;
          this.strictPending = false;
          this.saveStatus = 'error';
          // 메모리 최신 상태를 보존한 채 정지하고 같은 상태의 재저장을 제공한다(PRD §14.1, §16.2).
          this.halt('STORAGE');
          return;
        }
        this.saveSeq = seq;
        this.saveStatus = 'saved';
        if (this.view.saveStatus !== 'saved') this.refresh();
      }
    } finally {
      this.saving = null;
    }
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
    // 웨이브 전이·채점(자동 진행)은 바로, 전투 중에는 60틱마다 저장한다(§14.1).
    const important = events.some(e => e.type === 'phase' || e.type === 'waveComplete' || e.type === 'answered');
    this.publish(events);
    if (events.some(e => e.type === 'gameOver')) { void this.finish(); return false; }
    if (important || (this.s.phase === 'BATTLE' && this.s.tick - this.lastSavedTick >= PERIODIC_SAVE_TICKS)) void this.requestSave(false);
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
    this.view = { ...selectView(this.ctx, this.s), notices: this.notices, saveStatus: this.saveStatus, renderLost: this.renderLost, reviewDelta: this.reviewDelta };
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

  /**
   * 끝난 판: 진행 중인 스냅샷 쓰기를 기다린 뒤 개인 기록 → 스냅샷 비우기 → 공개 제출 큐 순서로 남긴다.
   * 기록을 먼저 써야 스냅샷을 지워도 결과가 사라지지 않고, 늦게 끝난 쓰기가 끝난 판을 되살리지 않는다.
   */
  private async finish() {
    this.stop();
    this.finished = true;
    if (!this.recordOnFinish) return;
    await this.settle();
    const s = this.s;
    // 틀린 낱말을 오답 노트에 담는다(prd-r4 §6.1). 연습 판은 위에서 빠졌고, 저장하고 나가기는 finish를 거치지 않아 담지 않는다.
    // 동기 localStorage 쓰기라 기록 저장보다 먼저 해도 화면 전환을 막지 않고, 저장소가 막혀도 던지지 않는다.
    this.reviewDelta = recordFinishedRun(s.quiz.history, s.config.bankId, this.ctx.questions);
    const record = buildRunRecord(s);
    try {
      await addRecord(record);
      await clearSnapshot();
      void queueAndFlushCompletedRun(record, s.config.playerId).catch(() => undefined);
    } catch {
      this.saveStatus = 'error';
    }
    this.publish([]);
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden' && this.s.phase !== 'GAME_OVER') {
      this.pause('HIDDEN');
      void this.requestSave(true);
    } else {
      this.last = performance.now();
      this.acc = 0;
    }
  };

  private onPageHide = () => {
    if (this.s.phase === 'GAME_OVER') return;
    this.pause('HIDDEN');
    void this.requestSave(true);
  };
}
