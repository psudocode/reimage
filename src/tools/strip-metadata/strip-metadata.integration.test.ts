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
import { buildPipeline } from '../../app/workspace/pipeline.ts';
import type { StripMetadataOptions } from './options.ts';

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

function image(width: number, height: number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = (i * 7) % 256;
    data[i * 4 + 1] = (i * 3) % 256;
    data[i * 4 + 2] = 200 - (i % 100);
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

const photo = image(32, 32);

describe('strip-metadata integration with real codecs', () => {
  it('builds a pipeline setting stripMetadata: true', () => {
    const options: StripMetadataOptions = { quality: 85 };
    const pipeline = buildPipeline('strip-metadata', options);

    expect(pipeline.output.stripMetadata).toBe(true);
    expect(pipeline.output.quality).toBe(85);
  });

  it('produces a JPEG without APP1 / EXIF segments', async () => {
    const encoder = createWasmEncoder(registry, () => photo, vi.fn() as never);
    const options: StripMetadataOptions = { quality: 90 };
    const pipeline = buildPipeline('strip-metadata', options);

    const result = await encoder(
      { width: 32, height: 32 } as ImageBitmap,
      pipeline.output,
      'image/jpeg',
    );

    const buffer = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // SOI marker
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);

    // Scan for APP1 (0xFF, 0xE1) marker
    let foundApp1 = false;
    for (let i = 0; i < bytes.length - 1; i += 1) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
        foundApp1 = true;
        break;
      }
    }
    expect(foundApp1).toBe(false);

    // Search for "Exif" ASCII string in bytes
    const text = new TextDecoder().decode(bytes);
    expect(text.includes('Exif')).toBe(false);
  });

  it('produces a PNG without metadata chunks (tEXt, zTXt, iTXt, eXIf)', async () => {
    const encoder = createWasmEncoder(registry, () => photo, vi.fn() as never);
    const options: StripMetadataOptions = { quality: 90 };
    const pipeline = buildPipeline('strip-metadata', options);

    const result = await encoder(
      { width: 32, height: 32 } as ImageBitmap,
      pipeline.output,
      'image/png',
    );

    const buffer = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PNG signature
    expect(Array.from(bytes.subarray(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.includes('tEXt')).toBe(false);
    expect(text.includes('zTXt')).toBe(false);
    expect(text.includes('iTXt')).toBe(false);
    expect(text.includes('eXIf')).toBe(false);
  });
});
