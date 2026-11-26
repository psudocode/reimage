// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAvifDecoder } from './decode.ts';
import { createAvifCodec } from './avif.ts';
import { createJpegCodec } from './jpeg.ts';
import { createPngCodec } from './png.ts';
import type { RawImage } from './types.ts';
import { createWebpCodec } from './webp.ts';

/**
 * Runs the REAL jSquash WASM encoders/decoders under Node. In the browser the
 * .wasm files are fetched by URL; Node's fetch cannot read file:// URLs, so the
 * init hooks hand each module a pre-compiled WebAssembly.Module instead. The
 * wrapper code under test (quality mapping, PNG + OxiPNG chaining, lazy init)
 * is exactly what ships.
 */
const require = createRequire(import.meta.url);
const wasm = (pkg: string, file: string) =>
  new WebAssembly.Module(readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), file)));

type WithInit = { init: (module: WebAssembly.Module) => Promise<unknown> };
const initWith = (pkg: string, file: string) => async (module: unknown) => {
  await (module as WithInit).init(wasm(pkg, file));
};

function gradient(width: number, height: number, alpha = 255): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = (i * 7) % 256;
    data[i * 4 + 1] = (i * 3) % 256;
    data[i * 4 + 2] = 200 - (i % 100);
    data[i * 4 + 3] = alpha;
  }
  return { data, width, height };
}

const bytes = (buffer: ArrayBuffer) => new Uint8Array(buffer);
const ascii = (buffer: ArrayBuffer, from: number, to: number) =>
  String.fromCharCode(...bytes(buffer).subarray(from, to));

const jpeg = createJpegCodec(initWith('@jsquash/jpeg', 'codec/enc/mozjpeg_enc.wasm'));
const webp = createWebpCodec(initWith('@jsquash/webp', 'codec/enc/webp_enc.wasm'));
const avif = createAvifCodec(initWith('@jsquash/avif', 'codec/enc/avif_enc.wasm'));
const png = createPngCodec({
  initPng: initWith('@jsquash/png', 'codec/pkg/squoosh_png_bg.wasm'),
  initOxipng: initWith('@jsquash/oxipng', 'codec/pkg/squoosh_oxipng_bg.wasm'),
});

const photo = gradient(64, 64);

describe('WASM codecs (real encoders)', () => {
  it('JPEG: emits a JPEG, and lower quality gives a smaller file', async () => {
    const high = await jpeg.encode(photo, { quality: 95 });
    const low = await jpeg.encode(photo, { quality: 10 });
    expect(Array.from(bytes(high).subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    expect(low.byteLength).toBeLessThan(high.byteLength);
  });

  it('WebP: emits a RIFF/WEBP container, and lower quality gives a smaller file', async () => {
    const high = await webp.encode(photo, { quality: 95 });
    const low = await webp.encode(photo, { quality: 10 });
    expect(ascii(high, 0, 4)).toBe('RIFF');
    expect(ascii(high, 8, 12)).toBe('WEBP');
    expect(low.byteLength).toBeLessThan(high.byteLength);
  });

  it('AVIF: emits an AVIF container', async () => {
    const out = await avif.encode(photo, { quality: 50 });
    expect(ascii(out, 4, 8)).toBe('ftyp');
    expect(ascii(out, 8, 12)).toBe('avif');
  });

  it('PNG: emits a PNG, and OxiPNG makes it smaller than a plain encode', async () => {
    const flat = gradient(64, 64);
    for (let i = 0; i < flat.data.length; i += 4) flat.data.set([30, 120, 200, 255], i);
    const out = await png.encode(flat);
    expect(Array.from(bytes(out).subarray(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const plain = (await import('@jsquash/png/encode.js')) as unknown as WithInit & {
      default: (image: RawImage) => Promise<ArrayBuffer>;
    };
    await plain.init(wasm('@jsquash/png', 'codec/pkg/squoosh_png_bg.wasm'));
    const unoptimised = await plain.default(photo);
    const optimised = await png.encode(photo);
    expect(optimised.byteLength).toBeLessThan(unoptimised.byteLength);
  });

  it('clamps out-of-range quality instead of failing', async () => {
    await expect(jpeg.encode(photo, { quality: 500 })).resolves.toBeInstanceOf(ArrayBuffer);
    await expect(jpeg.encode(photo, { quality: -20 })).resolves.toBeInstanceOf(ArrayBuffer);
    await expect(jpeg.encode(photo, { quality: Number.NaN })).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it('AVIF round trip: the WASM decoder reads back what the encoder wrote', async () => {
    const decode = createAvifDecoder(initWith('@jsquash/avif', 'codec/dec/avif_dec.wasm'));
    const encoded = await avif.encode(gradient(48, 32), { quality: 60 });
    const decoded = await decode(encoded);
    expect(decoded.width).toBe(48);
    expect(decoded.height).toBe(32);
    expect(decoded.data.length).toBe(48 * 32 * 4);
  });

  it('describes each codec correctly', () => {
    expect(
      [jpeg, png, webp, avif].map((c) => [c.id, c.mimeType, c.lossy, c.supportsAlpha]),
    ).toEqual([
      ['jpeg', 'image/jpeg', true, false],
      ['png', 'image/png', false, true],
      ['webp', 'image/webp', true, true],
      ['avif', 'image/avif', true, true],
    ]);
  });
});
