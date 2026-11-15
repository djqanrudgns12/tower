export const REPO_ROOT: string;
export const REGISTRY_FILES: string[];
export const MARKER_TARGET_FILES: string[];

export function replaceAutoBlocks(
  markdown: string,
  blocksMap: Record<string, string>,
): {
  content: string;
  changed: boolean;
  foundIds: string[];
};

export function computeGeneratedArtifacts(root?: string): {
  files: Map<string, string>;
};

export function generateAll(
  root?: string,
  options?: { checkOnly?: boolean; skipRelSet?: Set<string> | null },
): {
  changed: string[];
  skipped: string[];
};

export interface WikiLintIssue {
  code: string;
  file: string;
  msg: string;
}

export function runLint(
  root?: string,
  options?: { strict?: boolean },
): {
  ok: boolean;
  errors: WikiLintIssue[];
  warnings: WikiLintIssue[];
  checkedWikiPages: number;
};

export function runQuery(
  argv: string[],
  root?: string,
): {
  code: number;
  output: string;
};

export interface LayerBudgetSummary {
  count: number;
  chars: number;
  tokens: number;
}

export function measureBudget(root?: string): {
  hot: LayerBudgetSummary;
  warm: LayerBudgetSummary;
  cold: LayerBudgetSummary;
  typicalStartChars: number;
  typicalStartTokens: number;
  savingsPercent: number;
};

export function createLessonDelta(
  flags: Record<string, string | boolean>,
  root?: string,
): {
  relPath: string;
  kind: string;
  similarIds?: string[];
};

export function reportCurateStatus(root?: string): {
  pending: string[];
  totalLessons: number;
  promoteCandidates: Array<{ id: string }>;
  noisyLessons: Array<{ id: string }>;
};

export function applyDelta(
  flags: Record<string, string | boolean>,
  root?: string,
): {
  action: string;
  id?: string;
  ledger?: string;
  moved: string;
  reason?: string;
};
