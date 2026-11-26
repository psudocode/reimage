import { lazyModule } from './lazy.ts';
import { clampQuality, type Codec, type InitHook } from './types.ts';

type WebpEncodeModule = typeof import('@jsquash/webp/encode.js');

export const WEBP_DEFAULT_QUALITY = 75;

/** libwebp. The jSquash module (and its .wasm) is only fetched on first encode. */
export function createWebpCodec(init?: InitHook<WebpEncodeModule>): Codec {
  const load = lazyModule(() => import('@jsquash/webp/encode.js'), init);
  return {
    id: 'webp',
    mimeType: 'image/webp',
    extension: 'webp',
    lossy: true,
    supportsAlpha: true,
    async encode(image, params) {
      const { default: encode } = await load();
      return encode(image as ImageData, {
        quality: clampQuality(params?.quality, WEBP_DEFAULT_QUALITY),
      });
    },
  };
}
