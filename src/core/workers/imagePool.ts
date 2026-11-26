import * as Comlink from 'comlink';
import { getWorkerPoolSize } from '../limits.ts';
import type { ImageWorkerApi } from './image.worker.ts';
import { WorkerPool, type PoolWorker } from './pool.ts';

/** Wraps a real module Worker running `image.worker.ts` in the pool contract. */
export function createImageWorker(): PoolWorker<Comlink.Remote<ImageWorkerApi>> {
  const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
  const api = Comlink.wrap<ImageWorkerApi>(worker);
  return {
    api,
    terminate: () => {
      api[Comlink.releaseProxy]();
      worker.terminate();
    },
    onCrash: (callback) => {
      // `error` fires for uncaught exceptions / failed script loads;
      // `messageerror` for payloads that cannot be deserialised.
      worker.addEventListener('error', (event) => callback(event));
      worker.addEventListener('messageerror', (event) => callback(event));
    },
  };
}

export type ImageWorkerPool = WorkerPool<Comlink.Remote<ImageWorkerApi>>;

/** Creates a pool sized from the device's CPU/memory (see `getWorkerPoolSize`). */
export function createImagePool(): ImageWorkerPool {
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return new WorkerPool({
    size: getWorkerPoolSize(navigator.hardwareConcurrency, deviceMemory),
    createWorker: createImageWorker,
  });
}
