import type { OutputSettings } from '../../core/pipeline/types.ts';

export interface StripMetadataOptions {
  /**
   * 1-100. Stripping re-encodes lossy files (JPEG, WebP, AVIF) from their
   * pixels, so this keeps the loss small. PNG ignores it.
   */
  quality: number;
}

export const stripMetadataDefaults: StripMetadataOptions = { quality: 92 };

/** Returns i18n error keys; empty array means valid. */
export function validateStripMetadata(options: StripMetadataOptions): string[] {
  return Number.isFinite(options.quality) && options.quality >= 1 && options.quality <= 100
    ? []
    : ['tools.stripMetadata.errors.quality'];
}

/**
 * Every image is decoded to raw pixels and encoded again from scratch, and the
 * codecs write only pixels. EXIF, GPS, XMP, IPTC and embedded thumbnails never
 * reach the output. The tool only decides how that re-encode is done: the
 * original format, at a high quality.
 */
export function toOutputSettings(options: StripMetadataOptions): Pick<OutputSettings, 'quality'> {
  return { quality: Math.round(options.quality) };
}
