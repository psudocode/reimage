import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { WatermarkOptions } from './options.ts';

/** Watermark, main-thread side. The Panel is lazy so it only loads when shown. */
export const watermarkUI: ToolUI<WatermarkOptions> = {
  id: 'watermark',
  labelKey: 'tools.watermark.label',
  category: 'transform',
  icon: 'watermark',
  Panel: lazy(() => import('./Panel.tsx')),
};
