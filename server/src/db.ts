/**
 * 저장소 접근 층. 서버 코드는 이 인터페이스만 쓴다.
 * 지금은 Cloudflare D1 어댑터 하나뿐이다. 비상 대체(맥미니 Node 24)에서는 같은 SQL을 `node:sqlite`로
 * 실행하는 어댑터 하나(BEGIN/COMMIT 안에서 문장을 차례로 실행하고 행을 돌려주는 30줄 안팎)를 더하면 된다.
 */
export type SqlValue = string | number | null;
export type SqlRow = Record<string, SqlValue>;

export interface SqlStatement {
  readonly sql: string;
  readonly params: readonly SqlValue[];
}

export interface SqlDatabase {
  /** 문장을 차례로 한 트랜잭션 안에서 실행한다. 하나라도 실패하면 전부 되돌리고 오류를 던진다. 문장마다 결과 행을 돌려준다. */
  batch(statements: readonly SqlStatement[]): Promise<SqlRow[][]>;
}

export const sql = (text: string, ...params: SqlValue[]): SqlStatement => ({ sql: text, params });

/** 시험에서 요청당 D1 읽기·쓰기 행 수를 재려고 쓴다. */
export interface SqlStats {
  batches: number;
  statements: number;
  rowsRead: number;
  rowsWritten: number;
}

// Cloudflare 타입 패키지 없이 쓰려고 필요한 모양만 적는다.
export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
}
export interface D1ResultLike {
  results?: unknown[];
  meta?: { rows_read?: number; rows_written?: number };
}
export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<D1ResultLike[]>;
}

export function d1Database(db: D1DatabaseLike, stats?: SqlStats): SqlDatabase {
  return {
    async batch(statements) {
      if (statements.length === 0) return [];
      const results = await db.batch(statements.map(s => db.prepare(s.sql).bind(...s.params)));
      if (stats) {
        stats.batches += 1;
        stats.statements += statements.length;
        for (const r of results) {
          stats.rowsRead += r.meta?.rows_read ?? 0;
          stats.rowsWritten += r.meta?.rows_written ?? 0;
        }
      }
      return results.map(r => (r.results ?? []) as SqlRow[]);
    },
  };
}

/** SQLite 제약 위반 문구로 오류 종류를 가린다(D1·node:sqlite 모두 같은 문구를 쓴다). */
export function isConstraintError(error: unknown, fragment: string): boolean {
  return error instanceof Error && error.message.includes(fragment);
}
