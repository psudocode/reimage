import type { ToolRuntime } from '../types.ts';
import {
  computeCropRect,
  cropDefaults,
  cropOutputSize,
  validateCrop,
  type CropOptions,
} from './options.ts';

/**
 * Crop, worker side. A straight pixel copy through an OffscreenCanvas, no
 * resampling. The result is capped by the memory guard in `ctx`.
 */
export const cropRuntime: ToolRuntime<CropOptions> = {
  id: 'crop',
  defaults: cropDefaults,
  validate: validateCrop,
  async run(input, options, ctx) {
    const rect = computeCropRect(input, options);
    if (rect.width === input.width && rect.height === input.height) {
      ctx.progress(1);
      return input;
    }
    const out = cropOutputSize(rect, ctx.maxPixels);
    const canvas = ctx.createCanvas(out.width, out.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D context for cropping');
    context.drawImage(input, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height);
    ctx.progress(1);
    return canvas.transferToImageBitmap();
  },
};
