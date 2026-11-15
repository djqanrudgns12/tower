import { parseFrontmatter } from './frontmatter.mjs';

export const LESSON_ID_RE = /^L-TD-\d{3}$/;
export const REQUIRED_LESSON_FIELDS = [
  '언제',
  '규칙',
  '왜',
  '검사',
  '단계',
  '카운터',
  '날짜',
  '태그',
  '근거',
];

export function parseGlossary(markdown) {
  const { body } = parseFrontmatter(markdown);
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const entries = [];

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    const term = cells[0] ?? '';
    if (!term || term === '용어 / 약어' || /^[-:]+$/.test(term)) continue;
    entries.push({
      term: term.replace(/`/g, ''),
      rawTerm: term,
      category: cells[1] ?? '',
      definition: cells[2] ?? '',
      source: cells[3] ?? '',
      line: i + 1,
    });
  }
  return entries;
}

export function parseLessons(markdown, fileRel = '') {
  const { body } = parseFrontmatter(markdown);
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const entries = [];
  let current = null;

  const flush = (endLine) => {
    if (!current) return;
    current.endLine = endLine;
    current.chars = [...current.rawLines.join('\n')].length;
    delete current.rawLines;
    entries.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const headMatch = line.match(/^###\s+(L-TD-\d{3})\s*[·—-]\s*(.+)$/);
    if (headMatch) {
      flush(i);
      current = {
        id: (headMatch[1] ?? '').trim(),
        title: (headMatch[2] ?? '').trim(),
        file: fileRel,
        line: i + 1,
        endLine: i + 1,
        chars: 0,
        fields: {},
        tags: [],
        stage: '',
        counters: { hit: 0, violated: 0, falseAlarm: 0 },
        rawLines: [line],
      };
      continue;
    }
    if (/^##\s+/.test(line)) {
      flush(i);
      continue;
    }
    if (!current) continue;
    current.rawLines.push(line);
    const fieldMatch = line.match(/^-\s*\*\*([^*]+)\*\*:\s*(.+)$/);
    if (fieldMatch) {
      const key = (fieldMatch[1] ?? '').trim();
      const val = (fieldMatch[2] ?? '').trim();
      current.fields[key] = val;
      if (key === '단계') {
        const stMatch = val.match(/\b(L[0-4])\b/);
        current.stage = stMatch ? (stMatch[1] ?? val) : val;
      } else if (key === '태그') {
        current.tags = [...val.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');
        if (current.tags.length === 0) {
          current.tags = val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } else if (key === '카운터') {
        const hit = Number(val.match(/적중\s*(\d+)/)?.[1] ?? 0);
        const violated = Number(val.match(/위반\s*(\d+)/)?.[1] ?? 0);
        const falseAlarm = Number(val.match(/오탐\s*(\d+)/)?.[1] ?? 0);
        current.counters = { hit, violated, falseAlarm };
      }
    }
  }
  flush(lines.length);
  return entries;
}

export function formatLessonBlock(entry) {
  const tagsText = entry.tags.map((t) => `\`${t}\``).join(', ');
  const { hit = 0, violated = 0, falseAlarm = 0 } = entry.counters ?? {};
  const lines = [
    `### ${entry.id} · ${entry.title}`,
    `- **언제**: ${entry.fields['언제'] ?? ''}`,
    `- **규칙**: ${entry.fields['규칙'] ?? ''}`,
    `- **왜**: ${entry.fields['왜'] ?? ''}`,
    `- **검사**: ${entry.fields['검사'] ?? '수동 확인'}`,
    `- **단계**: ${entry.fields['단계'] ?? 'L0'}`,
    `- **카운터**: 적중 ${hit} · 위반 ${violated} · 오탐 ${falseAlarm}`,
    `- **날짜**: ${entry.fields['날짜'] ?? ''}`,
    `- **태그**: ${tagsText}`,
    `- **근거**: ${entry.fields['근거'] ?? ''}`,
  ];
  if (entry.fields['대체']) {
    lines.push(`- **대체**: ${entry.fields['대체']}`);
  }
  return lines.join('\n');
}

export function parseDelta(rawText, fileRel = '') {
  const { data, body } = parseFrontmatter(rawText);
  const fields = {};
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^-\s*\*\*([^*]+)\*\*:\s*(.+)$/);
    if (m) {
      fields[(m[1] ?? '').trim()] = (m[2] ?? '').trim();
    }
  }
  return {
    file: fileRel,
    meta: data,
    fields,
  };
}
