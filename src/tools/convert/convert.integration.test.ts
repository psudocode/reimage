// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createAvifCodec } from '../../codecs/avif.ts';
import { createCodecRegistry, type RawImage } from '../../codecs/index.ts';
import { createJpegCodec } from '../../codecs/jpeg.ts';
import { createPngCodec } from '../../codecs/png.ts';
import { createWebpCodec } from '../../codecs/webp.ts';
import { createWasmEncoder } from '../../core/image/encode.ts';
import { FILE_NAME_PATTERN, buildPipeline } from '../../app/workspace/pipeline.ts';
import type { ConvertFormat, ConvertOptions } from './options.ts';

/**
 * Convert end to end with the REAL jSquash encoders under Node: the options a
 * user picks -> pipeline output settings -> encoder -> a file in that format.
 */
const require = createRequire(import.meta.url);
const wasm = (pkg: string, file: string) =>
  new WebAssembly.Module(readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), file)));
type WithInit = { init: (module: WebAssembly.Module) => Promise<unknown> };
const initWith = (pkg: string, file: string) => async (module: unknown) => {
  await (module as WithInit).init(wasm(pkg, file));
};

const registry = createCodecRegistry({
  jpeg: () => createJpegCodec(initWith('@jsquash/jpeg', 'codec/enc/mozjpeg_enc.wasm')),
  webp: () => createWebpCodec(initWith('@jsquash/webp', 'codec/enc/webp_enc.wasm')),
  avif: () => createAvifCodec(initWith('@jsquash/avif', 'codec/enc/avif_enc.wasm')),
  png: () =>
    createPngCodec({
      initPng: initWith('@jsquash/png', 'codec/pkg/squoosh_png_bg.wasm'),
      initOxipng: initWith('@jsquash/oxipng', 'codec/pkg/squoosh_oxipng_bg.wasm'),
    }),
});

function image(width: number, height: number, alpha = 255): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = (i * 7) % 256;
    data[i * 4 + 1] = (i * 3) % 256;
    data[i * 4 + 2] = 200 - (i % 100);
    data[i * 4 + 3] = alpha;
  }
  return { data, width, height };
}

const bitmap = { width: 48, height: 32, close() {} } as unknown as ImageBitmap;
const ascii = async (blob: Blob, from: number, to: number) =>
  String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()).subarray(from, to));

function convert(options: ConvertOptions, readPixels = vi.fn(() => image(48, 32))) {
  const { output } = buildPipeline('convert', options);
  const encoder = createWasmEncoder(registry, readPixels, async () => bitmap);
  return { output, readPixels, run: () => encoder(bitmap, output, 'image/png') };
}

describe('Convert with the real encoders', () => {
  it.each<[ConvertFormat, string]>([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['avif', 'image/avif'],
  ])('produces a valid %s file', async (format, mime) => {
    const result = await convert({ format, quality: 70 }).run();
    expect(result.blob.type).toBe(mime);
    expect(result.blob.size).toBeGreaterThan(0);
    expect([result.width, result.height]).toEqual([48, 32]);

    const head = new Uint8Array(await result.blob.arrayBuffer()).subarray(0, 12);
    if (format === 'jpeg') expect(Array.from(head.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    if (format === 'png') expect(String.fromCharCode(...head.subarray(1, 4))).toBe('PNG');
    if (format === 'webp') {
      expect(await ascii(result.blob, 0, 4)).toBe('RIFF');
      expect(await ascii(result.blob, 8, 12)).toBe('WEBP');
    }
    if (format === 'avif') expect(await ascii(result.blob, 4, 12)).toBe('ftypavif');
  });

  it('builds a pipeline whose output matches the chosen options', () => {
    const lossy = buildPipeline('convert', { format: 'webp', quality: 64 });
    expect(lossy.output).toEqual({
      format: 'webp',
      quality: 64,
      targetBytes: undefined,
      stripMetadata: true,
      fileNamePattern: FILE_NAME_PATTERN,
    });
    expect(buildPipeline('convert', { format: 'png', quality: 64 }).output.quality).toBeUndefined();
  });

  it('flattens transparency onto white for JPEG only', async () => {
    const jpeg = convert({ format: 'jpeg', quality: 80 });
    await jpeg.run();
    expect(jpeg.readPixels).toHaveBeenCalledWith(bitmap, { background: '#ffffff' });

    for (const format of ['png', 'webp', 'avif'] as const) {
      const other = convert({ format, quality: 80 });
      await other.run();
      expect(other.readPixels).toHaveBeenCalledWith(bitmap, {});
    }
  });

  it('a lower quality gives a smaller lossy file', async () => {
    const readPixels = vi.fn(() => image(96, 96));
    const high = await convert({ format: 'webp', quality: 95 }, readPixels).run();
    const low = await convert({ format: 'webp', quality: 10 }, readPixels).run();
    expect(low.blob.size).toBeLessThan(high.blob.size);
  });
});
