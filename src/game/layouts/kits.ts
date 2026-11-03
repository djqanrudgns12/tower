// 맵별 지면 재료 묶음(R3 P3 일반화). 배치표가 있는 맵은 이 묶음의 재료 id로 지면을 조립한다(layoutGround.ts).
// 정원은 ART-R1 재료(ground.*·path.*·slot.pad.*), 강가·궁궐 뜰·설원은 `map.<맵 id>.…` 재료다. Phaser를 모르는 순수 데이터라 시험이 같은 표를 읽는다.

export interface GroundKit {
  /** 바닥 3톤: 기본·볕(밝은)·그늘(어두운). 맵 id 저주파 마스크로 섞는다. */
  base: string;
  light: string;
  shade: string;
  /** 지면 얼룩·무늬(배치표의 meadow가 부른다). */
  meadows: readonly string[];
  /** 길 재료(흙·돌·밟힌 눈). */
  dirt: string;
  /** 설치 받침 두 종(번갈아 쓴다). 없으면 fallbackPad. */
  pads: readonly [string, string];
  fallbackPad: string;
  /** 입구 표시(모든 맵 공용 원화). */
  entry: string;
  /** 바닥 3톤 위에 얹는 색조: 그늘은 곱하기, 볕은 부드러운 빛. [색, 세기] */
  tone: { shade: readonly [string, number]; light: readonly [string, number] };
  /** 길 색: 가장자리 번짐(fringe), 바깥 그늘 번짐(halo), 안쪽 가장자리 그늘(rim, rgba 문자열), 굽이 바퀴 자국(rut, 'r, g, b'). */
  path: { fringe: string; halo: string; rim: string; rut: string };
}

const mapKit = (id: string, over: Pick<GroundKit, 'tone' | 'path'> & Partial<Pick<GroundKit, 'meadows'>>): GroundKit => ({
  base: `map.${id}.ground.base`, light: `map.${id}.ground.light`, shade: `map.${id}.ground.shade`,
  meadows: over.meadows ?? [0, 1, 2].map(i => `map.${id}.meadow.${i}`),
  dirt: `map.${id}.path.dirt`, pads: [`map.${id}.slot.pad.0`, `map.${id}.slot.pad.1`], fallbackPad: 'slot.base', entry: 'map.entry',
  tone: over.tone, path: over.path,
});

export const GROUND_KITS: Readonly<Record<string, GroundKit>> = {
  garden_u: {
    base: 'ground.grass.base', light: 'ground.grass.light', shade: 'ground.grass.shade',
    meadows: ['ground.meadow.0', 'ground.meadow.1', 'ground.meadow.2'],
    dirt: 'path.dirt', pads: ['slot.pad.0', 'slot.pad.1'], fallbackPad: 'slot.base', entry: 'map.entry',
    tone: { shade: ['#557a2c', 0.28], light: ['#fff0b8', 0.14] },
    path: { fringe: '#b48d58', halo: '#2f4a16', rim: 'rgba(96, 64, 30, 0.42)', rut: '150, 112, 66' },
  },
  river_z: mapKit('river_z', {
    tone: { shade: ['#557a2c', 0.28], light: ['#fff0b8', 0.14] },
    path: { fringe: '#c8b078', halo: '#2f4a16', rim: 'rgba(110, 84, 40, 0.4)', rut: '168, 140, 88' },
  }),
  courtyard: mapKit('courtyard', {
    tone: { shade: ['#557a2c', 0.28], light: ['#fff0b8', 0.14] },
    path: { fringe: '#9d9788', halo: '#2f4a16', rim: 'rgba(70, 66, 58, 0.36)', rut: '140, 134, 120' },
  }),
  snow_step: mapKit('snow_step', {
    tone: { shade: ['#a9bdd6', 0.3], light: ['#ffffff', 0.14] },
    path: { fringe: '#bfae94', halo: '#5f7391', rim: 'rgba(96, 86, 74, 0.34)', rut: '170, 154, 130' },
  }),
};

export const groundKitFor = (mapId: string): GroundKit | null => GROUND_KITS[mapId] ?? null;
