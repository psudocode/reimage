import { describe, expect, it, vi } from 'vitest';
import { decodeFile, type DecodeDeps } from './decode.ts';

const bitmap = { width: 2, height: 2 } as ImageBitmap;

function file(type: string) {
  return { type, arrayBuffer: vi.fn(async () => new ArrayBuffer(8)) } as unknown as File;
}

function makeDeps(overrides: Partial<DecodeDeps> = {}) {
  const deps: DecodeDeps = {
    createBitmap: vi.fn(async () => bitmap),
    decodeAvif: vi.fn(async () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 })),
    ...overrides,
  };
  return deps;
}

describe('decodeFile', () => {
  it('uses the native decoder with EXIF orientation applied', async () => {
    const deps = makeDeps();
    const input = file('image/jpeg');
    await expect(decodeFile(input, deps)).resolves.toBe(bitmap);
    expect(deps.createBitmap).toHaveBeenCalledWith(input, { imageOrientation: 'from-image' });
    expect(deps.decodeAvif).not.toHaveBeenCalled();
  });

  it('does not load the WASM AVIF decoder when native AVIF decoding works', async () => {
    const deps = makeDeps();
    await decodeFile(file('image/avif'), deps);
    expect(deps.decodeAvif).not.toHaveBeenCalled();
  });

  it('falls back to WASM when the browser cannot decode AVIF', async () => {
    vi.stubGlobal(
      'ImageData',
      class {
        constructor(
          public data: Uint8ClampedArray,
          public width: number,
          public height: number,
        ) {}
      },
    );
    const createBitmap = vi
      .fn<DecodeDeps['createBitmap']>()
      .mockRejectedValueOnce(new Error('unsupported'))
      .mockResolvedValueOnce(bitmap);
    const deps = makeDeps({ createBitmap });

    await expect(decodeFile(file('image/avif'), deps)).resolves.toBe(bitmap);
    expect(deps.decodeAvif).toHaveBeenCalledTimes(1);
    expect(createBitmap).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('rethrows native decode errors for non-AVIF files (corrupt / unsupported)', async () => {
    const deps = makeDeps({
      createBitmap: vi.fn().mockRejectedValue(new Error('corrupt jpeg')),
    });
    await expect(decodeFile(file('image/jpeg'), deps)).rejects.toThrow('corrupt jpeg');
    expect(deps.decodeAvif).not.toHaveBeenCalled();
  });

  it('surfaces a WASM decode failure for AVIF', async () => {
    const deps = makeDeps({
      createBitmap: vi.fn().mockRejectedValue(new Error('unsupported')),
      decodeAvif: vi.fn().mockRejectedValue(new Error('bad avif')),
    });
    await expect(decodeFile(file('image/avif'), deps)).rejects.toThrow('bad avif');
  });
});
