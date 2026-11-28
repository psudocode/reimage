import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { MergeOptions } from './options.ts';

/** Merge & collage, main-thread side. The Panel is lazy so it only loads when shown. */
export const mergeUI: ToolUI<MergeOptions> = {
  id: 'merge',
  labelKey: 'tools.merge.label',
  category: 'transform',
  icon: 'images',
  Panel: lazy(() => import('./Panel.tsx')),
};
