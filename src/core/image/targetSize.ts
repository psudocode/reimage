/**
 * Target file size search (technical.md §8).
 *
 * Binary search over quality so the encoded file is as large as possible while
 * staying at or under `targetBytes`. If even the minimum quality is too big, the
 * image is downscaled and the search repeats.
 *
 * Deviation from the spec's "±3%": the ceiling is HARD. A user who asks for
 * "under 200 KB" never gets 205 KB. The 3% tolerance only applies below the
 * target, as an early-exit ("close enough, stop searching").
 */

export const MIN_QUALITY = 10;
export const MAX_QUALITY = 100;
/** Max encodes per resolution (the two boundary probes count). */
export const MAX_ITERATIONS = 7;
/** Stop early once the file is within this fraction below the target. */
export const LOW_TOLERANCE = 0.03;
export const MAX_DOWNSCALES = 3;
/** Linear scale applied per downscale step (10% smaller each side). */
export const DOWNSCALE_FACTOR = 0.9;

export interface TargetSizeDeps<B extends { width: number; height: number }> {
  /** Encodes `bitmap` at `quality`. */
  encode(bitmap: B, quality: number): Promise<Blob>;
  /** Returns a new, resized bitmap. The input is not closed. */
  resize(bitmap: B, width: number, height: number): Promise<B>;
  /** Whether quality affects size. Lossless codecs (PNG) skip the quality search. */
  lossy: boolean;
}

export interface TargetSizeResult {
  blob: Blob;
  width: number;
  height: number;
  /** Quality of the returned file (undefined for lossless). */
  quality?: number;
  /** True if the image had to be made smaller to get near the target. */
  downscaled: boolean;
  /** False if the target could not be reached even after all downscales. */
  targetMet: boolean;
  /** Total encode calls, for diagnostics. */
  encodes: number;
}

interface Candidate {
  blob: Blob;
  quality: number;
}

/** Quality search at a fixed resolution. Returns the best candidate under target, or the smallest seen. */
async function searchQuality<B extends { width: number; height: number }>(
  bitmap: B,
  targetBytes: number,
  deps: TargetSizeDeps<B>,
  count: { n: number },
): Promise<{ best: Candidate; fits: boolean }> {
  const attempt = async (quality: number): Promise<Candidate> => {
    count.n += 1;
    return { blob: await deps.encode(bitmap, quality), quality };
  };

  if (!deps.lossy) {
    const only = await attempt(MAX_QUALITY);
    return { best: only, fits: only.blob.size <= targetBytes };
  }

  // Probe 1: full quality. If it already fits there is nothing to trade away.
  const top = await attempt(MAX_QUALITY);
  if (top.blob.size <= targetBytes) return { best: top, fits: true };

  // Probe 2: minimum quality. If this is still too big, quality alone cannot do it.
  const floor = await attempt(MIN_QUALITY);
  if (floor.blob.size > targetBytes) return { best: floor, fits: false };

  let best = floor;
  let lo = MIN_QUALITY;
  let hi = MAX_QUALITY;
  for (let i = 2; i < MAX_ITERATIONS; i += 1) {
    const mid = Math.round((lo + hi) / 2);
    if (mid <= lo || mid >= hi) break;
    const candidate = await attempt(mid);
    if (candidate.blob.size <= targetBytes) {
      best = candidate;
      lo = mid;
      if (candidate.blob.size >= targetBytes * (1 - LOW_TOLERANCE)) break;
    } else {
      hi = mid;
    }
  }
  return { best, fits: true };
}

/**
 * Finds the best encoding at or under `targetBytes`. The caller keeps ownership
 * of `input`; bitmaps created by downscaling are closed here (if they expose `close`).
 */
export async function searchTargetSize<B extends { width: number; height: number; close?(): void }>(
  input: B,
  targetBytes: number,
  deps: TargetSizeDeps<B>,
): Promise<TargetSizeResult> {
  if (!(targetBytes > 0)) throw new RangeError('targetBytes must be positive');

  const count = { n: 0 };
  let current = input;
  let downscales = 0;

  try {
    for (;;) {
      const { best, fits } = await searchQuality(current, targetBytes, deps, count);
      const exhausted = downscales >= MAX_DOWNSCALES;
      if (fits || exhausted) {
        return {
          blob: best.blob,
          width: current.width,
          height: current.height,
          quality: deps.lossy ? best.quality : undefined,
          downscaled: downscales > 0,
          targetMet: fits,
          encodes: count.n,
        };
      }

      const width = Math.max(1, Math.round(current.width * DOWNSCALE_FACTOR));
      const height = Math.max(1, Math.round(current.height * DOWNSCALE_FACTOR));
      if (width === current.width && height === current.height) {
        // Cannot shrink any further (1x1).
        return {
          blob: best.blob,
          width,
          height,
          quality: deps.lossy ? best.quality : undefined,
          downscaled: downscales > 0,
          targetMet: false,
          encodes: count.n,
        };
      }
      const next = await deps.resize(current, width, height);
      if (current !== input) current.close?.();
      current = next;
      downscales += 1;
    }
  } finally {
    if (current !== input) current.close?.();
  }
}
