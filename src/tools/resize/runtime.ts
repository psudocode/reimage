import { resampleBitmap } from '../../core/image/resample.ts';
import type { ToolRuntime } from '../types.ts';
import {
  computeTargetSize,
  resizeDefaults,
  validateResize,
  type ResizeOptions,
} from './options.ts';

/**
 * Resize, worker side. Resampling uses pica (Lanczos3) through the shared
 * `resampleBitmap` helper. The target is capped by the memory guard in `ctx`.
 */
export const resizeRuntime: ToolRuntime<ResizeOptions> = {
  id: 'resize',
  defaults: resizeDefaults,
  validate: validateResize,
  async run(input, options, ctx) {
    const target = computeTargetSize(input, options, ctx.maxPixels);
    if (target.width === input.width && target.height === input.height) {
      ctx.progress(1);
      return input;
    }
    const output = await resampleBitmap(input, target.width, target.height, {
      filter: 'lanczos3',
      signal: ctx.signal,
    });
    ctx.progress(1);
    return output;
  },
};
