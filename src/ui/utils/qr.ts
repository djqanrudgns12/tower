/**
 * 외부 의존성 없는 순수 TypeScript ISO/IEC 18004 QR 코드 행렬 생성기 (Byte 모드 · 오류 복원 수준 M · 버전 1~10).
 * 교실 태블릿·휴대전화 기본 카메라가 한글 학교명이 든 공유 URL도 즉시 인식하도록 8개 마스크 벌점을 모두 평가해 최적 마스크를 고른다.
 */

interface VersionSpec {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  group1Blocks: number;
  group1DataCodewords: number;
  group2Blocks: number;
  group2DataCodewords: number;
  alignmentCenters: readonly number[];
}

/** ISO/IEC 18004 Table 7·9·E.1 기준 버전 1~10 (오류 복원 수준 M: 약 15% 복원). */
const VERSION_SPECS: readonly VersionSpec[] = [
  { version: 1, totalCodewords: 26, ecCodewordsPerBlock: 10, group1Blocks: 1, group1DataCodewords: 16, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [] },
  { version: 2, totalCodewords: 44, ecCodewordsPerBlock: 16, group1Blocks: 1, group1DataCodewords: 28, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewordsPerBlock: 26, group1Blocks: 1, group1DataCodewords: 44, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewordsPerBlock: 18, group1Blocks: 2, group1DataCodewords: 32, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewordsPerBlock: 24, group1Blocks: 2, group1DataCodewords: 43, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewordsPerBlock: 16, group1Blocks: 4, group1DataCodewords: 27, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewordsPerBlock: 18, group1Blocks: 4, group1DataCodewords: 31, group2Blocks: 0, group2DataCodewords: 0, alignmentCenters: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewordsPerBlock: 22, group1Blocks: 2, group1DataCodewords: 38, group2Blocks: 2, group2DataCodewords: 39, alignmentCenters: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewordsPerBlock: 22, group1Blocks: 3, group1DataCodewords: 36, group2Blocks: 2, group2DataCodewords: 37, alignmentCenters: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewordsPerBlock: 26, group1Blocks: 4, group1DataCodewords: 43, group2Blocks: 1, group2DataCodewords: 44, alignmentCenters: [6, 28, 50] },
];

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      const prod = gfMultiply(result[j]!, root);
      result[j] = j + 1 < degree ? prod ^ result[j + 1]! : prod;
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0]!;
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) {
      result[i] = result[i]! ^ gfMultiply(divisor[i]!, factor);
    }
  }
  return result;
}

function appendBits(val: number, len: number, out: number[]): void {
  for (let i = len - 1; i >= 0; i--) {
    out.push((val >>> i) & 1);
  }
}

function getBit(val: number, idx: number): boolean {
  return ((val >>> idx) & 1) !== 0;
}

function totalDataCodewords(spec: VersionSpec): number {
  return spec.group1Blocks * spec.group1DataCodewords + spec.group2Blocks * spec.group2DataCodewords;
}

function chooseVersion(byteLen: number): VersionSpec {
  for (const spec of VERSION_SPECS) {
    const countBits = spec.version <= 9 ? 8 : 16;
    const capacityBits = totalDataCodewords(spec) * 8;
    if (4 + countBits + byteLen * 8 <= capacityBits) return spec;
  }
  throw new RangeError(`QR payload too long (${byteLen} bytes)`);
}

