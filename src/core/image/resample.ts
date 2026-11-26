/**
 * High-quality resampling helper built on `pica`.
 *
 * Meant to run inside a worker: pica is loaded lazily (so it never lands in the
 * initial bundle), runs without its own nested web workers, and uses
 * OffscreenCanvas instead of DOM canvases.
 */

export type ResampleFilter = 'box' | 'hamming' | 'lanczos2' | 'lanczos3' | 'mks2013';

export interface ResampleOptions {
  filter?: ResampleFilter;
  /** Percent, >= 0. Leave unset for pica's default (mks2013 already sharpens). */
  unsharpAmount?: number;
  /** Abort the operation. Rejects with an AbortError. */
  signal?: AbortSignal;
}

/** The subset of pica that we depend on, so it can be faked in tests. */
export interface ResampleEngine {
  resize(
    from: ImageBitmap,
    to: OffscreenCanvas,
    options?: { filter?: ResampleFilter; unsharpAmount?: number; cancelToken?: Promise<unknown> },
  ): Promise<unknown>;
}

export interface ResampleDeps {
  engine?: ResampleEngine;
  createCanvas?: (width: number, height: number) => OffscreenCanvas;
}

export interface Size {
  width: number;
  height: number;
}

const defaultCreateCanvas = (width: number, height: number) => new OffscreenCanvas(width, height);

let sharedEngine: Promise<ResampleEngine> | undefined;

async function loadDefaultEngine(): Promise<ResampleEngine> {
  const { default: Pica } = await import('pica');
  const instance = new Pica({
    // We are already inside a pool worker; don't spawn nested workers.
    features: ['js', 'wasm'],
    createCanvas: ((width: number, height: number) =>
      defaultCreateCanvas(width, height)) as unknown as (
      width: number,
      height: number,
    ) => HTMLCanvasElement,
  });
  return instance as unknown as ResampleEngine;
}

function getDefaultEngine(): Promise<ResampleEngine> {
  sharedEngine ??= loadDefaultEngine().catch((error: unknown) => {
    sharedEngine = undefined; // allow retry after a failed lazy import
    throw error;
  });
  return sharedEngine;
}

/**
 * Returns the largest size with the same aspect ratio as `size` whose pixel
 * count does not exceed `maxPixels`. Returns `size` unchanged if it already fits.
 */
export function fitWithinMaxPixels(size: Size, maxPixels: number): Size {
  const { width, height } = size;
  if (width <= 0 || height <= 0 || maxPixels <= 0) {
    throw new RangeError('Width, height and maxPixels must be positive');
  }
  if (width * height <= maxPixels) return { width, height };

  const scale = Math.sqrt(maxPixels / (width * height));
  let w = Math.max(1, Math.floor(width * scale));
  let h = Math.max(1, Math.floor(height * scale));
  // Guard against rounding pushing us over the limit.
  while (w * h > maxPixels && (w > 1 || h > 1)) {
    if (w >= h && w > 1) w -= 1;
    else if (h > 1) h -= 1;
  }
  return { width: w, height: h };
}

/** Scales `size` by `factor` (e.g. 0.5), never going below 1px per side. */
export function scaleSize(size: Size, factor: number): Size {
  if (!(factor > 0)) throw new RangeError('Scale factor must be positive');
  return {
    width: Math.max(1, Math.round(size.width * factor)),
    height: Math.max(1, Math.round(size.height * factor)),
  };
}

function abortError(): Error {
  const error = new Error('Resample was cancelled');
  error.name = 'AbortError';
  return error;
}

/**
 * Resamples `input` to `width` x `height`. The input bitmap is NOT closed; the
 * caller owns it. The returned bitmap is owned by the caller.
 */
export async function resampleBitmap(
  input: ImageBitmap,
  width: number,
  height: number,
  options: ResampleOptions = {},
  deps: ResampleDeps = {},
): Promise<ImageBitmap> {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`Invalid target size ${width}x${height}`);
  }
  const { signal } = options;
  if (signal?.aborted) throw abortError();

  const engine = deps.engine ?? (await getDefaultEngine());
  const createCanvas = deps.createCanvas ?? defaultCreateCanvas;
  const target = createCanvas(width, height);

  const cancelToken = signal
    ? new Promise<never>((_, reject) => {
        signal.addEventListener('abort', () => reject(abortError()), { once: true });
      })
    : undefined;
  // Avoid an unhandled rejection if the token fires after the resize settled.
  cancelToken?.catch(() => {});

  try {
    await engine.resize(input, target, {
      filter: options.filter,
      unsharpAmount: options.unsharpAmount,
      cancelToken,
    });
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw error;
  }
  if (signal?.aborted) throw abortError();

  return target.transferToImageBitmap();
}
