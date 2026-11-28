import { fitWithinMaxPixels, scaleSize, type Size } from '../../core/image/resample.ts';

export const RESIZE_MODES = ['pixels', 'percent', 'preset'] as const;
export type ResizeMode = (typeof RESIZE_MODES)[number];

/** Per-side cap, on top of the pixel-count memory guard. */
export const MAX_DIMENSION = 16_384;
export const MIN_PERCENT = 1;
export const MAX_PERCENT = 1000;

/** Preset boxes. A preset fits the image inside the box and never enlarges it. */
export const RESIZE_PRESETS = [
  { id: 'uhd', width: 3840, height: 2160 },
  { id: 'fhd', width: 1920, height: 1080 },
  { id: 'hd', width: 1280, height: 720 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'thumb', width: 320, height: 320 },
] as const;
export type ResizePresetId = (typeof RESIZE_PRESETS)[number]['id'];

export interface ResizeOptions {
  mode: ResizeMode;
  /** Pixels mode. `undefined` = not set. */
  width?: number;
  height?: number;
  /** Pixels mode: fit inside the box (or follow the one side given) instead of stretching. */
  keepAspect: boolean;
  /** Percent mode. */
  percent: number;
  /** Preset mode. */
  preset: ResizePresetId;
}

export const resizeDefaults: ResizeOptions = {
  mode: 'percent',
  width: undefined,
  height: undefined,
  keepAspect: true,
  percent: 50,
  preset: 'fhd',
};

function isValidSide(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 1 && value <= MAX_DIMENSION;
}

/** Returns i18n error keys; empty array means valid. */
export function validateResize(options: ResizeOptions): string[] {
  switch (options.mode) {
    case 'pixels': {
      const { width, height } = options;
      const given = [width, height].filter((side) => side !== undefined);
      if (!given.every(isValidSide)) {
        return [options.keepAspect ? 'tools.resize.errors.sizeLocked' : 'tools.resize.errors.size'];
      }
      if (options.keepAspect ? given.length === 0 : given.length < 2) {
        return [options.keepAspect ? 'tools.resize.errors.sizeLocked' : 'tools.resize.errors.size'];
      }
      return [];
    }
    case 'percent':
      return Number.isFinite(options.percent) &&
        options.percent >= MIN_PERCENT &&
        options.percent <= MAX_PERCENT
        ? []
        : ['tools.resize.errors.percent'];
    case 'preset':
      return RESIZE_PRESETS.some((preset) => preset.id === options.preset)
        ? []
        : ['tools.resize.errors.preset'];
    default:
      return ['tools.resize.errors.size'];
  }
}

function fitInside(source: Size, box: { width?: number; height?: number }, enlarge: boolean): Size {
  const ratios = [
    box.width === undefined ? Infinity : box.width / source.width,
    box.height === undefined ? Infinity : box.height / source.height,
  ];
  const factor = Math.min(...ratios, enlarge ? Infinity : 1);
  return scaleSize(source, factor);
}

/**
 * The output size for `source`. Assumes `options` passed `validateResize`.
 * The result is capped at `maxPixels` (the memory guard), keeping the aspect ratio.
 */
export function computeTargetSize(source: Size, options: ResizeOptions, maxPixels: number): Size {
  let target: Size;
  if (options.mode === 'percent') {
    target = scaleSize(source, options.percent / 100);
  } else if (options.mode === 'preset') {
    const preset = RESIZE_PRESETS.find((candidate) => candidate.id === options.preset)!;
    target = fitInside(source, preset, false);
  } else if (options.keepAspect) {
    target = fitInside(source, options, true);
  } else {
    target = { width: options.width!, height: options.height! };
  }
  return fitWithinMaxPixels(target, maxPixels);
}
