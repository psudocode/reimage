import { lazyModule } from './lazy.ts';
import type { InitHook, RawImage } from './types.ts';

type AvifDecodeModule = typeof import('@jsquash/avif/decode.js');

export type AvifDecoder = (buffer: ArrayBuffer) => Promise<RawImage>;

/**
 * AVIF decoding fallback for browsers whose `createImageBitmap` cannot decode
 * AVIF. The WASM decoder is only fetched when that fallback is actually needed.
 */
export function createAvifDecoder(init?: InitHook<AvifDecodeModule>): AvifDecoder {
  const load = lazyModule(() => import('@jsquash/avif/decode.js'), init);
  return async (buffer) => {
    const { default: decode } = await load();
    const image = await decode(buffer);
    if (!image) throw new Error('AVIF data could not be decoded');
    return image;
  };
}

export const decodeAvifWasm: AvifDecoder = createAvifDecoder();
