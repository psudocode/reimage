/**
 * The segmentation model and where it lives.
 *
 * The model is far too big for the bundle (and for Cloudflare Pages' 25 MiB
 * file limit), so it is downloaded on demand from Hugging Face and kept in
 * Cache Storage. Only the model file is downloaded: the user's image never
 * leaves the browser. DOM-free: it runs in a worker and on the main thread.
 */

/** IS-Net "general use" (DIS, Apache-2.0), int8 weight-only QDQ. Repo licence: MIT. */
export const MODEL_REPO = 'xrds/isnet-general-onnx-int8';
/** Pinned commit, so the file can never change under us. */
export const MODEL_REVISION = '71eff2372ec9c8edbc6ca637ded591423d23b65a';
export const MODEL_URL = `https://huggingface.co/${MODEL_REPO}/resolve/${MODEL_REVISION}/onnx/model_quantized.onnx`;
/** Exact size in bytes; a short or long download is rejected. */
export const MODEL_BYTES = 44_229_662;
export const MODEL_CACHE = `reimage-models-${MODEL_REVISION.slice(0, 8)}`;
/** Side of the square the model sees. */
export const MODEL_INPUT_SIZE = 1024;

export class ModelNotDownloadedError extends Error {
  constructor() {
    super('The background removal model is not downloaded yet');
    this.name = 'ModelNotDownloadedError';
  }
}

export async function isModelCached(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  return (await caches.open(MODEL_CACHE)).match(MODEL_URL).then((hit) => hit !== undefined);
}

/** Model file from the cache. Throws `ModelNotDownloadedError` if missing. */
export async function readModel(): Promise<ArrayBuffer> {
  if (typeof caches === 'undefined') throw new ModelNotDownloadedError();
  const hit = await (await caches.open(MODEL_CACHE)).match(MODEL_URL);
  if (!hit) throw new ModelNotDownloadedError();
  return hit.arrayBuffer();
}

/** Downloads the model into the cache, reporting 0..1. Aborting leaves no partial file. */
export async function downloadModel(
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Cache Storage is not available');
  const response = await fetch(MODEL_URL, { signal });
  if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status})`);

  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(1, received / MODEL_BYTES));
  }
  if (received !== MODEL_BYTES) {
    throw new Error(`Model download is incomplete (${received} of ${MODEL_BYTES} bytes)`);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const cache = await caches.open(MODEL_CACHE);
  await cache.put(MODEL_URL, new Response(bytes));
  onProgress(1);
}

export async function deleteModel(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete(MODEL_CACHE);
}
