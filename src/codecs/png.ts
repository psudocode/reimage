import { lazyModule } from './lazy.ts';
import type { Codec, InitHook } from './types.ts';

type PngEncodeModule = typeof import('@jsquash/png/encode.js');
type OxipngModule = typeof import('@jsquash/oxipng/optimise.js');

/** OxiPNG effort. 2 is a good speed/size trade-off for in-browser use. */
export const OXIPNG_LEVEL = 2;

/**
 * Lossless PNG: encode with `@jsquash/png`, then squeeze with OxiPNG.
 * Both modules are fetched on first use.
 */
export function createPngCodec(hooks?: {
  initPng?: InitHook<PngEncodeModule>;
  initOxipng?: InitHook<OxipngModule>;
}): Codec {
  const loadPng = lazyModule(() => import('@jsquash/png/encode.js'), hooks?.initPng);
  const loadOxipng = lazyModule(() => import('@jsquash/oxipng/optimise.js'), hooks?.initOxipng);
  return {
    id: 'png',
    mimeType: 'image/png',
    extension: 'png',
    lossy: false,
    supportsAlpha: true,
    async encode(image) {
      const [{ default: encode }, { default: optimise }] = await Promise.all([
        loadPng(),
        loadOxipng(),
      ]);
      const raw = await encode(image as ImageData);
      return optimise(raw, { level: OXIPNG_LEVEL });
    },
  };
}
