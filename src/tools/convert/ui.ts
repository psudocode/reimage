import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { ConvertOptions } from './options.ts';

/** Convert, main-thread side. The Panel is lazy so it only loads when shown. */
export const convertUI: ToolUI<ConvertOptions> = {
  id: 'convert',
  labelKey: 'tools.convert.label',
  icon: 'repeat',
  Panel: lazy(() => import('./Panel.tsx')),
};
