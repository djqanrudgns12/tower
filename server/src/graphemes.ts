/**
 * 사용자 인식 문자 수(UAX #29, Unicode 17.0). Postgres nickname_grapheme_count를 그대로 옮겼다.
 * 런타임 Intl.Segmenter의 유니코드 판이 배포마다 달라질 수 있어, 서버 판정은 고정 속성표로 한다.
 * 속성표 출처: ./unicode/grapheme-properties.v17.json(Unicode License V3, ./unicode/LICENSE.txt).
 */
import properties from './unicode/grapheme-properties.v17.json';

type Range = readonly [number, number];
type RangeName = keyof typeof properties.ranges;

function table(name: RangeName): readonly Range[] {
  return (properties.ranges[name] as unknown as number[][]).map(([start, end]) => [start!, end!] as const);
}

/** 반열린 구간 [start, end) 목록에서 이분 탐색. */
function inRanges(ranges: readonly Range[], cp: number): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end] = ranges[mid]!;
    if (cp < start) hi = mid - 1;
    else if (cp >= end) lo = mid + 1;
    else return true;
  }
  return false;
}

const CR = table('CR');
const LF = table('LF');
const CONTROL = table('Control');
const L = table('L');
const V = table('V');
const T = table('T');
const EXTEND = table('Extend');
const ZWJ = table('ZWJ');
const RI = table('Regional_Indicator');
const PREPEND = table('Prepend');
const SPACING_MARK = table('SpacingMark');
const EXT_PICT = table('Extended_Pictographic');
const INCB_LINKER = table('InCB_Linker');
const INCB_CONSONANT = table('InCB_Consonant');
const INCB_EXTEND = table('InCB_Extend');

type Prop = 'CR' | 'LF' | 'Control' | 'L' | 'V' | 'T' | 'LV' | 'LVT' | 'Extend' | 'ZWJ' | 'RI' | 'Prepend' | 'SpacingMark' | 'Other';

function propertyOf(cp: number): Prop {
  if (inRanges(CR, cp)) return 'CR';
  if (inRanges(LF, cp)) return 'LF';
  if (inRanges(CONTROL, cp)) return 'Control';
  if (inRanges(L, cp)) return 'L';
  if (inRanges(V, cp)) return 'V';
  if (inRanges(T, cp)) return 'T';
  if (cp >= 44032 && cp <= 55203) return (cp - 44032) % 28 === 0 ? 'LV' : 'LVT';
  if (inRanges(EXTEND, cp)) return 'Extend';
  if (inRanges(ZWJ, cp)) return 'ZWJ';
  if (inRanges(RI, cp)) return 'RI';
  if (inRanges(PREPEND, cp)) return 'Prepend';
  if (inRanges(SPACING_MARK, cp)) return 'SpacingMark';
  return 'Other';
}

export function countGraphemes(text: string): number {
  let count = 0;
  let index = 0;
  let prev: Prop | null = null;
  let ri = 0;
  let ep = false;
  let zwjEp = false;
  let incb = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const prop = propertyOf(cp);
    const consonant = inRanges(INCB_CONSONANT, cp);
    const pictographic = inRanges(EXT_PICT, cp);
    let join: boolean;
    if (index === 0) join = false;
    else if (prev === 'CR' && prop === 'LF') join = true; // GB3
    else if (prev === 'CR' || prev === 'LF' || prev === 'Control' || prop === 'CR' || prop === 'LF' || prop === 'Control') join = false; // GB4/5
    else if (prev === 'L' && (prop === 'L' || prop === 'V' || prop === 'LV' || prop === 'LVT')) join = true; // GB6
    else if ((prev === 'LV' || prev === 'V') && (prop === 'V' || prop === 'T')) join = true; // GB7
    else if ((prev === 'LVT' || prev === 'T') && prop === 'T') join = true; // GB8
    else if (prop === 'Extend' || prop === 'ZWJ' || prop === 'SpacingMark' || prev === 'Prepend') join = true; // GB9/9a/9b
    else if (consonant && incb === 2) join = true; // GB9c
    else if (prev === 'ZWJ' && zwjEp && pictographic) join = true; // GB11
    else join = prev === 'RI' && prop === 'RI' && ri % 2 === 1; // GB12/13
    if (!join) count += 1;
    zwjEp = prop === 'ZWJ' && ep;
    if (pictographic) ep = true;
    else if (prop !== 'Extend') ep = false;
    if (consonant) incb = 1;
    else if (inRanges(INCB_LINKER, cp) && incb > 0) incb = 2;
    else if (!inRanges(INCB_EXTEND, cp)) incb = 0;
    ri = prop === 'RI' ? ri + 1 : 0;
    prev = prop;
    index += 1;
  }
  return count;
}
