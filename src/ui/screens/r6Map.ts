import type { SyntheticEvent } from 'react';
import { getR6Battle } from '../../application/balanceSession';

export const R6_MAP_NAME = getR6Battle().theme.maps.garden_u.name;
export const R6_MAP_PREVIEW = `${import.meta.env.BASE_URL}assets/r6/map/meadow-plateau.webp`;
export const R6_MAP_DIAGRAM = `${import.meta.env.BASE_URL}assets/r6/meadow-plateau.webp`;
export const R6_HOME_HERO = `${import.meta.env.BASE_URL}assets/r6/home/hero-meadow-daylight.webp`;
export const R6_HOME_CREST = `${import.meta.env.BASE_URL}assets/r6/home/brand-crest.webp`;
export const R6_HOME_ICONS = {
  note: `${import.meta.env.BASE_URL}assets/r6/home/icons/note.webp`,
  guide: `${import.meta.env.BASE_URL}assets/r6/home/icons/guide.webp`,
  qr: `${import.meta.env.BASE_URL}assets/r6/home/icons/qr.webp`,
  settings: `${import.meta.env.BASE_URL}assets/r6/home/icons/settings.webp`,
  trophy: `${import.meta.env.BASE_URL}assets/r6/home/icons/trophy.webp`,
  dice: `${import.meta.env.BASE_URL}assets/r6/home/icons/dice.webp`,
} as const;

export function showMapDiagram(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  const src = image.getAttribute('src');
  if (src === R6_HOME_HERO) image.src = R6_MAP_PREVIEW;
  else if (src === R6_MAP_PREVIEW) image.src = R6_MAP_DIAGRAM;
}
