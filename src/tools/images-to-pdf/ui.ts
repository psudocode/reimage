import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { ImagesToPdfOptions } from './options.ts';

/** Images to PDF, main-thread side. The Panel is lazy so it only loads when shown. */
export const imagesToPdfUI: ToolUI<ImagesToPdfOptions> = {
  id: 'images-to-pdf',
  labelKey: 'tools.imagesToPdf.label',
  category: 'export',
  icon: 'export',
  Panel: lazy(() => import('./Panel.tsx')),
};
