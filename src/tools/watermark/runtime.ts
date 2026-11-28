import type { ToolContext, ToolRuntime } from '../types.ts';
import {
  computeFontSize,
  computeLogoSize,
  placeWatermark,
  validateWatermark,
  watermarkDefaults,
  type WatermarkOptions,
} from './options.ts';

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function abortIfCancelled(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('Watermark was cancelled');
  error.name = 'AbortError';
  throw error;
}

function drawText(
  context: OffscreenCanvasRenderingContext2D,
  options: WatermarkOptions,
  image: { width: number; height: number },
): void {
  let fontSize = computeFontSize(image.width, options.size);
  const setFont = () => (context.font = `600 ${fontSize}px ${FONT_FAMILY}`);
  setFont();
  const text = options.text.trim();
  // Shrink a long text so it still fits inside the image.
  const measured = context.measureText(text).width;
  if (measured > image.width) {
    fontSize = Math.max(1, Math.floor((fontSize * image.width) / measured));
    setFont();
  }
  const width = context.measureText(text).width;
  const { x, y } = placeWatermark(
    image,
    { width, height: fontSize },
    options.position,
    options.margin,
  );
  context.textBaseline = 'top';
  context.fillStyle = options.color;
  context.fillText(text, x, y);
}

async function drawLogo(
  context: OffscreenCanvasRenderingContext2D,
  options: WatermarkOptions,
  image: { width: number; height: number },
): Promise<void> {
  const logo = await createImageBitmap(options.logo!);
  try {
    const size = computeLogoSize(image, logo, options.size);
    const { x, y } = placeWatermark(image, size, options.position, options.margin);
    context.drawImage(logo, x, y, size.width, size.height);
  } finally {
    logo.close();
  }
}

/**
 * Watermark, worker side. Draws the original, then the text or logo on top with
 * the chosen opacity. The output has the input's size, so the memory guard holds.
 */
export const watermarkRuntime: ToolRuntime<WatermarkOptions> = {
  id: 'watermark',
  defaults: watermarkDefaults,
  validate: validateWatermark,
  async run(input, options, ctx: ToolContext) {
    abortIfCancelled(ctx.signal);
    const canvas = ctx.createCanvas(input.width, input.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D canvas context');
    context.drawImage(input, 0, 0);
    context.globalAlpha = options.opacity / 100;
    if (options.mode === 'text') drawText(context, options, input);
    else await drawLogo(context, options, input);
    abortIfCancelled(ctx.signal);
    ctx.progress(1);
    return canvas.transferToImageBitmap();
  },
};
