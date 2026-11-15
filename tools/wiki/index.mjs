export { REPO_ROOT } from './lib/fsutil.mjs';
export { replaceAutoBlocks } from './lib/markdown.mjs';
export {
  MARKER_TARGET_FILES,
  REGISTRY_FILES,
  computeGeneratedArtifacts,
  generateAll,
} from './gen.mjs';
export { runLint } from './lint.mjs';
export { runQuery } from './query.mjs';
export { measureBudget } from './budget.mjs';
export { createLessonDelta } from './delta.mjs';
export { applyDelta, reportCurateStatus } from './curate.mjs';
