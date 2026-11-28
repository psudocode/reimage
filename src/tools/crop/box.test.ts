import { describe, expect, it } from 'vitest';
import { boxFromOptions, moveCropBox, resizeCropBox } from './box.ts';
import { computeCropRect, cropDefaults, validateCrop, type CropOptions } from './options.ts';

const free = (patch: Partial<CropOptions> = {}): CropOptions => ({
  ...cropDefaults,
  mode: 'free',
  ...patch,
});

describe('boxFromOptions', () => {
  it('turns free-mode edges into a box', () => {
    expect(boxFromOptions(free({ left: 10, top: 20, right: 30, bottom: 5 }), 1.5)).toEqual({
      x: 10,
      y: 20,
      width: 60,
      height: 75,
    });
  });

  it('draws the largest box of a fixed ratio, centred by default', () => {
    // 4:3 photo cropped to 1:1 keeps 75% of the width, all of the height.
    const box = boxFromOptions({ ...cropDefaults, ratio: '1:1' }, 4 / 3);
    expect(box.width).toBeCloseTo(75, 1);
    expect(box.height).toBeCloseTo(100, 1);
    expect(box.x).toBeCloseTo(12.5, 1);
    expect(box.y).toBe(0);
  });

  it('agrees with the rectangle the worker will cut', () => {
    const options: CropOptions = { ...cropDefaults, ratio: '16:9', positionY: 30 };
    const aspect = 3 / 4;
    const box = boxFromOptions(options, aspect);
    const rect = computeCropRect({ width: 3000, height: 4000 }, options);
    expect(box.x).toBeCloseTo((rect.x / 3000) * 100, 1);
    expect(box.y).toBeCloseTo((rect.y / 4000) * 100, 1);
    expect(box.width).toBeCloseTo((rect.width / 3000) * 100, 1);
    expect(box.height).toBeCloseTo((rect.height / 4000) * 100, 1);
  });

  it('falls back to the whole image for invalid options or aspect', () => {
    const whole = { x: 0, y: 0, width: 100, height: 100 };
    expect(boxFromOptions(free({ left: NaN }), 1)).toEqual(whole);
    expect(boxFromOptions(free({ left: 60, right: 60 }), 1)).toEqual(whole);
    expect(boxFromOptions(free(), 0)).toEqual(whole);
  });
});

describe('moveCropBox (free)', () => {
  const start = free({ left: 10, top: 10, right: 50, bottom: 50 });

  it('shifts the box and keeps its size', () => {
    const next = moveCropBox(start, 1, 20, 5);
    expect(boxFromOptions(next, 1)).toEqual({ x: 30, y: 15, width: 40, height: 40 });
    expect(validateCrop(next)).toEqual([]);
  });

  it('stops at the image edges', () => {
    const next = moveCropBox(start, 1, 500, -500);
    expect(boxFromOptions(next, 1)).toEqual({ x: 60, y: 0, width: 40, height: 40 });
  });
});

describe('moveCropBox (fixed ratio)', () => {
  const start: CropOptions = { ...cropDefaults, ratio: '1:1', positionX: 50, positionY: 50 };

  it('slides along the spare axis only', () => {
    // Landscape 2:1 image: a square has spare room horizontally (50%), none vertically.
    const next = moveCropBox(start, 2, 10, 30);
    expect(next.positionX).toBe(70);
    expect(next.positionY).toBe(50);
    expect(next.mode).toBe('ratio');
    expect(next.ratio).toBe('1:1');
  });

  it('clamps the position to 0..100', () => {
    expect(moveCropBox(start, 2, -999, 0).positionX).toBe(0);
    expect(moveCropBox(start, 2, 999, 0).positionX).toBe(100);
  });
});

describe('resizeCropBox', () => {
  const start = free({ left: 20, top: 20, right: 20, bottom: 20 });

  it('drags the north-west corner', () => {
    const next = resizeCropBox(start, 1, 'nw', -10, 5);
    expect(boxFromOptions(next, 1)).toEqual({ x: 10, y: 25, width: 70, height: 55 });
  });

  it('drags single edges', () => {
    expect(resizeCropBox(start, 1, 'e', 10, 99)).toMatchObject({ right: 10, top: 20, bottom: 20 });
    expect(resizeCropBox(start, 1, 's', 99, -10)).toMatchObject({ bottom: 30, left: 20 });
  });

  it('keeps a usable minimum size and stays inside the image', () => {
    const tiny = resizeCropBox(start, 1, 'se', -500, -500);
    expect(boxFromOptions(tiny, 1)).toMatchObject({ width: 5, height: 5 });
    const outside = resizeCropBox(start, 1, 'nw', -500, -500);
    expect(boxFromOptions(outside, 1)).toMatchObject({ x: 0, y: 0 });
    expect(validateCrop(outside)).toEqual([]);
  });

  it('leaves a fixed ratio untouched', () => {
    const fixed: CropOptions = { ...cropDefaults, ratio: '4:3' };
    expect(resizeCropBox(fixed, 1, 'se', 10, 10)).toBe(fixed);
  });
});
