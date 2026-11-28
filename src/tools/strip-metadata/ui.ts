import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { StripMetadataOptions } from './options.ts';

/** Strip metadata, main-thread side. The Panel is lazy so it only loads when shown. */
export const stripMetadataUI: ToolUI<StripMetadataOptions> = {
  id: 'strip-metadata',
  labelKey: 'tools.stripMetadata.label',
  category: 'export',
  icon: 'shield',
  Panel: lazy(() => import('./Panel.tsx')),
};
