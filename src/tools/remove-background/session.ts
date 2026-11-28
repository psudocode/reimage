import * as ort from 'onnxruntime-web/wasm';
// Only the plain CPU build (14 MiB) is shipped. The WebGPU build is 28 MiB,
// over Cloudflare Pages' 25 MiB per-file limit.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { MODEL_INPUT_SIZE, readModel } from './model.ts';

/**
 * Lazy ONNX session, one per worker. Loaded from `runtime.ts` with a dynamic
 * import so the ~15 MiB runtime never touches the worker's own bundle.
 */
let session: Promise<ort.InferenceSession> | undefined;

function getSession(): Promise<ort.InferenceSession> {
  session ??= (async () => {
    ort.env.wasm.wasmPaths = { wasm: wasmUrl };
    const model = await readModel();
    return ort.InferenceSession.create(new Uint8Array(model), {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  })().catch((error: unknown) => {
    session = undefined; // allow a retry, e.g. after the model finishes downloading
    throw error;
  });
  return session;
}

/** Runs the model on a 1024x1024 CHW tensor; returns the 1024x1024 mask. */
export async function infer(input: Float32Array): Promise<Float32Array> {
  const active = await getSession();
  const tensor = new ort.Tensor('float32', input, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  // The model has many side outputs; ask only for the first (the final mask).
  const outputName = active.outputNames[0]!;
  const results = await active.run({ [active.inputNames[0]!]: tensor }, [outputName]);
  const output = results[outputName]!;
  return output.data as Float32Array;
}
