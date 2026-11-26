import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { CompressOptions } from './options.ts';

/** Compress, main-thread side. The Panel is lazy so it only loads when shown. */
export const compressUI: ToolUI<CompressOptions> = {
  id: 'compress',
  labelKey: 'tools.compress.label',
  icon: 'file-down',
  Panel: lazy(() => import('./Panel.tsx')),
};
