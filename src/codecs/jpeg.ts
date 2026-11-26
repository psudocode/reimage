import { lazyModule } from './lazy.ts';
import { clampQuality, type Codec, type InitHook } from './types.ts';

type JpegEncodeModule = typeof import('@jsquash/jpeg/encode.js');

export const JPEG_DEFAULT_QUALITY = 75;

/** MozJPEG. The jSquash module (and its .wasm) is only fetched on first encode. */
export function createJpegCodec(init?: InitHook<JpegEncodeModule>): Codec {
  const load = lazyModule(() => import('@jsquash/jpeg/encode.js'), init);
  return {
    id: 'jpeg',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    lossy: true,
    supportsAlpha: false,
    async encode(image, params) {
      const { default: encode } = await load();
      return encode(image as ImageData, {
        quality: clampQuality(params?.quality, JPEG_DEFAULT_QUALITY),
      });
    },
  };
}
