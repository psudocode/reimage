import type { OutputSettings } from '../../core/pipeline/types.ts';

export interface CompressOptions {
  /** `quality`: fixed quality. `targetSize`: search for the best quality under `targetKb`. */
  mode: 'quality' | 'targetSize';
  /** 1-100. Used when `mode` is `quality`. */
  quality: number;
  /** Kilobytes (1 KB = 1000 bytes). Used when `mode` is `targetSize`. */
  targetKb: number;
}

export const compressDefaults: CompressOptions = {
  mode: 'quality',
  quality: 75,
  targetKb: 200,
};

export const BYTES_PER_KB = 1000;
export const MAX_TARGET_KB = 100_000;

/** Returns i18n error keys; empty array means valid. */
export function validateCompress(options: CompressOptions): string[] {
  const errors: string[] = [];
  if (options.mode === 'quality') {
    if (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100) {
      errors.push('tools.compress.errors.quality');
    }
  } else if (
    !Number.isFinite(options.targetKb) ||
    options.targetKb < 1 ||
    options.targetKb > MAX_TARGET_KB
  ) {
    errors.push('tools.compress.errors.target');
  }
  return errors;
}

/**
 * Compression happens when the pipeline's output is encoded (technical.md §6),
 * so this tool contributes output settings rather than transforming pixels.
 * The UI merges the result into `Pipeline.output`.
 */
export function toOutputSettings(
  options: CompressOptions,
): Pick<OutputSettings, 'quality' | 'targetBytes'> {
  if (options.mode === 'targetSize') {
    return { quality: undefined, targetBytes: Math.round(options.targetKb * BYTES_PER_KB) };
  }
  return { quality: Math.round(options.quality), targetBytes: undefined };
}
