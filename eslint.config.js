import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

// 계층 경계: domain은 화면·렌더러·저장소를 모르고, game은 보상·점수를 판정하지 않는다(PRD §13.2).
const forbid = (...patterns) => ['error', { patterns: patterns.map(group => ({ group, message: 'PRD §13.2 모듈 경계를 지킨다.' })) }];

export default defineConfig(
  // asset-source·content-source는 작업자가 납품한 원본과 그 재현 도구다. 제품 코드가 아니어서 검사 대상에서 뺀다.
  { ignores: ['dist', 'node_modules', 'docs/archive', 'playwright-report', 'test-results', '.vitest', 'asset-source', 'content-source'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': ['error', { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: '판정에는 시드 PRNG만 쓴다(PRD §13.3).' }],
    },
  },
  { files: ['src/domain/**'], rules: { 'no-restricted-imports': forbid(['react', 'react-dom', 'phaser', 'idb', '**/ui/**', '**/game/**', '**/persistence/**', '**/application/**']) } },
  { files: ['src/content/**', 'src/contracts/**'], rules: { 'no-restricted-imports': forbid(['react', 'react-dom', 'phaser', 'idb', '**/ui/**', '**/game/**', '**/persistence/**']) } },
  { files: ['src/game/**'], rules: { 'no-restricted-imports': forbid(['react-dom', 'idb', '**/persistence/**', '**/domain/run', '**/domain/combat']) } },
  { files: ['src/ui/**'], rules: { 'no-restricted-imports': forbid(['phaser', 'idb', '**/persistence/**', '**/domain/combat']) } },
  { files: ['tools/**/*.{js,mjs}', '*.config.{js,ts}'], languageOptions: { globals: globals.node } },
);
