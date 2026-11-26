import { describe, expect, it, vi } from 'vitest';
import { createCodecRegistry, type Codec, type CodecFactories } from '../../codecs/index.ts';
import type { OutputSettings } from '../pipeline/types.ts';
import { createWasmEncoder, resolveCodecId } from './encode.ts';

const output = (overrides: Partial<OutputSettings> = {}): OutputSettings => ({
  format: 'webp',
  stripMetadata: true,
  fileNamePattern: '{name}.{ext}',
  ...overrides,
});

function fakeCodec(id: Codec['id'], mimeType: string, supportsAlpha: boolean): Codec {
  return {
    id,
    mimeType,
    extension: id,
    lossy: id !== 'png',
    supportsAlpha,
    encode: vi.fn(async () => new Uint8Array([1, 2, 3, 4]).buffer),
  };
}

function setup() {
  const codecs = {
    jpeg: fakeCodec('jpeg', 'image/jpeg', false),
    png: fakeCodec('png', 'image/png', true),
    webp: fakeCodec('webp', 'image/webp', true),
    avif: fakeCodec('avif', 'image/avif', true),
  };
  const factories: CodecFactories = {
    jpeg: () => codecs.jpeg,
    png: () => codecs.png,
    webp: () => codecs.webp,
    avif: () => codecs.avif,
  };
  const pixels = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
  const readPixels = vi.fn(() => pixels);
  const encoder = createWasmEncoder(createCodecRegistry(factories), readPixels);
  const bitmap = { width: 1, height: 1 } as ImageBitmap;
  return { codecs, readPixels, encoder, bitmap, pixels };
}

describe('resolveCodecId', () => {
  it('uses the requested format when it is explicit', () => {
    expect(resolveCodecId('avif', 'image/jpeg')).toBe('avif');
  });

  it.each([
    ['image/jpeg', 'jpeg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/avif', 'avif'],
  ])('keeps the source format for "original" (%s)', (type, expected) => {
    expect(resolveCodecId('original', type)).toBe(expected);
  });

  it.each(['image/gif', 'image/bmp', 'image/heic', ''])(
    'falls back to lossless PNG for source type "%s"',
    (type) => {
      expect(resolveCodecId('original', type)).toBe('png');
    },
  );
});

describe('createWasmEncoder', () => {
  it('encodes with the chosen codec and tags the Blob with its mime type', async () => {
    const { codecs, encoder, bitmap, pixels } = setup();
    const result = await encoder(bitmap, output({ format: 'webp', quality: 42 }), 'image/jpeg');

    expect(codecs.webp.encode).toHaveBeenCalledWith(pixels, { quality: 42 });
    expect(result.blob.type).toBe('image/webp');
    expect(result.blob.size).toBe(4);
    expect(result).toMatchObject({ width: 1, height: 1 });
    expect(result.downscaled).toBeUndefined();
    expect(codecs.jpeg.encode).not.toHaveBeenCalled();
  });

  it('flattens transparency onto white for JPEG only', async () => {
    const { readPixels, encoder, bitmap } = setup();

    await encoder(bitmap, output({ format: 'jpeg' }), 'image/png');
    expect(readPixels).toHaveBeenLastCalledWith(bitmap, { background: '#ffffff' });

    await encoder(bitmap, output({ format: 'png' }), 'image/png');
    expect(readPixels).toHaveBeenLastCalledWith(bitmap, {});

    await encoder(bitmap, output({ format: 'webp' }), 'image/png');
    expect(readPixels).toHaveBeenLastCalledWith(bitmap, {});
  });

  it('resolves "original" from the source file type', async () => {
    const { codecs, encoder, bitmap } = setup();
    await encoder(bitmap, output({ format: 'original' }), 'image/jpeg');
    expect(codecs.jpeg.encode).toHaveBeenCalledTimes(1);
  });

  it('propagates codec failures', async () => {
    const { codecs, encoder, bitmap } = setup();
    vi.mocked(codecs.avif.encode).mockRejectedValueOnce(new Error('avif oom'));
    await expect(encoder(bitmap, output({ format: 'avif' }), 'image/png')).rejects.toThrow(
      'avif oom',
    );
  });

  it('runs the target-size search when targetBytes is set', async () => {
    const { codecs, encoder, bitmap } = setup();
    // 4-byte output is already under a 1000-byte target: one encode at max quality.
    const result = await encoder(
      bitmap,
      output({ format: 'webp', targetBytes: 1000 }),
      'image/png',
    );
    expect(codecs.webp.encode).toHaveBeenCalledTimes(1);
    expect(codecs.webp.encode).toHaveBeenCalledWith(expect.anything(), { quality: 100 });
    expect(result.targetMissed).toBeUndefined();
  });

  it('reports targetMissed when the target is unreachable', async () => {
    const { codecs, encoder, bitmap } = setup();
    vi.mocked(codecs.webp.encode).mockImplementation(async () => new ArrayBuffer(500));
    const result = await encoder(bitmap, output({ format: 'webp', targetBytes: 10 }), 'image/png');
    expect(result.targetMissed).toBe(true);
  });
});
