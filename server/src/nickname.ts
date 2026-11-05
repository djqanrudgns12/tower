import { countGraphemes } from './graphemes';

const encoder = new TextEncoder();
const utf8Length = (text: string) => encoder.encode(text).length;

// Postgres btrim 두 번째 인자와 같은 공백 목록.
const TRIM = '                  　﻿';
const TRIM_EDGES = new RegExp(`^[${TRIM}]+|[${TRIM}]+$`, 'g');
// Postgres는 U+0001~001F·007F~009F를 지운다. NUL은 Postgres 글에 들어올 수 없었으므로 함께 지운다(앱 계약 \p{Cc}와 같다).
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u001F\u007F-\u009F]/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Postgres clean_public_nickname을 옮긴 서버 판정. 통과하면 정규화한 별명을, 아니면 null을 돌려준다.
 * NFC → NFKC, 제어 문자 제거, 공백 다듬기, 4096바이트, 사용자 인식 문자 2~12자, 전화번호·긴 숫자·이메일·주소 차단.
 */
export function cleanServerNickname(raw: unknown): string | null {
  // 짝 없는 대리 문자는 Postgres JSON에서 거부되던 입력이다.
  if (typeof raw !== 'string' || LONE_SURROGATE.test(raw) || utf8Length(raw) > 4096) return null;
  const value = raw.normalize('NFC').normalize('NFKC').replace(CONTROLS, '').replace(TRIM_EDGES, '');
  if (utf8Length(value) > 4096) return null;
  const graphemes = countGraphemes(value);
  if (graphemes < 2 || graphemes > 12) return null;
  if (/[0-9]{6,}/.test(value)) return null;
  if (/0[0-9]{1,2}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4}/.test(value)) return null;
  if (/(@|https?:\/\/|www\.|[^\s@/]+\.[a-z]{2,}(\/|$))/i.test(value)) return null;
  return value;
}
