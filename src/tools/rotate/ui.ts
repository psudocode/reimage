import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { RotateOptions } from './options.ts';

/** Rotate & flip, main-thread side. The Panel is lazy so it only loads when shown. */
export const rotateUI: ToolUI<RotateOptions> = {
  id: 'rotate',
  labelKey: 'tools.rotate.label',
  category: 'transform',
  icon: 'rotate',
  Panel: lazy(() => import('./Panel.tsx')),
};
