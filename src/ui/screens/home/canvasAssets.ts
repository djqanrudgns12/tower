import { useSyncExternalStore } from 'react';
import { assetManifestSchema, type AssetEntry } from '../../../contracts/assetManifest';

export interface LoadedSprite {
  entry: AssetEntry;
  img: HTMLImageElement;
  url: string;
}

export type SpriteMap = ReadonlyMap<string, LoadedSprite>;

const EMPTY_SPRITES: SpriteMap = new Map();
let cachedMap: SpriteMap | null = null;
let loadingPromise: Promise<SpriteMap> | null = null;
const subscribers = new Set<() => void>();

/** 부동소수점 시드 PRNG나 Math.random 없이 고정 위상값을 얻는다(PRD §13.3). */
export function rand01(index: number, salt: number): number {
  let h = (Math.imul(index + 1, 374761393) + Math.imul(salt + 1, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function loadOneImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * public/assets/manifest.json에서 integrated_pass 자산만 읽어 이미지 캐시를 예열한다.
 * 전투 진입 전 브라우저 캐시에 원화가 올라가므로 BattleScene 초기 로딩도 빨라진다.
 */
export function loadLobbySprites(): Promise<SpriteMap> {
  if (cachedMap) return Promise.resolve(cachedMap);
  if (loadingPromise) return loadingPromise;
  if (typeof fetch !== 'function') {
    const empty = new Map<string, LoadedSprite>();
    cachedMap = empty;
    return Promise.resolve(empty);
  }

  loadingPromise = (async () => {
    const map = new Map<string, LoadedSprite>();
    try {
      const res = await fetch('assets/manifest.json');
      if (!res.ok) {
        cachedMap = map;
        return map;
      }
      const raw: unknown = await res.json();
      const parsed = assetManifestSchema.safeParse(raw);
      if (!parsed.success) {
        cachedMap = map;
        return map;
      }
      const passed = parsed.data.assets.filter(a => a.status === 'integrated_pass');
      await Promise.all(
        passed.map(async entry => {
          const url = `assets/${entry.file}`;
          const img = await loadOneImage(url);
          if (img) map.set(entry.id, { entry, img, url });
        }),
      );
    } catch {
      // 오프라인·테스트 환경에서는 폴백 도형으로 그린다.
    }
    cachedMap = map;
    for (const sub of subscribers) sub();
    return map;
  })();

  return loadingPromise;
}

function subscribeSprites(listener: () => void): () => void {
  subscribers.add(listener);
  if (!cachedMap) void loadLobbySprites();
  return () => { subscribers.delete(listener); };
}

function getSpritesSnapshot(): SpriteMap {
  return cachedMap ?? EMPTY_SPRITES;
}

export function useLobbySprites(): SpriteMap {
  return useSyncExternalStore(subscribeSprites, getSpritesSnapshot, () => EMPTY_SPRITES);
}
