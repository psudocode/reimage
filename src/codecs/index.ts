import { createAvifCodec } from './avif.ts';
import { createJpegCodec } from './jpeg.ts';
import { createPngCodec } from './png.ts';
import type { Codec, CodecId } from './types.ts';
import { createWebpCodec } from './webp.ts';

export * from './types.ts';

export type CodecFactories = Record<CodecId, () => Codec>;

export const defaultCodecFactories: CodecFactories = {
  jpeg: () => createJpegCodec(),
  png: () => createPngCodec(),
  webp: () => createWebpCodec(),
  avif: () => createAvifCodec(),
};

/**
 * Lazy codec registry. Creating a registry loads nothing; each codec's JS and
 * WASM is fetched the first time it is asked to encode, then reused.
 */
export function createCodecRegistry(factories: CodecFactories = defaultCodecFactories) {
  const instances = new Map<CodecId, Codec>();
  return {
    get(id: CodecId): Codec {
      let codec = instances.get(id);
      if (!codec) {
        codec = factories[id]();
        instances.set(id, codec);
      }
      return codec;
    },
  };
}

export type CodecRegistry = ReturnType<typeof createCodecRegistry>;

/** Shared registry used inside the image worker. */
export const codecs: CodecRegistry = createCodecRegistry();
