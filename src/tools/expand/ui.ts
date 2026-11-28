import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { ExpandOptions } from './options.ts';

/** Expand canvas, main-thread side. The Panel is lazy so it only loads when shown. */
export const expandUI: ToolUI<ExpandOptions> = {
  id: 'expand',
  labelKey: 'tools.expand.label',
  category: 'transform',
  icon: 'expand',
  Panel: lazy(() => import('./Panel.tsx')),
};
