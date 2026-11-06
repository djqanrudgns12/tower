import { bankFileSchema, bankManifestSchema, sharedBankFileSchema, type BankFile, type BankManifest } from '../contracts/questions';

export type GradeLoadState = 'unavailable' | 'unloaded' | 'loading' | 'ready' | 'error';
export type BankLoader = () => Promise<unknown>;

/** 학년별 요청을 합치고 실패한 요청은 사용자가 다시 시도할 수 있게 비운다. */
export function createGradeLoader(rawManifest: BankManifest, loaders: Readonly<Record<number, BankLoader>>, fallbacks: Readonly<Record<number, BankLoader>> = {}) {
  const manifest = bankManifestSchema.parse(rawManifest);
  const entries = new Map(manifest.banks.map(bank => [bank.grade, bank]));
  const banks = new Map<number, BankFile>();
  const pending = new Map<number, Promise<BankFile | null>>();
  const states = new Map<number, GradeLoadState>();
  const listeners = new Set<() => void>();
  const available = (grade: number) => entries.has(grade) || grade in fallbacks;
  const notify = () => { for (const listener of listeners) listener(); };
  return {
    publishedGrades: manifest.banks.map(bank => bank.grade),
    available,
    peek: (grade: number): BankFile | null => banks.get(grade) ?? null,
    state: (grade: number): GradeLoadState => states.get(grade) ?? (available(grade) ? 'unloaded' : 'unavailable'),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load(grade: number): Promise<BankFile | null> {
      if (banks.has(grade)) return Promise.resolve(banks.get(grade)!);
      const running = pending.get(grade);
      if (running) return running;
      if (!available(grade)) return Promise.resolve(null);
      const entry = entries.get(grade);
      const promise = Promise.resolve().then(async () => {
        const loader = entry ? loaders[grade] : fallbacks[grade];
        if (!loader) throw new Error(`${grade}학년 문제 파일을 찾을 수 없다`);
        const raw = await loader();
        const bank = entry ? sharedBankFileSchema.parse(raw) : bankFileSchema.parse(raw);
        if (bank.grade !== grade || (entry ? bank.status !== 'published' : bank.status !== 'dev_fixture')) throw new Error('요청한 학년·공개 상태와 은행이 다르다');
        if (entry && (bank.bankId !== entry.bankId || bank.bankVersion !== entry.bankVersion
          || bank.questions.length !== entry.questionCount || bank.questions.filter(q => q.grade === grade).length !== entry.ownCount)) {
          throw new Error('문제 목록과 은행의 판 번호·문항 수가 다르다');
        }
        banks.set(grade, bank); states.set(grade, 'ready'); notify(); return bank;
      }).catch((error: unknown) => { states.set(grade, 'error'); notify(); throw error; }).finally(() => { pending.delete(grade); });
      pending.set(grade, promise); states.set(grade, 'loading'); notify();
      return promise;
    },
  };
}
