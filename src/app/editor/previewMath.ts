import type { ImageResult } from '../../core/pipeline/types.ts';

export interface PreviewEstimate {
  /** Estimated size of the full-resolution output, in bytes. */
  bytes: number;
  width: number;
  height: number;
}

/**
 * A preview runs on a shrunken copy, so its numbers are small. This scales them
 * back up: dimensions by 1/scale, bytes by 1/scale² (bytes follow pixel count).
 * It is an estimate, so the UI marks it with "≈". Real sizes come from a run.
 */
export function estimateFullSize(
  result: Pick<ImageResult, 'width' | 'height' | 'bytesAfter' | 'previewScale'>,
): PreviewEstimate {
  const scale =
    result.previewScale !== undefined && result.previewScale > 0 ? result.previewScale : 1;
  if (scale >= 1) return { bytes: result.bytesAfter, width: result.width, height: result.height };
  return {
    bytes: Math.round(result.bytesAfter / (scale * scale)),
    width: Math.max(1, Math.round(result.width / scale)),
    height: Math.max(1, Math.round(result.height / scale)),
  };
}

/** Compare-slider position (0..100) for a pointer at `clientX` inside `rect`. */
export function sliderPercent(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) return 50;
  return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
}

/** Horizontal swipe → which image to show next. Ignores short or mostly vertical drags. */
export function swipeDirection(
  dx: number,
  dy: number,
  minDistance = 50,
): 'next' | 'previous' | null {
  if (Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'previous';
}

/** Index of the neighbour of `index` in a list of `length`, or `index` at the ends. */
export function neighbourIndex(index: number, length: number, step: 1 | -1): number {
  return Math.min(Math.max(index + step, 0), Math.max(length - 1, 0));
}
