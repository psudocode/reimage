import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { StripMetadataOptions } from './options.ts';

/** Strip metadata, main-thread side. Lazy panel loads only when shown. */
export const stripMetadataUI: ToolUI<StripMetadataOptions> = {
  id: 'strip-metadata',
  labelKey: 'tools.stripMetadata.label',
  category: 'export',
  icon: 'strip-metadata',
  Panel: lazy(() => import('./Panel.tsx')),
};
