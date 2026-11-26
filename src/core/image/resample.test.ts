import { describe, expect, it, vi } from 'vitest';
import { fitWithinMaxPixels, resampleBitmap, scaleSize, type ResampleEngine } from './resample.ts';

function fakeCanvas(width: number, height: number) {
  const output = { width, height, close: vi.fn() } as unknown as ImageBitmap;
  const canvas = {
    width,
    height,
    transferToImageBitmap: vi.fn(() => output),
  } as unknown as OffscreenCanvas;
  return { canvas, output };
}

const input = { width: 4000, height: 3000, close: vi.fn() } as unknown as ImageBitmap;

describe('fitWithinMaxPixels', () => {
  it('returns the same size when it already fits', () => {
    expect(fitWithinMaxPixels({ width: 1000, height: 1000 }, 2_000_000)).toEqual({
      width: 1000,
      height: 1000,
    });
  });

  it('shrinks to fit while keeping the aspect ratio', () => {
    const result = fitWithinMaxPixels({ width: 8000, height: 6000 }, 12_000_000);
    expect(result.width * result.height).toBeLessThanOrEqual(12_000_000);
    expect(result.width / result.height).toBeCloseTo(8000 / 6000, 2);
  });

  it('never exceeds the limit for extreme aspect ratios', () => {
    const result = fitWithinMaxPixels({ width: 100_000, height: 3 }, 1000);
    expect(result.width * result.height).toBeLessThanOrEqual(1000);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-positive input', () => {
    expect(() => fitWithinMaxPixels({ width: 0, height: 10 }, 100)).toThrow(RangeError);
    expect(() => fitWithinMaxPixels({ width: 10, height: 10 }, 0)).toThrow(RangeError);
  });
});

describe('scaleSize', () => {
  it('scales and rounds', () => {
    expect(scaleSize({ width: 1001, height: 501 }, 0.5)).toEqual({ width: 501, height: 251 });
  });

  it('never goes below 1px', () => {
    expect(scaleSize({ width: 1, height: 2 }, 0.1)).toEqual({ width: 1, height: 1 });
  });

  it('rejects non-positive factors', () => {
    expect(() => scaleSize({ width: 10, height: 10 }, 0)).toThrow(RangeError);
  });
});

describe('resampleBitmap', () => {
  it('resizes into an offscreen canvas and returns the bitmap', async () => {
    const { canvas, output } = fakeCanvas(800, 600);
    const resize = vi.fn().mockResolvedValue(canvas);
    const engine: ResampleEngine = { resize };
    const createCanvas = vi.fn(() => canvas);

    const result = await resampleBitmap(
      input,
      800,
      600,
      { filter: 'lanczos3' },
      { engine, createCanvas },
    );

    expect(createCanvas).toHaveBeenCalledWith(800, 600);
    expect(resize).toHaveBeenCalledWith(
      input,
      canvas,
      expect.objectContaining({ filter: 'lanczos3' }),
    );
    expect(result).toBe(output);
  });

  it('does not close the input bitmap (caller owns it)', async () => {
    const { canvas } = fakeCanvas(10, 10);
    const engine: ResampleEngine = { resize: vi.fn().mockResolvedValue(canvas) };
    await resampleBitmap(input, 10, 10, {}, { engine, createCanvas: () => canvas });
    expect(input.close).not.toHaveBeenCalled();
  });

  it('rejects invalid target sizes before touching the engine', async () => {
    const resize = vi.fn();
    const engine: ResampleEngine = { resize };
    await expect(resampleBitmap(input, 0, 10, {}, { engine })).rejects.toThrow(RangeError);
    await expect(resampleBitmap(input, 10.5, 10, {}, { engine })).rejects.toThrow(RangeError);
    expect(resize).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const resize = vi.fn();
    await expect(
      resampleBitmap(input, 10, 10, { signal: controller.signal }, { engine: { resize } }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(resize).not.toHaveBeenCalled();
  });

  it('maps an abort during resize to AbortError', async () => {
    const { canvas } = fakeCanvas(10, 10);
    const controller = new AbortController();
    const engine: ResampleEngine = {
      resize: (_from, _to, opts) =>
        new Promise((_, reject) => {
          controller.abort();
          opts?.cancelToken?.catch(reject);
        }),
    };
    await expect(
      resampleBitmap(
        input,
        10,
        10,
        { signal: controller.signal },
        { engine, createCanvas: () => canvas },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('propagates engine errors', async () => {
    const { canvas } = fakeCanvas(10, 10);
    const engine: ResampleEngine = { resize: vi.fn().mockRejectedValue(new Error('wasm oom')) };
    await expect(
      resampleBitmap(input, 10, 10, {}, { engine, createCanvas: () => canvas }),
    ).rejects.toThrow('wasm oom');
  });
});
