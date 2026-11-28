import type { OutputSettings } from '../../core/pipeline/types.ts';

export interface StripMetadataOptions {
  /**
   * Quality (1–100) used when re-encoding lossy formats (JPEG, WebP, AVIF).
   * Default is 90 for high visual fidelity while removing all metadata tags.
   */
  quality: number;
}

export const stripMetadataDefaults: StripMetadataOptions = {
  quality: 90,
};

export const MIN_QUALITY = 1;
export const MAX_QUALITY = 100;

/** Returns i18n error keys; empty array means valid. */
export function validateStripMetadata(options: StripMetadataOptions): string[] {
  const errors: string[] = [];
  if (
    !Number.isFinite(options.quality) ||
    options.quality < MIN_QUALITY ||
    options.quality > MAX_QUALITY
  ) {
    errors.push('tools.stripMetadata.errors.quality');
  }
  return errors;
}

/**
 * Stripping metadata drops EXIF, GPS, and other metadata segments during pipeline
 * encoding. Contributes output settings to enforce stripMetadata and output quality.
 */
export function toOutputSettings(
  options: StripMetadataOptions,
): Pick<OutputSettings, 'stripMetadata' | 'quality'> {
  return {
    stripMetadata: true,
    quality: Math.round(options.quality),
  };
}
