import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import type { RemoveBackgroundOptions } from './options.ts';

/** Remove background, main-thread side. The Panel is lazy so it only loads when shown. */
export const removeBackgroundUI: ToolUI<RemoveBackgroundOptions> = {
  id: 'remove-background',
  labelKey: 'tools.removeBackground.label',
  category: 'transform',
  icon: 'remove-background',
  Panel: lazy(() => import('./Panel.tsx')),
};
