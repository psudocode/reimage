import { describe, expect, it } from 'vitest';
import { estimateFullSize, neighbourIndex, sliderPercent, swipeDirection } from './previewMath.ts';

describe('estimateFullSize', () => {
  it('returns the numbers unchanged for a full-size preview', () => {
    expect(
      estimateFullSize({ width: 800, height: 600, bytesAfter: 5000, previewScale: 1 }),
    ).toEqual({
      bytes: 5000,
      width: 800,
      height: 600,
    });
    expect(estimateFullSize({ width: 800, height: 600, bytesAfter: 5000 })).toMatchObject({
      bytes: 5000,
    });
  });

  it('scales dimensions by 1/scale and bytes by 1/scale²', () => {
    expect(
      estimateFullSize({ width: 1000, height: 500, bytesAfter: 20_000, previewScale: 0.25 }),
    ).toEqual({ bytes: 320_000, width: 4000, height: 2000 });
  });

  it('ignores a nonsensical scale', () => {
    expect(estimateFullSize({ width: 10, height: 10, bytesAfter: 7, previewScale: 0 })).toEqual({
      bytes: 7,
      width: 10,
      height: 10,
    });
  });
});

describe('sliderPercent', () => {
  const rect = { left: 100, width: 200 };
  it('maps the pointer to 0..100 and clamps', () => {
    expect(sliderPercent(200, rect)).toBe(50);
    expect(sliderPercent(0, rect)).toBe(0);
    expect(sliderPercent(999, rect)).toBe(100);
  });
  it('falls back to the middle for an empty box', () => {
    expect(sliderPercent(5, { left: 0, width: 0 })).toBe(50);
  });
});

describe('swipeDirection', () => {
  it('swipes left for the next image, right for the previous', () => {
    expect(swipeDirection(-80, 5)).toBe('next');
    expect(swipeDirection(80, -5)).toBe('previous');
  });
  it('ignores short and mostly vertical drags', () => {
    expect(swipeDirection(-20, 0)).toBeNull();
    expect(swipeDirection(-80, 90)).toBeNull();
  });
});

describe('neighbourIndex', () => {
  it('moves within bounds and stops at the ends', () => {
    expect(neighbourIndex(1, 3, 1)).toBe(2);
    expect(neighbourIndex(2, 3, 1)).toBe(2);
    expect(neighbourIndex(0, 3, -1)).toBe(0);
    expect(neighbourIndex(0, 0, 1)).toBe(0);
  });
});
