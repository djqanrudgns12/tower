import type { SyntheticEvent } from 'react';
import { getR6Battle } from '../../application/balanceSession';

export const R6_MAP_NAME = getR6Battle().theme.maps.garden_u.name;
export const R6_MAP_PREVIEW = `${import.meta.env.BASE_URL}assets/r6/map/meadow-plateau.webp`;
export const R6_MAP_DIAGRAM = `${import.meta.env.BASE_URL}assets/r6/meadow-plateau.webp`;

export function showMapDiagram(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.getAttribute('src') === R6_MAP_PREVIEW) image.src = R6_MAP_DIAGRAM;
}
