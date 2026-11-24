export const svg = (viewBox, content, size = {}) =>
  `<svg aria-hidden="true" viewBox="${viewBox}" width="${size.width ?? 48}" height="${size.height ?? size.width ?? 48}">${content}</svg>`;

export const figure = (image, caption) => `<figure>${image}<figcaption>${caption}</figcaption></figure>`;

export function escapeHtml(value) {
  return value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

export function quizFields(question) {
  return {
    question: escapeHtml(question.stem),
    answers: question.options.map(({ text }, index) =>
      `<button><b>${index + 1}</b><span>${escapeHtml(text)}</span></button>`).join(''),
  };
}

export function plate(map, { left, top, dx, dy }) {
  const center = ([x, y]) => [left + (x + .5) * dx, top + (y + .5) * dy];
  const right = left + map.gridWidth * dx;
  const bottom = top + map.gridHeight * dy;
  const path = map.pathCells.map(center);
  const gridLines = [
    ...Array.from({ length: map.gridWidth + 1 }, (_, i) => {
      const x = left + i * dx;
      return `M${x} ${top}V${bottom}`;
    }),
    ...Array.from({ length: map.gridHeight + 1 }, (_, i) => {
      const y = top + i * dy;
      return `M${left} ${y}H${right}`;
    }),
  ].join('');
  return { center, right, bottom, path, gridLines };
}

export function onRoute(path, progress) {
  const index = Math.floor(progress);
  const [fromX, fromY] = path[index];
  const [toX, toY] = path[index + 1];
  const fraction = progress - index;
  const x = fromX + (toX - fromX) * fraction;
  const y = fromY + (toY - fromY) * fraction;
  const heading = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
  return `translate(${x} ${y}) rotate(${heading})`;
}
