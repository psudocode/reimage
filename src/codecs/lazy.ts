import type { InitHook } from './types.ts';

/**
 * Memoised dynamic import. The module is fetched on the first call and reused;
 * a failed import (e.g. offline) is not cached so a later call can retry.
 */
export function lazyModule<M>(importer: () => Promise<M>, init?: InitHook<M>): () => Promise<M> {
  let ready: Promise<M> | undefined;
  return () => {
    ready ??= importer()
      .then(async (module) => {
        await init?.(module);
        return module;
      })
      .catch((error: unknown) => {
        ready = undefined;
        throw error;
      });
    return ready;
  };
}
