import type { Size } from '../../core/image/resample.ts';

export const CROP_MODES = ['ratio', 'free'] as const;
export type CropMode = (typeof CROP_MODES)[number];

/** Fixed-ratio presets. `custom` uses `customWidth` : `customHeight`. */
export const CROP_RATIOS = [
  { id: '1:1', width: 1, height: 1 },
  { id: '4:3', width: 4, height: 3 },
  { id: '3:2', width: 3, height: 2 },
  { id: '16:9', width: 16, height: 9 },
  { id: '3:4', width: 3, height: 4 },
  { id: '2:3', width: 2, height: 3 },
  { id: '9:16', width: 9, height: 16 },
] as const;
export type CropRatioId = (typeof CROP_RATIOS)[number]['id'] | 'custom';

export const MAX_RATIO_TERM = 100;
/** Free crop must keep at least this much of each side, in percent. */
export const MIN_KEPT_PERCENT = 1;

/**
 * Crop options are relative (percent), not absolute pixels, so one setting
 * means the same thing for every image in a batch, whatever its size.
 */
export interface CropOptions {
  mode: CropMode;
  /** Ratio mode. */
  ratio: CropRatioId;
  customWidth: number;
  customHeight: number;
  /** Ratio mode: where the crop box sits on the spare axis, 0 = start, 100 = end. */
  positionX: number;
  positionY: number;
  /** Free mode: percent of the image removed from each edge. */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const cropDefaults: CropOptions = {
  mode: 'ratio',
  ratio: '1:1',
  customWidth: 5,
  customHeight: 4,
  positionX: 50,
  positionY: 50,
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
};

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const inRange = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;

function ratioTerms(options: CropOptions): { width: number; height: number } | undefined {
  if (options.ratio === 'custom') {
    return { width: options.customWidth, height: options.customHeight };
  }
  return CROP_RATIOS.find((candidate) => candidate.id === options.ratio);
}

/** Returns i18n error keys; empty array means valid. */
export function validateCrop(options: CropOptions): string[] {
  if (options.mode === 'ratio') {
    const terms = ratioTerms(options);
    if (!terms) return ['tools.crop.errors.ratio'];
    if (
      !inRange(terms.width, 1, MAX_RATIO_TERM) ||
      !inRange(terms.height, 1, MAX_RATIO_TERM) ||
      !Number.isInteger(terms.width) ||
      !Number.isInteger(terms.height)
    ) {
      return ['tools.crop.errors.customRatio'];
    }
    return inRange(options.positionX, 0, 100) && inRange(options.positionY, 0, 100)
      ? []
      : ['tools.crop.errors.position'];
  }
  if (options.mode === 'free') {
    const edges = [options.left, options.top, options.right, options.bottom];
    if (!edges.every((edge) => inRange(edge, 0, 100 - MIN_KEPT_PERCENT))) {
      return ['tools.crop.errors.edges'];
    }
    const keptWidth = 100 - options.left - options.right;
    const keptHeight = 100 - options.top - options.bottom;
    return keptWidth >= MIN_KEPT_PERCENT && keptHeight >= MIN_KEPT_PERCENT
      ? []
      : ['tools.crop.errors.edges'];
  }
  return ['tools.crop.errors.mode'];
}

/**
 * The region of `source` to keep, in whole pixels, always inside the image and
 * at least 1x1. Assumes `options` passed `validateCrop`. A crop never grows the
 * image, so the memory guard (`ctx.maxPixels`) cannot be exceeded by this step.
 */
export function computeCropRect(source: Size, options: CropOptions): CropRect {
  if (options.mode === 'free') {
    const x = Math.min(Math.round((source.width * options.left) / 100), source.width - 1);
    const y = Math.min(Math.round((source.height * options.top) / 100), source.height - 1);
    const right = Math.round((source.width * options.right) / 100);
    const bottom = Math.round((source.height * options.bottom) / 100);
    return {
      x,
      y,
      width: Math.max(1, source.width - x - right),
      height: Math.max(1, source.height - y - bottom),
    };
  }

  const terms = ratioTerms(options)!;
  // The largest box of the wanted ratio that fits inside the image.
  const scale = Math.min(source.width / terms.width, source.height / terms.height);
  const width = Math.min(source.width, Math.max(1, Math.round(terms.width * scale)));
  const height = Math.min(source.height, Math.max(1, Math.round(terms.height * scale)));
  return {
    x: Math.round(((source.width - width) * options.positionX) / 100),
    y: Math.round(((source.height - height) * options.positionY) / 100),
    width,
    height,
  };
}
