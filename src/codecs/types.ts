export type CodecId = 'jpeg' | 'png' | 'webp' | 'avif';

/** Raw RGBA pixels. Structurally compatible with the DOM `ImageData`. */
export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface EncodeParams {
  /** 0-100. Ignored by lossless codecs (PNG). */
  quality?: number;
}

export interface Codec {
  id: CodecId;
  mimeType: string;
  extension: string;
  /** Whether `quality` has any effect. PNG is lossless. */
  lossy: boolean;
  /** Whether the format can carry transparency. JPEG cannot. */
  supportsAlpha: boolean;
  encode(image: RawImage, params?: EncodeParams): Promise<ArrayBuffer>;
}

/**
 * Test/override seam: runs right after a codec's JS module is imported and
 * before first use, e.g. to hand it a pre-compiled WebAssembly.Module.
 */
export type InitHook<M> = (module: M) => Promise<void> | void;

export function clampQuality(quality: number | undefined, fallback: number): number {
  if (quality === undefined || Number.isNaN(quality)) return fallback;
  return Math.min(100, Math.max(0, Math.round(quality)));
}
