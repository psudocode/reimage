import type { ToolRuntime } from '../types.ts';
import {
  computeExpandLayout,
  expandDefaults,
  validateExpand,
  type ExpandOptions,
} from './options.ts';

/**
 * Expand canvas, worker side. Paints the background (or leaves it transparent),
 * then draws the image inside the padding. The canvas size respects the memory
 * guard in `ctx`.
 */
export const expandRuntime: ToolRuntime<ExpandOptions> = {
  id: 'expand',
  defaults: expandDefaults,
  validate: validateExpand,
  async run(input, options, ctx) {
    if (ctx.signal.aborted) {
      const error = new Error('Expand was cancelled');
      error.name = 'AbortError';
      throw error;
    }
    const { canvas: size, image } = computeExpandLayout(input, options, ctx.maxPixels);
    const canvas = ctx.createCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D canvas context');
    if (options.background === 'color') {
      context.fillStyle = options.color;
      context.fillRect(0, 0, size.width, size.height);
    }
    context.drawImage(input, image.x, image.y, image.width, image.height);
    ctx.progress(1);
    return canvas.transferToImageBitmap();
  },
};
