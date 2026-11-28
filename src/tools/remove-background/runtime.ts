import type { ToolContext, ToolRuntime } from '../types.ts';
import { MODEL_INPUT_SIZE } from './model.ts';
import { maskToAlpha, rgbaToTensor } from './mask.ts';
import {
  removeBackgroundDefaults,
  toOutputSettings,
  validateRemoveBackground,
  type RemoveBackgroundOptions,
} from './options.ts';

function abortIfCancelled(ctx: ToolContext) {
  if (ctx.signal.aborted) {
    const error = new Error('Background removal was cancelled');
    error.name = 'AbortError';
    throw error;
  }
}

function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not get a 2D canvas context');
  return context;
}

/**
 * Remove background, worker side. The model sees a 1024x1024 copy; its mask is
 * scaled back and used as the alpha of the ORIGINAL pixels, so the result keeps
 * full resolution and the output never has more pixels than the input (the
 * memory guard `ctx.maxPixels` holds). ONNX Runtime is imported lazily.
 */
export const removeBackgroundRuntime: ToolRuntime<RemoveBackgroundOptions> = {
  id: 'remove-background',
  defaults: removeBackgroundDefaults,
  validate: validateRemoveBackground,
  toOutput: toOutputSettings,
  supports: (env) => env.offscreenCanvas,
  async run(input, options, ctx) {
    abortIfCancelled(ctx);
    if (input.width * input.height > ctx.maxPixels) {
      throw new Error('Image is too large for background removal');
    }

    // 1. Model input: squash to 1024x1024.
    const side = MODEL_INPUT_SIZE;
    const small = ctx.createCanvas(side, side);
    const smallContext = context2d(small);
    smallContext.drawImage(input, 0, 0, side, side);
    const pixels = smallContext.getImageData(0, 0, side, side);
    ctx.progress(0.1);

    // 2. Inference (loads the runtime and the cached model on first use).
    const { infer } = await import('./session.ts');
    const raw = await infer(rgbaToTensor(pixels.data, side * side));
    abortIfCancelled(ctx);
    ctx.progress(0.8);

    // 3. Mask → alpha, scaled up, and keyed onto the original pixels.
    const alpha = maskToAlpha(raw, options.softEdges);
    const maskPixels = new Uint8ClampedArray(side * side * 4);
    for (let i = 0; i < alpha.length; i += 1) maskPixels[i * 4 + 3] = alpha[i]!;
    smallContext.putImageData(new ImageData(maskPixels, side, side), 0, 0);

    const output = ctx.createCanvas(input.width, input.height);
    const outputContext = context2d(output);
    outputContext.drawImage(input, 0, 0);
    outputContext.globalCompositeOperation = 'destination-in';
    outputContext.imageSmoothingQuality = 'high';
    outputContext.drawImage(small, 0, 0, input.width, input.height);
    ctx.progress(1);
    return output.transferToImageBitmap();
  },
};
