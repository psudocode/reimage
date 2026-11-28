import { fitWithinMaxPixels, type Size } from '../../core/image/resample.ts';

export const EXPAND_MODES = ['all', 'sides'] as const;
export type ExpandMode = (typeof EXPAND_MODES)[number];

export const EXPAND_BACKGROUNDS = ['transparent', 'color'] as const;
export type ExpandBackground = (typeof EXPAND_BACKGROUNDS)[number];

/** Per-side cap on the padding, on top of the pixel-count memory guard. */
export const MAX_PADDING = 8192;

export interface ExpandOptions {
  /** `all` = one padding for every side; `sides` = a padding per side. */
  mode: ExpandMode;
  /** Padding in pixels for `all` mode. */
  all: number;
  /** Padding in pixels per side for `sides` mode. */
  top: number;
  right: number;
  bottom: number;
  left: number;
  background: ExpandBackground;
  /** `#rrggbb`. Used when `background` is `color`. */
  color: string;
}

export const expandDefaults: ExpandOptions = {
  mode: 'all',
  all: 50,
  top: 50,
  right: 50,
  bottom: 50,
  left: 50,
  background: 'color',
  color: '#ffffff',
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isValidPadding(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PADDING;
}

/** Returns i18n error keys; empty array means valid. */
export function validateExpand(options: ExpandOptions): string[] {
  const errors: string[] = [];
  if (!EXPAND_MODES.includes(options.mode)) return ['tools.expand.errors.mode'];
  const sides = options.mode === 'all' ? [options.all] : paddingValues(options);
  if (!sides.every(isValidPadding)) errors.push('tools.expand.errors.padding');
  else if (sides.every((side) => side === 0)) errors.push('tools.expand.errors.empty');
  if (!EXPAND_BACKGROUNDS.includes(options.background)) {
    errors.push('tools.expand.errors.background');
  } else if (options.background === 'color' && !HEX_COLOR.test(options.color)) {
    errors.push('tools.expand.errors.color');
  }
  return errors;
}

function paddingValues(options: ExpandOptions): number[] {
  return [options.top, options.right, options.bottom, options.left];
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function resolvePadding(options: ExpandOptions): Padding {
  if (options.mode === 'all') {
    const all = options.all;
    return { top: all, right: all, bottom: all, left: all };
  }
  const { top, right, bottom, left } = options;
  return { top, right, bottom, left };
}

export interface ExpandLayout {
  /** The output canvas. */
  canvas: Size;
  /** Where the source image goes on that canvas. */
  image: { x: number; y: number; width: number; height: number };
}

/**
 * Where everything goes. Assumes `options` passed `validateExpand`. When the
 * padded canvas would break the memory guard, the whole layout (image and
 * padding) is scaled down together, keeping its proportions.
 */
export function computeExpandLayout(
  source: Size,
  options: ExpandOptions,
  maxPixels: number,
): ExpandLayout {
  const pad = resolvePadding(options);
  const full = {
    width: source.width + pad.left + pad.right,
    height: source.height + pad.top + pad.bottom,
  };
  const canvas = fitWithinMaxPixels(full, maxPixels);
  const sx = canvas.width / full.width;
  const sy = canvas.height / full.height;
  if (sx === 1 && sy === 1) {
    return {
      canvas,
      image: { x: pad.left, y: pad.top, width: source.width, height: source.height },
    };
  }
  return {
    canvas,
    image: {
      x: Math.round(pad.left * sx),
      y: Math.round(pad.top * sy),
      width: Math.max(1, Math.round(source.width * sx)),
      height: Math.max(1, Math.round(source.height * sy)),
    },
  };
}
