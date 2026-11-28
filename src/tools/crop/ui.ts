import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { CropOptions } from './options.ts';

/** Crop, main-thread side. The Panel is lazy so it only loads when shown. */
export const cropUI: ToolUI<CropOptions> = {
  id: 'crop',
  labelKey: 'tools.crop.label',
  category: 'transform',
  icon: 'crop',
  Panel: lazy(() => import('./Panel.tsx')),
  Overlay: lazy(() => import('./Overlay.tsx')),
};
