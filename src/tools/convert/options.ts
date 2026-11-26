import type { OutputSettings } from '../../core/pipeline/types.ts';

export const CONVERT_FORMATS = ['jpeg', 'png', 'webp', 'avif'] as const;
export type ConvertFormat = (typeof CONVERT_FORMATS)[number];

export interface ConvertOptions {
  format: ConvertFormat;
  /** 1-100. Ignored for PNG, which is lossless. */
  quality: number;
}

export const convertDefaults: ConvertOptions = {
  format: 'webp',
  quality: 80,
};

/** PNG is lossless, so the quality slider has no effect on it. */
export function isLossyFormat(format: ConvertFormat): boolean {
  return format !== 'png';
}

/** Returns i18n error keys; empty array means valid. */
export function validateConvert(options: ConvertOptions): string[] {
  const errors: string[] = [];
  if (!(CONVERT_FORMATS as readonly string[]).includes(options.format)) {
    errors.push('tools.convert.errors.format');
  } else if (
    isLossyFormat(options.format) &&
    (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100)
  ) {
    errors.push('tools.convert.errors.quality');
  }
  return errors;
}

/** Convert changes the encoder, not the pixels, so it contributes output settings. */
export function toOutputSettings(
  options: ConvertOptions,
): Pick<OutputSettings, 'format' | 'quality' | 'targetBytes'> {
  return {
    format: options.format,
    quality: isLossyFormat(options.format) ? Math.round(options.quality) : undefined,
    targetBytes: undefined,
  };
}
