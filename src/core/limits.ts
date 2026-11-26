export const MAX_PIXELS_DEFAULT = 50_000_000;
export const MAX_PIXELS_LOW_MEMORY = 25_000_000;
export const LOW_MEMORY_THRESHOLD_GB = 4;
export const MAX_POOL_SIZE = 4;
export const LOW_MEMORY_POOL_SIZE = 2;
export const LARGE_BATCH_STREAM_THRESHOLD = 200;

/**
 * Returns the maximum allowed pixel count (width * height) for a single image
 * based on reported device memory.
 */
export function getMaxPixels(deviceMemoryGb = 4): number {
  return deviceMemoryGb <= LOW_MEMORY_THRESHOLD_GB ? MAX_PIXELS_LOW_MEMORY : MAX_PIXELS_DEFAULT;
}

/**
 * Computes the worker pool concurrency limit from hardwareConcurrency and deviceMemory.
 */
export function getWorkerPoolSize(hardwareConcurrency = 4, deviceMemoryGb = 4): number {
  const cpuCap = Math.min(Math.max(hardwareConcurrency - 1, 1), MAX_POOL_SIZE);
  if (deviceMemoryGb <= LOW_MEMORY_THRESHOLD_GB) {
    return Math.min(cpuCap, LOW_MEMORY_POOL_SIZE);
  }
  return cpuCap;
}

/**
 * Checks whether an image's dimensions exceed the pixel guard.
 */
export function exceedsMaxPixels(width: number, height: number, deviceMemoryGb = 4): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }
  return width * height > getMaxPixels(deviceMemoryGb);
}