function buildCodewords(payload: Uint8Array, spec: VersionSpec): Uint8Array {
  const dataCapacityBytes = totalDataCodewords(spec);
  const dataCapacityBits = dataCapacityBytes * 8;
  const bits: number[] = [];

  // Byte 모드 지시자(0100) + 글자 수 지시자
  appendBits(0b0100, 4, bits);
  appendBits(payload.length, spec.version <= 9 ? 8 : 16, bits);
  for (const b of payload) appendBits(b, 8, bits);

  // 종료자(최대 4비트 0) + 바이트 경계 정렬 + 패딩 바이트(0xEC, 0x11)
  appendBits(0, Math.min(4, dataCapacityBits - bits.length), bits);
  appendBits(0, (8 - (bits.length % 8)) % 8, bits);
  for (let pad = 0xec; bits.length < dataCapacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(pad, 8, bits);
  }

  const dataBytes = new Uint8Array(dataCapacityBytes);
  for (let i = 0; i < bits.length; i++) {
    dataBytes[i >>> 3]! |= bits[i]! << (7 - (i & 7));
  }

  const divisor = reedSolomonDivisor(spec.ecCodewordsPerBlock);
  const blocksData: Uint8Array[] = [];
  const blocksEc: Uint8Array[] = [];
  let offset = 0;
  const totalBlocks = spec.group1Blocks + spec.group2Blocks;
  for (let b = 0; b < totalBlocks; b++) {
    const len = b < spec.group1Blocks ? spec.group1DataCodewords : spec.group2DataCodewords;
    const slice = dataBytes.subarray(offset, offset + len);
    offset += len;
    blocksData.push(slice);
    blocksEc.push(reedSolomonRemainder(slice, divisor));
  }

  const maxDataLen = Math.max(spec.group1DataCodewords, spec.group2DataCodewords);
  const interleaved = new Uint8Array(spec.totalCodewords);
  let pos = 0;
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of blocksData) {
      if (i < blk.length) interleaved[pos++] = blk[i]!;
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const ec of blocksEc) {
      interleaved[pos++] = ec[i]!;
    }
  }
  return interleaved;
}

function setFunctionModule(
  modules: boolean[][],
  isFunction: boolean[][],
  x: number,
  y: number,
  dark: boolean,
): void {
  modules[y]![x] = dark;
  isFunction[y]![x] = true;
}

function drawFinderPattern(
  modules: boolean[][],
  isFunction: boolean[][],
  size: number,
  cx: number,
  cy: number,
): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(modules, isFunction, x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignmentPattern(
  modules: boolean[][],
  isFunction: boolean[][],
  cx: number,
  cy: number,
): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(modules, isFunction, cx + dx, cy + dy, dist !== 1);
    }
  }
}

function drawFormatBits(
  modules: boolean[][],
  isFunction: boolean[][],
  size: number,
  mask: number,
): void {
  // 오류 복원 수준 M 지시자 비트는 00
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) setFunctionModule(modules, isFunction, 8, i, getBit(bits, i));
  setFunctionModule(modules, isFunction, 8, 7, getBit(bits, 6));
  setFunctionModule(modules, isFunction, 8, 8, getBit(bits, 7));
  setFunctionModule(modules, isFunction, 7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) setFunctionModule(modules, isFunction, 14 - i, 8, getBit(bits, i));

  for (let i = 0; i < 8; i++) setFunctionModule(modules, isFunction, size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i++) setFunctionModule(modules, isFunction, 8, size - 15 + i, getBit(bits, i));
  setFunctionModule(modules, isFunction, 8, size - 8, true);
}

function drawVersionBits(
  modules: boolean[][],
  isFunction: boolean[][],
  size: number,
  version: number,
): void {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = getBit(bits, i);
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunctionModule(modules, isFunction, b, a, dark);
    setFunctionModule(modules, isFunction, a, b, dark);
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(modules: boolean[][], isFunction: boolean[][], mask: number): void {
  const size = modules.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunction[y]![x] && maskBit(mask, x, y)) {
        modules[y]![x] = !modules[y]![x];
      }
    }
  }
}

function finderPenaltyCount(runHistory: number[]): number {
  const n = runHistory[1]!;
  const core =
    n > 0 &&
    runHistory[2] === n &&
    runHistory[3] === n * 3 &&
    runHistory[4] === n &&
    runHistory[5] === n;
  return (
    (core && runHistory[0]! >= n * 4 && runHistory[6]! >= n ? 1 : 0) +
    (core && runHistory[6]! >= n * 4 && runHistory[0]! >= n ? 1 : 0)
  );
}

function finderPenaltyAddHistory(currentRunLength: number, runHistory: number[], size: number): number {
  if (runHistory[0] === 0) currentRunLength += size;
  runHistory.pop();
  runHistory.unshift(currentRunLength);
  return currentRunLength;
}

