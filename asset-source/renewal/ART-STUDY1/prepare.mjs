#!/usr/bin/env node
/**
 * ART-STUDY1: 「오늘의 낱말」 액자용 인게임 8종족 일상 원화 30종 정규화 및 WebP 패킹 스크립트
 *
 * 기능:
 * 1) (--raw-map <json> 지정 시) 검수 통과 원본 30장을 Lanczos 192×192 불투명 RGB PNG로 정규화하여 prepared/에 저장
 * 2) 실제 데스크톱 표시 크기(94×94px, 6×5 격자) 검수용 접촉판 contact-sheet.png 생성
 * 3) tools/assets/to-webp.mjs를 호출해 public/assets/ui/study/study.monster.01~30.webp 생성
 *
 * 실행:
 *   node asset-source/renewal/ART-STUDY1/prepare.mjs [--raw-map <path-to-map.json>]
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} 실패: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });

const HERE = import.meta.dirname;
const PROJECT = path.resolve(HERE, '../../..');
const PREPARED_DIR = path.join(HERE, 'prepared');
const RUNTIME_OUT_DIR = path.join(PROJECT, 'public/assets/ui/study');
const CONTACT_SHEET = path.join(HERE, 'contact-sheet.png');
const TO_WEBP = path.join(PROJECT, 'tools/assets/to-webp.mjs');

const IDS = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, '0'));

async function main() {
  const { values } = parseArgs({
    options: {
      'raw-map': { type: 'string' },
    },
  });

  await mkdir(PREPARED_DIR, { recursive: true });
  await mkdir(RUNTIME_OUT_DIR, { recursive: true });

  if (values['raw-map']) {
    const rawMap = JSON.parse(await readFile(path.resolve(values['raw-map']), 'utf8'));
    for (const id of IDS) {
      const src = rawMap[id];
      if (!src || !existsSync(src)) {
        throw new Error(`번호 ${id} 원본 경로가 없거나 파일을 찾을 수 없습니다: ${src}`);
      }
      const dst = path.join(PREPARED_DIR, `study.monster.${id}.png`);
      await run('magick', [
        src,
        '-filter',
        'Lanczos',
        '-resize',
        '192x192!',
        '-alpha',
        'off',
        '-strip',
        `PNG24:${dst}`,
      ]);
    }
    console.log(`정규화 완료: prepared/study.monster.01~30.png (192×192 RGB PNG)`);
  }

  const preparedPngs = IDS.map(id => {
    const p = path.join(PREPARED_DIR, `study.monster.${id}.png`);
    if (!existsSync(p)) {
      throw new Error(`정규화된 PNG가 없습니다: ${p}`);
    }
    return p;
  });

  // 실제 데스크톱 액자 내부 표시 크기(94×94px) 6열×5행 접촉판 생성
  await run('magick', [
    'montage',
    ...preparedPngs,
    '-thumbnail',
    '94x94!',
    '-tile',
    '6x5',
    '-geometry',
    '+8+8',
    '-background',
    '#efe0c2',
    '-bordercolor',
    '#6a482d',
    '-border',
    '3',
    '-strip',
    `PNG24:${CONTACT_SHEET}`,
  ]);
  console.log(`접촉판 생성 완료: ${path.relative(PROJECT, CONTACT_SHEET)}`);

  const out = await run('node', [TO_WEBP, ...preparedPngs, '--out', RUNTIME_OUT_DIR]);
  process.stdout.write(out);
}

await main();
