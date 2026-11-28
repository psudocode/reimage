import type { ToolRuntime } from '../types.ts';
import {
  computeMergeLayout,
  mergeDefaults,
  TRANSPARENT,
  validateMerge,
  MIN_MERGE_IMAGES,
  type MergeOptions,
} from './options.ts';

function assertNotAborted(signal: AbortSignal) {
  if (!signal.aborted) return;
  const error = new Error('Merge was cancelled');
  error.name = 'AbortError';
  throw error;
}

/**
 * Merge & collage, worker side. Many images in, one image out: the layout is
 * computed in `options.ts` (never enlarging, capped by the memory guard) and each
 * picture is drawn onto one canvas. A transparent background is written as PNG.
 */
export const mergeRuntime: ToolRuntime<MergeOptions> = {
  id: 'merge',
  kind: 'many-to-one',
  defaults: mergeDefaults,
  validate: validateMerge,
  toOutput: (options) => (options.background === TRANSPARENT ? { format: 'png' } : {}),
  async run(input, _options, ctx) {
    // A single picture has nothing to merge with; the pipeline calls `runMany`.
    ctx.progress(1);
    return input;
  },
  async runMany(inputs, options, ctx) {
    if (inputs.length < MIN_MERGE_IMAGES) throw new Error('Merge needs at least two images');
    const layout = computeMergeLayout(inputs, options, ctx.maxPixels);
    const canvas = ctx.createCanvas(layout.width, layout.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D canvas context');
    if (options.background !== TRANSPARENT) {
      context.fillStyle = options.background;
      context.fillRect(0, 0, layout.width, layout.height);
    }
    context.imageSmoothingQuality = 'high';
    for (const [index, input] of inputs.entries()) {
      assertNotAborted(ctx.signal);
      const place = layout.placements[index]!;
      context.drawImage(input, place.x, place.y, place.width, place.height);
      ctx.progress((index + 1) / inputs.length);
    }
    return canvas.transferToImageBitmap();
  },
};
