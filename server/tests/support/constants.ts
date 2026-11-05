import { fileURLToPath } from 'node:url';

export const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));
export const REPO_DIR = fileURLToPath(new URL('../../..', import.meta.url));
/** 시험 전용 가짜 소금값(실제 값 아님). */
export const TEST_SALT = 'test-only-fake-salt-for-local-d1-0123456789abcdef';
export const TEST_ORIGIN = 'http://localhost:5173';
