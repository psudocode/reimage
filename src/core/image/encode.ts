import { codecs, type CodecId, type CodecRegistry, type RawImage } from '../../codecs/index.ts';
import type { OutputFormat, OutputSettings } from '../pipeline/types.ts';
import { resampleBitmap } from './resample.ts';
import { searchTargetSize } from './targetSize.ts';

/**
 * Output encoder contract: one decoded bitmap in, one encoded Blob out.
 * Encoding happens once, at the end of a pipeline (technical.md §6).
 */
export interface EncodeResult {
  blob: Blob;
  width: number;
  height: number;
  /** True when the target-size search had to shrink the image. */
  downscaled?: boolean;
  /** False when `targetBytes` could not be reached even after downscaling. */
  targetMissed?: boolean;
}

export type Encoder = (
  bitmap: ImageBitmap,
  output: OutputSettings,
  sourceType: string,
) => Promise<EncodeResult>;

const MIME_TO_CODEC: Record<string, CodecId> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * Resolves the output format to a codec. `original` keeps the source format
 * when we can encode it; anything else (GIF, BMP, HEIC, ...) becomes PNG so no
 * quality is lost.
 */
export function resolveCodecId(format: OutputFormat, sourceType: string): CodecId {
  if (format !== 'original') return format;
  return MIME_TO_CODEC[sourceType] ?? 'png';
}

export interface ReadPixelsOptions {
  /** Fill colour painted under the image first (used to flatten alpha for JPEG). */
  background?: string;
}

export type ReadPixels = (bitmap: ImageBitmap, options?: ReadPixelsOptions) => RawImage;

/** Reads RGBA pixels back from a bitmap via OffscreenCanvas. */
export const readPixelsFromBitmap: ReadPixels = (bitmap, options = {}) => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas is not available in this worker');
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, bitmap.width, bitmap.height);
  }
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
};

export type ResizeBitmap = (
  bitmap: ImageBitmap,
  width: number,
  height: number,
) => Promise<ImageBitmap>;

/**
 * Encoder backed by the lazy-loaded WASM codecs (MozJPEG, OxiPNG, libwebp,
 * libavif). When `output.targetBytes` is set, searches for the best quality
 * that fits (see `targetSize.ts`).
 */
export function createWasmEncoder(
  registry: CodecRegistry = codecs,
  readPixels: ReadPixels = readPixelsFromBitmap,
  resize: ResizeBitmap = (bitmap, width, height) => resampleBitmap(bitmap, width, height),
): Encoder {
  return async (bitmap, output, sourceType) => {
    const codec = registry.get(resolveCodecId(output.format, sourceType));
    // JPEG has no alpha channel: flatten onto white instead of letting
    // transparent pixels turn black.
    const readOptions = codec.supportsAlpha ? {} : { background: '#ffffff' };
    const encodeAt = async (source: ImageBitmap, quality: number | undefined) => {
      const bytes = await codec.encode(readPixels(source, readOptions), { quality });
      return new Blob([bytes], { type: codec.mimeType });
    };

    if (output.targetBytes === undefined) {
      const blob = await encodeAt(bitmap, output.quality);
      return { blob, width: bitmap.width, height: bitmap.height };
    }

    const found = await searchTargetSize(bitmap, output.targetBytes, {
      encode: encodeAt,
      resize,
      lossy: codec.lossy,
    });
    return {
      blob: found.blob,
      width: found.width,
      height: found.height,
      ...(found.downscaled ? { downscaled: true } : {}),
      ...(found.targetMet ? {} : { targetMissed: true }),
    };
  };
}

export const wasmEncoder: Encoder = createWasmEncoder();
