import type { ToolRuntime } from '../types.ts';
import { computeCropRect, cropDefaults, validateCrop, type CropOptions } from './options.ts';

/**
 * Crop, worker side. Copies the chosen region onto a new canvas; no resampling,
 * so pixels are untouched. A crop never enlarges, so the memory guard holds.
 */
export const cropRuntime: ToolRuntime<CropOptions> = {
  id: 'crop',
  defaults: cropDefaults,
  validate: validateCrop,
  async run(input, options, ctx) {
    if (ctx.signal.aborted) {
      const error = new Error('Crop was cancelled');
      error.name = 'AbortError';
      throw error;
    }
    const rect = computeCropRect(input, options);
    if (rect.width === input.width && rect.height === input.height) {
      ctx.progress(1);
      return input;
    }
    const canvas = ctx.createCanvas(rect.width, rect.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D canvas context');
    context.drawImage(
      input,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height,
    );
    ctx.progress(1);
    return canvas.transferToImageBitmap();
  },
};
