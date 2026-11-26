import { lazy } from 'react';
import type { ImageTool } from '../types.ts';
import { compressDefaults, validateCompress, type CompressOptions } from './options.ts';

export { compressDefaults, toOutputSettings, type CompressOptions } from './options.ts';

/**
 * Compress. Quality / target-size encoding itself happens at the end of the
 * pipeline (see `core/image/encode.ts` and `targetSize.ts`), so `run` is a
 * pass-through. The Panel is lazy so the worker bundle, which imports this
 * module through the registry, does not pull in the UI.
 */
export const compress: ImageTool<CompressOptions> = {
  id: 'compress',
  labelKey: 'tools.compress.label',
  icon: 'file-down',
  defaults: compressDefaults,
  validate: validateCompress,
  async run(input, _options, ctx) {
    ctx.progress(1);
    return input;
  },
  Panel: lazy(() => import('./Panel.tsx')),
};
