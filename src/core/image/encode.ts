import type { OutputFormat, OutputSettings } from '../pipeline/types.ts';

/**
 * Output encoder contract. Phase 1 item "Lazy-loaded WASM codecs" replaces the
 * default implementation below with jSquash (MozJPEG, OxiPNG, libwebp, libavif).
 */
export type Encoder = (
  bitmap: ImageBitmap,
  output: OutputSettings,
  sourceType: string,
) => Promise<Blob>;

const MIME: Record<Exclude<OutputFormat, 'original'>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

/** Resolves 'original' to a concrete mime type based on the source file type. */
export function resolveMimeType(format: OutputFormat, sourceType: string): string {
  if (format !== 'original') return MIME[format];
  const known = Object.values(MIME);
  return known.includes(sourceType) ? sourceType : MIME.png;
}

/**
 * Baseline encoder using the browser's native encoders via OffscreenCanvas.
 * Good enough to exercise the worker pipeline end-to-end; no AVIF, no
 * target-size search. Superseded by the WASM codecs.
 */
export const nativeEncoder: Encoder = async (bitmap, output, sourceType) => {
  const type = resolveMimeType(output.format, sourceType);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available in this worker');
  context.drawImage(bitmap, 0, 0);

  const quality = output.quality === undefined ? undefined : output.quality / 100;
  const blob = await canvas.convertToBlob({ type, quality });
  // Browsers silently fall back to PNG for unsupported types (e.g. AVIF).
  if (blob.type !== type) {
    throw new Error(`Encoding to ${type} is not supported by this browser`);
  }
  return blob;
};
