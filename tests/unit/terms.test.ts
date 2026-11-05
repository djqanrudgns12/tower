import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// 화면 용어 검사(R5 C4, docs/renewal/prd-r5-oak-v2.md §3.3·ui-rules-v4). 학생에게 보이는 글은 평이한 범용어만 쓴다.
// 세계관 말투(수호·출정·징집·작전실·명예점 등)는 2026-11-04 사용자 결정으로 쓰지 않는다.
// 코드의 문자열·템플릿 조각·JSX 글만 읽고 주석은 읽지 않는다. 엔진(src/domain)·계약(src/contracts)의 개발자용 오류 문구는 화면에 나오지 않아 대상이 아니다.
// 단, 밸런스 계약 JSON의 진화 형태·보물 label·summary는 카드에 그대로 보이므로 따로 읽는다(R5 P4).

/** 쓰지 않는 말 → 대신 쓰는 말. */
const BANNED: Readonly<Record<string, string>> = {
  수호: '지키다·랭킹',
  명예점: '랭킹 점수',
  최고점: '최고 점수',
  '최장 웨이브': '최고 웨이브',
  '내 기기': '내 기록',
  '상세 순위표': '전체 랭킹',
  왕국: '(쓰지 않음)',
  학술원: '(쓰지 않음)',
  작전실: '(쓰지 않음)',
  '낱말의 힘': '(쓰지 않음)',
  '낱말 공부': '오늘의 낱말',
  비석: '오늘의 낱말',
  출정: '시작·새 게임',
  시작하기: '시작',
  징집: '새 타워',
  고비: '보스',
  대장: '보스',
  버닝: '연속 정답 보너스',
  불꽃: '연속 정답 보너스(불꽃은 아이콘으로만 보인다)',
  원정: '보물',
  종족: '적·적 특성',
  군자금: '골드',
  '성문 수비': '(쓰지 않음)',
  초원: '정원',
  처음으로: '홈',
  '다시 보기': '오답 노트·이번 판 기록',
};

/** 화면 글이 나오는 곳. */
const ROOTS = ['src/ui', 'src/application'];

/** 닉네임 추천 낱말 묶음(src/application/lobby.ts): 학생이 고르는 이름이지 화면 용어가 아니다. */
const NAME_POOLS = new Set([
  'QUIRKY_STATES', 'QUIRKY_ROLES', 'SNACK_PROPS', 'GRAND_TITLES', 'WORDPLAY_TOPICS', 'WORDPLAY_TITLES',
  'FIELD_SPOTS', 'FIELD_GUESTS', 'MIMETIC_WORDS', 'CRITTER_HEROES', 'SIGNATURE_WITTY_NICKS',
]);

const PROJECT = path.resolve(__dirname, '../..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function inNamePool(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return NAME_POOLS.has(n.name.text);
  }
  return false;
}

function screenStrings(file: string): { line: number; text: string }[] {
  const code = readFileSync(file, 'utf8');
  const src = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { line: number; text: string }[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      if (/[가-힣]/.test(n.text) && !inNamePool(n)) out.push({ line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1, text: n.text });
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

describe('화면 용어(평이한 말)', () => {
  const files = ROOTS.flatMap(r => sourceFiles(path.join(PROJECT, r)));

  it('화면 글이 있는 파일을 실제로 읽는다', () => {
    expect(files.some(f => f.endsWith(path.join('src', 'ui', 'copy.ts')))).toBe(true);
    expect(files.length).toBeGreaterThan(50);
  });

  it('쓰지 않는 말이 화면 글에 없다', () => {
    const found: string[] = [];
    for (const f of files) {
      for (const { line, text } of screenStrings(f)) {
        for (const [word, use] of Object.entries(BANNED)) {
          if (text.includes(word)) found.push(`${path.relative(PROJECT, f)}:${line} 「${word}」→ ${use} · ${text.replace(/\s+/g, ' ').trim().slice(0, 60)}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('진화·보물 카드 문구(밸런스 계약 JSON의 label·summary)에 쓰지 않는 말과 느낌표가 없다', () => {
    type Card = { label?: string; summary?: string };
    const balance = JSON.parse(readFileSync(path.join(PROJECT, 'docs/contracts/balance.candidate.v0.4.json'), 'utf8')) as {
      forms: Record<string, Record<string, Card>>;
      relics: { items: Record<string, Card> };
    };
    const cards: [string, Card][] = [
      ...Object.entries(balance.forms).flatMap(([tower, forms]) => Object.entries(forms).map(([form, card]): [string, Card] => [`forms.${tower}.${form}`, card])),
      ...Object.entries(balance.relics.items).map(([id, card]): [string, Card] => [`relics.${id}`, card]),
    ];
    expect(cards.length).toBeGreaterThan(100);
    const found: string[] = [];
    for (const [id, card] of cards) {
      for (const field of ['label', 'summary'] as const) {
        const text = card[field];
        if (typeof text !== 'string') continue;
        for (const [word, use] of Object.entries(BANNED)) {
          if (text.includes(word)) found.push(`${id}.${field} 「${word}」→ ${use} · ${text}`);
        }
        if (/[!！]/.test(text)) found.push(`${id}.${field} 느낌표 · ${text}`);
      }
    }
    expect(found).toEqual([]);
  });
});
