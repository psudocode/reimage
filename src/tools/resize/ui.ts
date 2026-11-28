import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { ResizeOptions } from './options.ts';

/** Resize, main-thread side. The Panel is lazy so it only loads when shown. */
export const resizeUI: ToolUI<ResizeOptions> = {
  id: 'resize',
  labelKey: 'tools.resize.label',
  icon: 'maximize',
  Panel: lazy(() => import('./Panel.tsx')),
};
