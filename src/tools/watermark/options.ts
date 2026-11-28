import type { Size } from '../../core/image/resample.ts';

export const WATERMARK_MODES = ['text', 'image'] as const;
export type WatermarkMode = (typeof WATERMARK_MODES)[number];

/** Row-major 3x3 grid, so the Panel can render it as is. */
export const WATERMARK_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

export const MAX_TEXT_LENGTH = 200;
export const MIN_SIZE = 1;
export const MAX_SIZE = 100;
export const MIN_OPACITY = 1;
export const MAX_OPACITY = 100;
export const MAX_MARGIN = 25;

export interface WatermarkOptions {
  mode: WatermarkMode;
  /** Text mode. */
  text: string;
  /** Text mode: `#rrggbb`. */
  color: string;
  /** Image mode. The logo the user picked; `undefined` = none yet. */
  logo?: Blob;
  /** Text height (text) or logo width (image), as % of the image width. */
  size: number;
  /** 1 (almost invisible) to 100 (solid). */
  opacity: number;
  position: WatermarkPosition;
  /** Distance from the edges, as % of the image's shorter side. */
  margin: number;
}

export const watermarkDefaults: WatermarkOptions = {
  mode: 'text',
  text: '',
  color: '#ffffff',
  logo: undefined,
  size: 5,
  opacity: 60,
  position: 'bottom-right',
  margin: 3,
};

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** Returns i18n error keys; empty array means valid. */
export function validateWatermark(options: WatermarkOptions): string[] {
  const errors: string[] = [];
  if (options.mode === 'text') {
    const text = options.text.trim();
    if (text === '' || text.length > MAX_TEXT_LENGTH) errors.push('tools.watermark.errors.text');
    if (!/^#[0-9a-f]{6}$/i.test(options.color)) errors.push('tools.watermark.errors.color');
  } else if (options.mode === 'image') {
    if (!options.logo || !options.logo.type.startsWith('image/')) {
      errors.push('tools.watermark.errors.logo');
    }
  } else {
    errors.push('tools.watermark.errors.mode');
  }
  if (!inRange(options.size, MIN_SIZE, MAX_SIZE)) errors.push('tools.watermark.errors.size');
  if (!inRange(options.opacity, MIN_OPACITY, MAX_OPACITY)) {
    errors.push('tools.watermark.errors.opacity');
  }
  if (!inRange(options.margin, 0, MAX_MARGIN)) errors.push('tools.watermark.errors.margin');
  if (!WATERMARK_POSITIONS.includes(options.position)) {
    errors.push('tools.watermark.errors.position');
  }
  return errors;
}

/**
 * Top-left corner of a `mark` box inside `image` for a grid position. The margin
 * applies to the edges the mark is anchored to. A mark larger than the free
 * space is pinned to the top/left edge instead of going negative.
 */
export function placeWatermark(
  image: Size,
  mark: Size,
  position: WatermarkPosition,
  marginPercent: number,
): { x: number; y: number } {
  const margin = (Math.min(image.width, image.height) * marginPercent) / 100;
  const [row, column] = position === 'center' ? ['middle', 'center'] : position.split('-');
  const place = (free: number, start: boolean, end: boolean) => {
    if (start) return Math.max(margin, 0);
    if (end) return Math.max(free - margin, 0);
    return Math.max(free / 2, 0);
  };
  return {
    x: place(image.width - mark.width, column === 'left', column === 'right'),
    y: place(image.height - mark.height, row === 'top', row === 'bottom'),
  };
}

/** Logo box: `size`% of the image width, keeping the logo's aspect ratio. */
export function computeLogoSize(image: Size, logo: Size, sizePercent: number): Size {
  const width = Math.max(1, Math.round((image.width * sizePercent) / 100));
  const height = Math.max(1, Math.round((width * logo.height) / logo.width));
  return { width, height };
}

/** Font size in px for a given image width. */
export function computeFontSize(imageWidth: number, sizePercent: number): number {
  return Math.max(1, Math.round((imageWidth * sizePercent) / 100));
}
