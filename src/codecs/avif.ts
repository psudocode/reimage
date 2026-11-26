import { lazyModule } from './lazy.ts';
import { clampQuality, type Codec, type InitHook } from './types.ts';

type AvifEncodeModule = typeof import('@jsquash/avif/encode.js');

export const AVIF_DEFAULT_QUALITY = 50;

/** libavif. The jSquash module (and its .wasm) is only fetched on first encode. */
export function createAvifCodec(init?: InitHook<AvifEncodeModule>): Codec {
  const load = lazyModule(() => import('@jsquash/avif/encode.js'), init);
  return {
    id: 'avif',
    mimeType: 'image/avif',
    extension: 'avif',
    lossy: true,
    supportsAlpha: true,
    async encode(image, params) {
      const { default: encode } = await load();
      return encode(image as ImageData, {
        quality: clampQuality(params?.quality, AVIF_DEFAULT_QUALITY),
      });
    },
  };
}
