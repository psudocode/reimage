import { fitWithinMaxPixels } from '../../core/image/resample.ts';

export const CROP_MODES = ['ratio', 'free'] as const;
export type CropMode = (typeof CROP_MODES)[number];

/** `custom` uses `ratioWidth` : `ratioHeight`. */
export const CROP_RATIOS = [
  { id: '1:1', width: 1, height: 1 },
  { id: '4:3', width: 4, height: 3 },
  { id: '3:2', width: 3, height: 2 },
  { id: '16:9', width: 16, height: 9 },
  { id: '9:16', width: 9, height: 16 },
  { id: '3:4', width: 3, height: 4 },
] as const;
export type CropRatioId = (typeof CROP_RATIOS)[number]['id'] | 'custom';

export const MAX_RATIO_TERM = 100;

export interface CropOptions {
  mode: CropMode;
  /**
   * Free mode: the box as percentages of the image (0-100), so one setting
   * works for a batch of images with different sizes.
   */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Ratio mode: the largest box with this ratio, placed with `offsetX` / `offsetY`. */
  ratio: CropRatioId;
  ratioWidth: number;
  ratioHeight: number;
  /** Ratio mode: 0 = left / top edge, 50 = centred, 100 = right / bottom edge. */
  offsetX: number;
  offsetY: number;
}

export const cropDefaults: CropOptions = {
  mode: 'ratio',
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  ratio: '1:1',
  ratioWidth: 1,
  ratioHeight: 1,
  offsetX: 50,
  offsetY: 50,
};

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const inRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

/** Returns i18n error keys; empty array means valid. */
export function validateCrop(options: CropOptions): string[] {
  if (options.mode === 'free') {
    const { left, top, width, height } = options;
    if (!inRange(left, 0, 99) || !inRange(top, 0, 99) || !inRange(width, 1, 100)) {
      return ['tools.crop.errors.box'];
    }
    if (!inRange(height, 1, 100) || left + width > 100 + 1e-9 || top + height > 100 + 1e-9) {
      return ['tools.crop.errors.box'];
    }
    return [];
  }
  if (options.mode !== 'ratio') return ['tools.crop.errors.box'];
  const errors: string[] = [];
  const known = options.ratio === 'custom' || CROP_RATIOS.some((r) => r.id === options.ratio);
  if (!known) errors.push('tools.crop.errors.ratio');
  else if (
    options.ratio === 'custom' &&
    !(
      inRange(options.ratioWidth, 1, MAX_RATIO_TERM) &&
      inRange(options.ratioHeight, 1, MAX_RATIO_TERM)
    )
  ) {
    errors.push('tools.crop.errors.ratio');
  }
  if (!inRange(options.offsetX, 0, 100) || !inRange(options.offsetY, 0, 100)) {
    errors.push('tools.crop.errors.offset');
  }
  return errors;
}

function ratioOf(options: CropOptions): number {
  if (options.ratio === 'custom') return options.ratioWidth / options.ratioHeight;
  const preset = CROP_RATIOS.find((r) => r.id === options.ratio)!;
  return preset.width / preset.height;
}

/**
 * The source rectangle, in whole pixels, always inside the image and at least
 * 1 x 1. Assumes `options` passed `validateCrop`.
 */
export function computeCropRect(
  source: { width: number; height: number },
  options: CropOptions,
): CropRect {
  let x: number;
  let y: number;
  let width: number;
  let height: number;
  if (options.mode === 'free') {
    x = (source.width * options.left) / 100;
    y = (source.height * options.top) / 100;
    width = (source.width * options.width) / 100;
    height = (source.height * options.height) / 100;
  } else {
    const ratio = ratioOf(options);
    if (source.width / source.height > ratio) {
      height = source.height;
      width = height * ratio;
    } else {
      width = source.width;
      height = width / ratio;
    }
    x = ((source.width - width) * options.offsetX) / 100;
    y = ((source.height - height) * options.offsetY) / 100;
  }
  const rx = Math.min(Math.round(x), source.width - 1);
  const ry = Math.min(Math.round(y), source.height - 1);
  return {
    x: rx,
    y: ry,
    width: Math.max(1, Math.min(Math.round(width), source.width - rx)),
    height: Math.max(1, Math.min(Math.round(height), source.height - ry)),
  };
}

/** The output size for `rect`, capped by the memory guard (keeps the aspect ratio). */
export function cropOutputSize(rect: CropRect, maxPixels: number) {
  return fitWithinMaxPixels({ width: rect.width, height: rect.height }, maxPixels);
}
