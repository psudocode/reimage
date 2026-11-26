import { decodeAvifWasm, type AvifDecoder } from '../../codecs/decode.ts';

export interface DecodeDeps {
  createBitmap(source: Blob | ImageData, options?: ImageBitmapOptions): Promise<ImageBitmap>;
  decodeAvif: AvifDecoder;
}

const browserDeps: DecodeDeps = {
  createBitmap: (source, options) => createImageBitmap(source, options),
  decodeAvif: decodeAvifWasm,
};

/**
 * Decodes a file to a bitmap with EXIF orientation applied, so output pixels
 * are upright. Uses the browser's native decoder; only if that fails on an AVIF
 * file do we fall back to the WASM AVIF decoder (technical.md §8).
 */
export async function decodeFile(file: File, deps: DecodeDeps = browserDeps): Promise<ImageBitmap> {
  try {
    return await deps.createBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    if (file.type !== 'image/avif') throw error;
    const raw = await deps.decodeAvif(await file.arrayBuffer());
    // jSquash returns ArrayBuffer-backed pixels; the generic RawImage type is wider.
    const pixels = raw.data as Uint8ClampedArray<ArrayBuffer>;
    return deps.createBitmap(new ImageData(pixels, raw.width, raw.height));
  }
}
