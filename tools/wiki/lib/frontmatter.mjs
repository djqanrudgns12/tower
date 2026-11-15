function unquote(val) {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === '[]') return [];
  if (trimmed === '{}') return {};
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => unquote(item));
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return {};
    const obj = {};
    for (const pair of inner.split(',')) {
      const idx = pair.indexOf(':');
      if (idx > 0) {
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        obj[k] = parseScalar(v);
      }
    }
    return obj;
  }
  return unquote(trimmed);
}

export function parseFrontmatter(rawText) {
  const normalized = rawText.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { hasFrontmatter: false, data: {}, body: normalized };
  }
  const endIdx = normalized.indexOf('\n---\n', 4);
  if (endIdx < 0) {
    return { hasFrontmatter: false, data: {}, body: normalized };
  }

  const fmBlock = normalized.slice(4, endIdx);
  const body = normalized.slice(endIdx + 5);
  const lines = fmBlock.split('\n');
  const data = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim() || line.trim().startsWith('#')) {
      i++;
      continue;
    }
    const topMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!topMatch) {
      i++;
      continue;
    }
    const key = topMatch[1] ?? '';
    const rest = (topMatch[2] ?? '').trim();
    if (rest !== '') {
      data[key] = parseScalar(rest);
      i++;
      continue;
    }

    const list = [];
    i++;
    while (i < lines.length) {
      const sub = lines[i] ?? '';
      if (!sub.trim()) {
        i++;
        continue;
      }
      if (!sub.startsWith('  ')) break;
      const itemMatch = sub.match(/^\s*-\s+(.*)$/);
      if (!itemMatch) {
        i++;
        continue;
      }
      const itemRest = (itemMatch[1] ?? '').trim();
      const kvMatch = itemRest.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (kvMatch && !itemRest.startsWith('"') && !itemRest.startsWith("'")) {
        const obj = { [kvMatch[1] ?? '']: parseScalar(kvMatch[2] ?? '') };
        i++;
        while (i < lines.length) {
          const propLine = lines[i] ?? '';
          if (!propLine.startsWith('    ')) break;
          const propMatch = propLine.match(/^\s{4,}([A-Za-z0-9_-]+):\s*(.*)$/);
          if (propMatch) {
            obj[propMatch[1] ?? ''] = parseScalar(propMatch[2] ?? '');
          }
          i++;
        }
        list.push(obj);
      } else {
        list.push(parseScalar(itemRest));
        i++;
      }
    }
    data[key] = list;
  }

  return { hasFrontmatter: true, data, body };
}

function formatScalar(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  const str = String(val);
  if (
    str === '' ||
    /[:#[\]{},&*?|<>=!%@`]/.test(str) ||
    /^\s|\s$/.test(str) ||
    /^\d{4}-\d{2}-\d{2}$/.test(str) === false && /^[-?\d]/.test(str) && !/^[A-Za-z]/.test(str)
  ) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return JSON.stringify(str);
  }
  return str;
}

const KEY_ORDER = [
  'id',
  'type',
  'title',
  'status',
  'updated',
  'generated_by',
  'verified',
  'tags',
  'sources',
  'related',
];

export function stringifyFrontmatter(data, body) {
  const keys = [
    ...KEY_ORDER.filter((k) => Object.hasOwn(data, k)),
    ...Object.keys(data).filter((k) => !KEY_ORDER.includes(k)),
  ];

  const lines = ['---'];
  for (const key of keys) {
    const val = data[key];
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else if (
        key === 'tags' ||
        key === 'related'
      ) {
        lines.push(`${key}: [${val.map((v) => formatScalar(v)).join(', ')}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            const entries = Object.entries(item);
            entries.forEach(([k, v], idx) => {
              if (idx === 0) {
                lines.push(`  - ${k}: ${formatScalar(v)}`);
              } else {
                lines.push(`    ${k}: ${formatScalar(v)}`);
              }
            });
          } else {
            lines.push(`  - ${formatScalar(item)}`);
          }
        }
      }
    } else if (val && typeof val === 'object') {
      const pairs = Object.entries(val).map(([k, v]) => `${k}: ${formatScalar(v)}`);
      lines.push(`${key}: { ${pairs.join(', ')} }`);
    } else {
      lines.push(`${key}: ${formatScalar(val)}`);
    }
  }
  lines.push('---');

  const cleanBody = body.replace(/^\n+/, '');
  return `${lines.join('\n')}\n\n${cleanBody.endsWith('\n') ? cleanBody : `${cleanBody}\n`}`;
}
