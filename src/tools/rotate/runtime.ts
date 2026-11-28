import type { ToolRuntime } from '../types.ts';
import {
  isIdentity,
  rotateDefaults,
  rotatedSize,
  rotateMatrix,
  validateRotate,
  type RotateOptions,
} from './options.ts';

/**
 * Rotate and flip, worker side. Pixels are moved, not resampled, so nothing is
 * lost and the pixel count (the memory guard) stays the same. EXIF orientation
 * is already applied when the file is decoded (`decodeFile`), so this tool
 * always starts from an upright image.
 */
export const rotateRuntime: ToolRuntime<RotateOptions> = {
  id: 'rotate',
  defaults: rotateDefaults,
  validate: validateRotate,
  async run(input, options, ctx) {
    if (ctx.signal.aborted) {
      const error = new Error('Rotate was cancelled');
      error.name = 'AbortError';
      throw error;
    }
    if (isIdentity(options)) {
      ctx.progress(1);
      return input;
    }
    const size = rotatedSize(input, options.rotation);
    const canvas = ctx.createCanvas(size.width, size.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D canvas context');
    context.setTransform(...rotateMatrix(input, options));
    context.drawImage(input, 0, 0);
    ctx.progress(1);
    return canvas.transferToImageBitmap();
  },
};
