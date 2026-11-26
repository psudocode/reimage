import { describe, expect, it, vi } from 'vitest';
import {
  DOWNSCALE_FACTOR,
  MAX_DOWNSCALES,
  MAX_ITERATIONS,
  MIN_QUALITY,
  searchTargetSize,
  type TargetSizeDeps,
} from './targetSize.ts';

interface FakeBitmap {
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
}
const bitmap = (width: number, height: number): FakeBitmap => ({ width, height, close: vi.fn() });

/** Size grows with quality and with pixel count: 1 byte per quality point per 1000 pixels. */
const sizeOf = (b: FakeBitmap, quality: number) =>
  Math.round((b.width * b.height * quality) / 1000);

function makeDeps(lossy = true) {
  const created: FakeBitmap[] = [];
  const encode = vi.fn(async (b: FakeBitmap, quality: number) => {
    return new Blob([new Uint8Array(sizeOf(b, quality))]);
  });
  const resize = vi.fn(async (_b: FakeBitmap, w: number, h: number) => {
    const next = bitmap(w, h);
    created.push(next);
    return next;
  });
  const deps: TargetSizeDeps<FakeBitmap> = { encode, resize, lossy };
  return { deps, encode, resize, created };
}

describe('searchTargetSize', () => {
  it('returns max quality immediately when the image already fits', async () => {
    const { deps, encode } = makeDeps();
    const input = bitmap(100, 100); // 10_000 px -> 1000 bytes at q100
    const result = await searchTargetSize(input, 5000, deps);
    expect(result).toMatchObject({ quality: 100, downscaled: false, targetMet: true, encodes: 1 });
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('finds the highest quality under the target, never exceeding it', async () => {
    const { deps } = makeDeps();
    const input = bitmap(1000, 1000); // q * 1000 bytes
    const target = 62_500; // between q60 and q65
    const result = await searchTargetSize(input, target, deps);
    expect(result.targetMet).toBe(true);
    expect(result.downscaled).toBe(false);
    expect(result.blob.size).toBeLessThanOrEqual(target);
    expect(result.blob.size).toBeGreaterThanOrEqual(target * 0.9);
    expect(result.encodes).toBeLessThanOrEqual(MAX_ITERATIONS);
  });

  it('stops early once within 3% below the target', async () => {
    const { deps } = makeDeps();
    const input = bitmap(1000, 1000);
    // q55 = 55_000 B; the first bisect probe (mid of 10..100) lands exactly on it.
    const result = await searchTargetSize(input, 55_500, deps);
    expect(result.quality).toBe(55);
    expect(result.encodes).toBe(3);
  });

  it('never uses more than MAX_ITERATIONS encodes per resolution', async () => {
    for (const target of [12_000, 33_333, 77_777, 99_000]) {
      const { deps } = makeDeps();
      const result = await searchTargetSize(bitmap(1000, 1000), target, deps);
      expect(result.encodes).toBeLessThanOrEqual(MAX_ITERATIONS);
      expect(result.blob.size).toBeLessThanOrEqual(target);
    }
  });

  it('downscales 10% per side when even minimum quality is too big', async () => {
    const { deps, resize } = makeDeps();
    const input = bitmap(1000, 1000);
    // q10 at 1000x1000 = 10_000 B. Target 8_000 needs one 0.9 downscale (810k px -> 8_100 B)… then another.
    const result = await searchTargetSize(input, 8_000, deps);
    expect(result.downscaled).toBe(true);
    expect(result.targetMet).toBe(true);
    expect(result.blob.size).toBeLessThanOrEqual(8_000);
    expect(resize).toHaveBeenCalledWith(expect.anything(), 900, 900);
    expect(result.width).toBeLessThan(1000);
  });

  it('gives up after MAX_DOWNSCALES and reports the target as missed', async () => {
    const { deps, resize } = makeDeps();
    const result = await searchTargetSize(bitmap(1000, 1000), 100, deps);
    expect(resize).toHaveBeenCalledTimes(MAX_DOWNSCALES);
    expect(result.targetMet).toBe(false);
    expect(result.downscaled).toBe(true);
    expect(result.quality).toBe(MIN_QUALITY);
    const scale = DOWNSCALE_FACTOR ** MAX_DOWNSCALES;
    expect(result.width).toBe(Math.round(Math.round(Math.round(1000 * 0.9) * 0.9) * 0.9));
    expect(result.width).toBeCloseTo(1000 * scale, -1);
  });

  it('closes bitmaps it created but never the caller-owned input', async () => {
    const { deps, created } = makeDeps();
    const input = bitmap(1000, 1000);
    await searchTargetSize(input, 100, deps);
    expect(input.close).not.toHaveBeenCalled();
    expect(created).toHaveLength(MAX_DOWNSCALES);
    for (const b of created) expect(b.close).toHaveBeenCalledTimes(1);
  });

  it('skips the quality search for lossless codecs and goes straight to downscaling', async () => {
    const { deps, encode, resize } = makeDeps(false);
    const result = await searchTargetSize(bitmap(1000, 1000), 90_000, deps);
    // Lossless size here is quality-independent (encoded at "100"): 100_000 B, needs downscaling.
    expect(result.quality).toBeUndefined();
    expect(result.downscaled).toBe(true);
    expect(result.targetMet).toBe(true);
    expect(resize).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledTimes(2);
  });

  it('propagates encoder errors and still closes created bitmaps', async () => {
    const { deps, created } = makeDeps();
    let calls = 0;
    deps.encode = vi.fn(async (b: FakeBitmap, q: number) => {
      calls += 1;
      if (calls > 2) throw new Error('wasm oom');
      return new Blob([new Uint8Array(sizeOf(b, q))]);
    });
    await expect(searchTargetSize(bitmap(1000, 1000), 100, deps)).rejects.toThrow('wasm oom');
    for (const b of created) expect(b.close).toHaveBeenCalled();
  });

  it('rejects a non-positive target', async () => {
    const { deps } = makeDeps();
    await expect(searchTargetSize(bitmap(10, 10), 0, deps)).rejects.toBeInstanceOf(RangeError);
  });

  it('stops at 1x1 instead of looping forever', async () => {
    const { deps } = makeDeps();
    const result = await searchTargetSize(bitmap(1, 1), 0.0001, {
      ...deps,
      encode: async () => new Blob([new Uint8Array(10)]),
    });
    expect(result.targetMet).toBe(false);
  });
});
