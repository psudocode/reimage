import { computeCropRect, validateCrop, type CropOptions } from './options.ts';

/**
 * The crop box as the canvas draws it, in percent of the image (0..100). It is a
 * view of `CropOptions`, never a second source of truth: every drag turns back
 * into options, so a batch of different sizes still crops the same way.
 */
export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CROP_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type CropHandle = (typeof CROP_HANDLES)[number];

/** The box can't be dragged smaller than this, so its handles stay reachable. */
export const MIN_BOX_PERCENT = 5;

const FULL_BOX: CropBox = { x: 0, y: 0, width: 100, height: 100 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** One decimal is plenty for a crop and keeps stored options readable. */
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Where the box sits for these options. `aspect` is image width / height; the
 * fixed-ratio mode needs it because the box is the largest one of that ratio
 * that fits. Invalid options show the whole image.
 */
export function boxFromOptions(options: CropOptions, aspect: number): CropBox {
  if (validateCrop(options).length > 0 || !(aspect > 0)) return FULL_BOX;
  if (options.mode === 'free') {
    return {
      x: options.left,
      y: options.top,
      width: 100 - options.left - options.right,
      height: 100 - options.top - options.bottom,
    };
  }
  const scale = 10_000;
  const size = { width: Math.max(1, Math.round(aspect * scale)), height: scale };
  const rect = computeCropRect(size, options);
  return {
    x: (rect.x / size.width) * 100,
    y: (rect.y / size.height) * 100,
    width: (rect.width / size.width) * 100,
    height: (rect.height / size.height) * 100,
  };
}

function boxToEdges(box: CropBox): Pick<CropOptions, 'left' | 'top' | 'right' | 'bottom'> {
  return {
    left: round1(box.x),
    top: round1(box.y),
    right: round1(100 - box.x - box.width),
    bottom: round1(100 - box.y - box.height),
  };
}

/**
 * Moves the box by `dx`/`dy` (percent of the image), starting from `start`.
 * Free mode shifts all four edges. Fixed-ratio mode can only slide along the
 * axis with room to spare, which is what its position options mean.
 */
export function moveCropBox(
  start: CropOptions,
  aspect: number,
  dx: number,
  dy: number,
): CropOptions {
  const box = boxFromOptions(start, aspect);
  const x = clamp(box.x + dx, 0, 100 - box.width);
  const y = clamp(box.y + dy, 0, 100 - box.height);
  if (start.mode === 'free') {
    return { ...start, ...boxToEdges({ ...box, x, y }) };
  }
  const spareX = 100 - box.width;
  const spareY = 100 - box.height;
  return {
    ...start,
    positionX: spareX > 0.01 ? round1((x / spareX) * 100) : start.positionX,
    positionY: spareY > 0.01 ? round1((y / spareY) * 100) : start.positionY,
  };
}

/**
 * Drags one handle by `dx`/`dy` (percent), starting from `start`. Only the free
 * mode resizes; a fixed ratio keeps its shape, so the options come back as-is.
 */
export function resizeCropBox(
  start: CropOptions,
  aspect: number,
  handle: CropHandle,
  dx: number,
  dy: number,
): CropOptions {
  if (start.mode !== 'free') return start;
  const box = boxFromOptions(start, aspect);
  let { x, y, width, height } = box;
  if (handle.includes('w')) {
    const next = clamp(x + dx, 0, x + width - MIN_BOX_PERCENT);
    width += x - next;
    x = next;
  }
  if (handle.includes('e')) width = clamp(width + dx, MIN_BOX_PERCENT, 100 - x);
  if (handle.includes('n')) {
    const next = clamp(y + dy, 0, y + height - MIN_BOX_PERCENT);
    height += y - next;
    y = next;
  }
  if (handle.includes('s')) height = clamp(height + dy, MIN_BOX_PERCENT, 100 - y);
  return { ...start, ...boxToEdges({ x, y, width, height }) };
}