function penaltyScore(modules: boolean[][]): number {
  const size = modules.length;
  let score = 0;

  // N1 & N3 (가로)
  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runX = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (modules[y]![x] === runColor) {
        runX++;
        if (runX === 5) score += 3;
        else if (runX > 5) score++;
      } else {
        finderPenaltyAddHistory(runX, runHistory, size);
        if (!runColor) score += finderPenaltyCount(runHistory) * 40;
        runColor = modules[y]![x]!;
        runX = 1;
      }
    }
    score += finderPenaltyTerminate(runColor, runX, runHistory, size) * 40;
  }

  // N1 & N3 (세로)
  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runY = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (modules[y]![x] === runColor) {
        runY++;
        if (runY === 5) score += 3;
        else if (runY > 5) score++;
      } else {
        finderPenaltyAddHistory(runY, runHistory, size);
        if (!runColor) score += finderPenaltyCount(runHistory) * 40;
        runColor = modules[y]![x]!;
        runY = 1;
      }
    }
    score += finderPenaltyTerminate(runColor, runY, runHistory, size) * 40;
  }

  // N2 (2×2 동색 블록)
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y]![x];
      if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) {
        score += 3;
      }
    }
  }

  // N4 (암 모듈 비율)
  let dark = 0;
  for (const row of modules) {
    for (const cell of row) if (cell) dark++;
  }
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;

  return score;
}

function finderPenaltyTerminate(
  currentRunColor: boolean,
  currentRunLength: number,
  runHistory: number[],
  size: number,
): number {
  if (currentRunColor) {
    finderPenaltyAddHistory(currentRunLength, runHistory, size);
    currentRunLength = 0;
  }
  currentRunLength += size;
  finderPenaltyAddHistory(currentRunLength, runHistory, size);
  return finderPenaltyCount(runHistory);
}

/**
 * UTF-8 문자열을 QR 코드 암(true)·명(false) 정방 행렬로 인코딩한다.
 */
export function encodeQrMatrix(text: string): boolean[][] {
  const payload = new TextEncoder().encode(text);
  const spec = chooseVersion(payload.length);
  const size = spec.version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  // 타이밍 패턴
  for (let i = 0; i < size; i++) {
    setFunctionModule(modules, isFunction, 6, i, i % 2 === 0);
    setFunctionModule(modules, isFunction, i, 6, i % 2 === 0);
  }

  // 위치 탐지 패턴 3곳
  drawFinderPattern(modules, isFunction, size, 3, 3);
  drawFinderPattern(modules, isFunction, size, size - 4, 3);
  drawFinderPattern(modules, isFunction, size, 3, size - 4);

  // 정렬 패턴
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      drawAlignmentPattern(modules, isFunction, centers[i]!, centers[j]!);
    }
  }

  // 포맷·버전 영역 예약
  drawFormatBits(modules, isFunction, size, 0);
  drawVersionBits(modules, isFunction, size, spec.version);

  // 지그재그 데이터 배치
  const codewords = buildCodewords(payload, spec);
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (isFunction[y]![x]) continue;
        const dark =
          bitIdx < codewords.length * 8 &&
          getBit(codewords[bitIdx >>> 3]!, 7 - (bitIdx & 7));
        modules[y]![x] = dark;
        bitIdx++;
      }
    }
  }

  // 8개 마스크 중 최소 벌점 선택
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(modules, isFunction, mask);
    drawFormatBits(modules, isFunction, size, mask);
    const p = penaltyScore(modules);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = mask;
    }
    applyMask(modules, isFunction, mask);
  }
  applyMask(modules, isFunction, bestMask);
  drawFormatBits(modules, isFunction, size, bestMask);

  return modules;
}

/**
 * QR 행렬을 단일 SVG `<path d="...">` 문자열로 변환한다 (quiet zone 포함).
 */
export function qrMatrixToSvgPath(matrix: readonly (readonly boolean[])[], quietZone = 4): {
  viewBoxSize: number;
  path: string;
} {
  const size = matrix.length;
  const parts: string[] = [];
  for (let y = 0; y < size; y++) {
    const row = matrix[y]!;
    for (let x = 0; x < size; x++) {
      if (row[x]) parts.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
    }
  }
  return { viewBoxSize: size + quietZone * 2, path: parts.join('') };
}
