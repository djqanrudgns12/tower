export function maskFencesAndInlineCode(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  let inFence = false;
  let fenceMarker = '';

  const fenceMasked = lines.map((line) => {
    const openMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (!inFence && openMatch) {
      inFence = true;
      fenceMarker = openMatch[1] ?? '```';
      return ' '.repeat(line.length);
    }
    if (inFence) {
      const ch = fenceMarker[0] ?? '`';
      const closeRe = new RegExp(`^\\s*${ch}{${fenceMarker.length},}\\s*$`);
      if (closeRe.test(line)) {
        inFence = false;
        fenceMarker = '';
      }
      return ' '.repeat(line.length);
    }
    return line.replace(/`+[^`\n]*`+/g, (m) => ' '.repeat(m.length));
  });

  return fenceMasked.join('\n');
}

export function stripMarkdownFormatting(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .trim();
}

export function slugifyHeading(rawHeading) {
  const clean = stripMarkdownFormatting(rawHeading).toLowerCase();
  return clean
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function extractHeadings(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const masked = maskFencesAndInlineCode(normalized);
  const rawLines = normalized.split('\n');
  const maskedLines = masked.split('\n');

  const list = [];
  const seenSlugs = new Map();

  for (let i = 0; i < maskedLines.length; i++) {
    const mLine = maskedLines[i] ?? '';
    const match = mLine.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const rawLine = rawLines[i] ?? '';
    const rawMatch = rawLine.match(/^(#{1,6})\s+(.+)$/);
    const level = (rawMatch?.[1] ?? match[1] ?? '#').length;
    const text = (rawMatch?.[2] ?? match[2] ?? '').trim().replace(/\s+#+\s*$/, '');
    const baseSlug = slugifyHeading(text);
    const count = seenSlugs.get(baseSlug) ?? 0;
    seenSlugs.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
    const numMatch = text.match(/^(?:§\s*)?(\d+(?:\.\d+)*)\b/);
    list.push({
      level,
      text,
      slug,
      sectionNumber: numMatch ? (numMatch[1] ?? null) : null,
      line: i + 1,
      endLine: rawLines.length,
      chars: 0,
    });
  }

  for (let idx = 0; idx < list.length; idx++) {
    const cur = list[idx];
    if (!cur) continue;
    let endLine = rawLines.length;
    for (let nextIdx = idx + 1; nextIdx < list.length; nextIdx++) {
      const next = list[nextIdx];
      if (next && next.level <= cur.level) {
        endLine = next.line - 1;
        break;
      }
    }
    cur.endLine = endLine;
    const slice = rawLines.slice(cur.line - 1, endLine).join('\n');
    cur.chars = [...slice].length;
  }

  return list;
}

export function extractSection(markdown, query) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const rawLines = normalized.split('\n');
  const headings = extractHeadings(normalized);
  const q = query.trim().replace(/^§/, '');
  const qLower = q.toLowerCase();
  const qSlug = slugifyHeading(q);

  const exact =
    headings.find((h) => h.sectionNumber === q) ??
    headings.find((h) => h.slug === qSlug) ??
    headings.find((h) => h.text.toLowerCase() === qLower) ??
    headings.find((h) => h.text.toLowerCase().includes(qLower));

  if (!exact) return null;
  const content = rawLines.slice(exact.line - 1, exact.endLine).join('\n');
  return {
    heading: exact,
    content,
  };
}

export function extractMarkdownLinks(markdown) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const masked = maskFencesAndInlineCode(normalized);
  const rawLines = normalized.split('\n');
  const maskedLines = masked.split('\n');
  const links = [];

  const linkRe = /!?\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (let i = 0; i < maskedLines.length; i++) {
    const mLine = maskedLines[i] ?? '';
    const rLine = rawLines[i] ?? '';
    linkRe.lastIndex = 0;
    let m;
    while ((m = linkRe.exec(mLine)) !== null) {
      const start = m.index;
      const rawSlice = rLine.slice(start);
      const rawMatch = rawSlice.match(/^!?\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
      const target = rawMatch?.[2] ?? m[2] ?? '';
      const label = rawMatch?.[1] ?? m[1] ?? '';
      if (target) {
        links.push({
          label,
          target,
          line: i + 1,
        });
      }
    }
  }
  return links;
}

export function isExternalTarget(target) {
  return /^(https?:|mailto:|tel:|data:|javascript:)/i.test(target);
}

export function splitLinkTarget(target) {
  const hashIdx = target.indexOf('#');
  if (hashIdx < 0) return { filePart: decodeURIComponent(target), anchor: '' };
  return {
    filePart: decodeURIComponent(target.slice(0, hashIdx)),
    anchor: decodeURIComponent(target.slice(hashIdx + 1)),
  };
}

export function replaceAutoBlocks(markdown, blocksMap) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  let changed = false;
  const foundIds = [];

  const updated = normalized.replace(
    /<!--\s*WIKI-AUTO:START:([a-z0-9-]+)\s*-->([\s\S]*?)<!--\s*WIKI-AUTO:END:\1\s*-->/g,
    (full, id, inner) => {
      foundIds.push(id);
      if (!Object.hasOwn(blocksMap, id)) return full;
      const nextBody = `\n${String(blocksMap[id]).trim()}\n`;
      if (inner === nextBody) return full;
      changed = true;
      return `<!-- WIKI-AUTO:START:${id} -->${nextBody}<!-- WIKI-AUTO:END:${id} -->`;
    },
  );

  return { content: updated, changed, foundIds };
}
