import type { R6TowerId } from '../../contracts/balanceV2';
import { createContext, useContext, useEffect, useState } from 'react';
import type { TowerId } from '../../contracts/balance';
import { evolutionAt, isR6Tower } from '../../domain/r6Towers';
import { headDirection, r6ManifestSchema, type R6Manifest, type R6Sheet } from '../../game/r6/manifest';
import { TowerShieldPortrait } from '../icons/GameIcons';

export const BattlePortraits = createContext<{ r6: boolean; manifest: R6Manifest | null }>({ r6: false, manifest: null });

const assetRoot = `${import.meta.env.BASE_URL}assets/r6/`;
let loaded: Promise<R6Manifest> | undefined;

export function useBattlePortraits(r6: boolean) {
  const [manifest, setManifest] = useState<R6Manifest | null>(null);
  useEffect(() => {
    if (!r6) return;
    let active = true;
    loaded ??= fetch(assetRoot + 'manifest-v2.json').then(async response => {
      if (!response.ok) throw new Error('타워 그림 목록을 읽지 못했어요');
      return r6ManifestSchema.parse(await response.json());
    }).catch(error => {
      loaded = undefined;
      throw error;
    });
    void loaded.then(result => { if (active) setManifest(result); }, () => {});
    return () => { active = false; };
  }, [r6]);
  return manifest;
}

const outlines = {
  rail: 'M4 20h16v-3l-3-3H7l-3 3z M9 14V5l3-3 3 3v9 M12 4v7',
  mortar: 'M2 20h20v-5l-4-3H6l-4 3z M7 12l8-8 5 5-3 3 M13 6l5 5',
  cryo: 'M7 21h10 M12 3v18 M8 5h8l4 4-4 4H8L4 9z M4 15l4 4h8l4-4',
  prism: 'M2 21 12 3l10 18z M8 12l4-5 4 5-4 6z',
  hangar: 'M6 5h12l4 7-4 7H6l-4-7z M8 8h8v8H8z M17 5v-3h3',
  bastion: 'M4 21h16v-4l-3-3H7l-3 3z M12 14V9 M4 4l7 2 6 6-7-1z M13 7l4-4',
};

// 시트는 한 줄 또는 여러 줄에 프레임을 담으므로 실제 이미지 너비로 열 수를 구한다.
const sheetSizes = new Map<string, Promise<{ width: number; height: number } | null>>();

function SheetFrame({ sheet, frame, x, y }: { sheet: R6Sheet; frame: number; x: number; y: number }) {
  const url = assetRoot + sheet.file;
  const [loaded, setLoaded] = useState<{ url: string; width: number; height: number } | null>(null);
  useEffect(() => {
    let pending = sheetSizes.get(url);
    if (!pending) {
      pending = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => { sheetSizes.delete(url); resolve(null); };
        img.src = url;
      });
      sheetSizes.set(url, pending);
    }
    let active = true;
    void pending.then(size => { if (active && size) setLoaded({ url, ...size }); });
    return () => { active = false; };
  }, [url]);
  if (loaded?.url !== url) return null;
  const columns = Math.floor(loaded.width / sheet.width);
  if (columns === 0) return null;
  return (
    <svg x={x} y={y} width={sheet.width} height={sheet.height} overflow="hidden">
      <image href={url} x={-(frame % columns) * sheet.width} y={-Math.floor(frame / columns) * sheet.height} width={loaded.width} height={loaded.height} />
    </svg>
  );
}

export function BattleTowerPortrait({ type, icons, size = 42, level = 1 }: {
  type: TowerId | R6TowerId;
  icons: Record<string, string>;
  size?: number | 'fill';
  level?: number;
}) {
  const { r6, manifest } = useContext(BattlePortraits);
  if (!r6 || !isR6Tower(type)) return <TowerShieldPortrait type={type as TowerId} icons={icons} size={size} bare />;
  const form = manifest?.towers[type]?.[evolutionAt(level).stage];
  const dimension = size === 'fill' ? '100%' : size;
  if (!manifest || !form) {
    return <svg width={dimension} height={dimension} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true"><path d={outlines[type]} /></svg>;
  }
  const body = manifest.sheets[form.body]!;
  const head = manifest.sheets[form.head]!;
  return (
    <svg width={dimension} height={dimension} viewBox={`0 ${-head.pivot[1]} ${body.width} ${body.height + head.pivot[1]}`} aria-hidden="true">
      <SheetFrame sheet={body} frame={form.bodyFrame} x={0} y={0} />
      <SheetFrame sheet={head} frame={headDirection(0, -1, manifest.projection)} x={form.mount[0] - head.pivot[0]} y={form.mount[1] - head.pivot[1]} />
    </svg>
  );
}
