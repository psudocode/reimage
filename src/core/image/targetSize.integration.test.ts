// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createJpegCodec } from '../../codecs/jpeg.ts';
import { createCodecRegistry, type RawImage } from '../../codecs/index.ts';
import { createWasmEncoder } from './encode.ts';

/**
 * End-to-end check of the target-size search against the REAL MozJPEG encoder
 * (WASM, under Node). Only the pixel source and resizer are faked.
 */
const require = createRequire(import.meta.url);
const wasm = (file: string) =>
  new WebAssembly.Module(
    readFileSync(join(dirname(require.resolve('@jsquash/jpeg/package.json')), file)),
  );

const jpeg = createJpegCodec(async (module) => {
  await (module as { init: (m: WebAssembly.Module) => Promise<void> }).init(
    wasm('codec/enc/mozjpeg_enc.wasm'),
  );
});
const registry = createCodecRegistry({
  jpeg: () => jpeg,
  png: () => {
    throw new Error('unused');
  },
  webp: () => {
    throw new Error('unused');
  },
  avif: () => {
    throw new Error('unused');
  },
});

interface FakeBitmap {
  width: number;
  height: number;
  close(): void;
}
const bitmap = (width: number, height: number): FakeBitmap => ({ width, height, close() {} });

/** Pseudo-random noise: compresses badly, so size really does track quality and resolution. */
function noise(width: number, height: number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 12345;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = seed & 255;
    data[i + 1] = (seed >>> 8) & 255;
    data[i + 2] = (seed >>> 16) & 255;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

const encoder = createWasmEncoder(
  registry,
  (b) => noise((b as unknown as FakeBitmap).width, (b as unknown as FakeBitmap).height),
  async (_b, width, height) => bitmap(width, height) as unknown as ImageBitmap,
);
const output = (targetBytes: number) => ({
  format: 'jpeg' as const,
  targetBytes,
  stripMetadata: true,
  fileNamePattern: '{name}.{ext}',
});

describe('target size with the real MozJPEG encoder', () => {
  it('lands at or under the target, using most of the budget', async () => {
    const source = bitmap(256, 256) as unknown as ImageBitmap;
    const full = await encoder(source, { ...output(1), targetBytes: undefined }, 'image/jpeg');
    const target = Math.round(full.blob.size * 0.5);

    const result = await encoder(source, output(target), 'image/jpeg');
    expect(result.blob.size).toBeLessThanOrEqual(target);
    expect(result.blob.size).toBeGreaterThan(target * 0.6);
    expect(result.downscaled).toBeUndefined();
    expect(result.targetMissed).toBeUndefined();
    expect(result.width).toBe(256);
  });

  it('downscales when quality alone cannot reach the target', async () => {
    const source = bitmap(256, 256) as unknown as ImageBitmap;
    const floor = await encoder(
      source,
      { ...output(1), targetBytes: undefined, quality: 10 },
      'image/jpeg',
    );
    const target = Math.round(floor.blob.size * 0.8); // below the q10 size at full resolution

    const result = await encoder(source, output(target), 'image/jpeg');
    expect(result.downscaled).toBe(true);
    expect(result.width).toBeLessThan(256);
    expect(result.blob.size).toBeLessThanOrEqual(target);
  });

  it('flags a missed target when it is impossible', async () => {
    const source = bitmap(64, 64) as unknown as ImageBitmap;
    const result = await encoder(source, output(50), 'image/jpeg');
    expect(result.targetMissed).toBe(true);
    expect(result.downscaled).toBe(true);
  });
});
