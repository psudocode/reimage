import { describe, expect, it } from 'vitest';
import {
  exceedsMaxPixels,
  getMaxPixels,
  getWorkerPoolSize,
  MAX_PIXELS_DEFAULT,
  MAX_PIXELS_LOW_MEMORY,
} from './limits.ts';

describe('limits', () => {
  it('uses lower pixel cap when deviceMemory <= 4 GB', () => {
    expect(getMaxPixels(4)).toBe(MAX_PIXELS_LOW_MEMORY);
    expect(getMaxPixels(2)).toBe(MAX_PIXELS_LOW_MEMORY);
    expect(getMaxPixels(8)).toBe(MAX_PIXELS_DEFAULT);
  });

  it('caps worker pool size based on cores and deviceMemory', () => {
    expect(getWorkerPoolSize(1, 8)).toBe(1);
    expect(getWorkerPoolSize(8, 8)).toBe(4);
    expect(getWorkerPoolSize(8, 4)).toBe(2);
    expect(getWorkerPoolSize(2, 4)).toBe(1);
  });

  it('detects when image dimensions exceed max pixels', () => {
    expect(exceedsMaxPixels(5000, 5001, 4)).toBe(true);
    expect(exceedsMaxPixels(5000, 5000, 4)).toBe(false);
    expect(exceedsMaxPixels(7000, 7000, 8)).toBe(false);
    expect(exceedsMaxPixels(0, 100, 4)).toBe(false);
  });
});
