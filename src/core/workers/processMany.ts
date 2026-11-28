import { fitWithinMaxEdge, scaleSize, type Size } from '../image/resample.ts';
import { exceedsMaxPixels, getMaxPixels } from '../limits.ts';
import type { ImageResult, Pipeline } from '../pipeline/types.ts';
import type { ToolContext } from '../../tools/types.ts';
import {
  ImageTooLargeError,
  InvalidToolOptionsError,
  RETRY_PIXEL_FACTOR,
  UnknownToolError,
  type ProcessDeps,
} from './processImage.ts';

export interface ProcessManyRequest {
  /** Id the result is reported under (it belongs to no single input). */
  imageId: string;
  files: File[];
  /** Exactly one step, and its tool must have `runMany`. */
  pipeline: Pipeline;
  /** 0 on the first try; >0 after a worker crash. Triggers a downscale. */
  attempt: number;
  /** Live preview: shrink every input so its longest side is at most this many pixels. */
  previewMaxEdge?: number;
}

export class ManyToOneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManyToOneError';
  }
}

/** Decoded inputs together may hold this many times the single-image pixel cap. */
export const MAX_TOTAL_PIXELS_FACTOR = 4;

/**
 * Decode every file → run the tool's `runMany` → encode ONE result.
 * The counterpart of `processImage` for tools that combine images (merge,
 * collage). The same guards apply: each input obeys the pixel cap, and the
 * decoded inputs together obey `MAX_TOTAL_PIXELS_FACTOR` times that cap.
 */
export async function processMany(
  request: ProcessManyRequest,
  onProgress: (fraction: number) => void,
  deps: ProcessDeps,
): Promise<ImageResult> {
  const { imageId, files, pipeline, attempt, previewMaxEdge } = request;
  const started = deps.now();

  const [step, ...rest] = pipeline.steps;
  if (!step || rest.length > 0) throw new ManyToOneError('Combining takes exactly one step');
  const tool = deps.getTool(step.toolId);
  if (!tool) throw new UnknownToolError(step.toolId);
  if (!tool.runMany) throw new ManyToOneError(`Tool "${step.toolId}" cannot combine images`);
  const errors = tool.validate(step.options);
  if (errors.length > 0) throw new InvalidToolOptionsError(step.toolId, errors);

  const maxPixels = getMaxPixels(deps.deviceMemoryGb);
  const bitmaps: ImageBitmap[] = [];
  let downscaled = false;
  let totalPixels = 0;
  /** The scale of the largest original, which stands for the whole preview. */
  let previewScale: number | undefined;
  let largestOriginal = 0;

  try {
    for (const file of files) {
      let bitmap = await deps.decode(file);
      bitmaps.push(bitmap);
      const decoded: Size = { width: bitmap.width, height: bitmap.height };
      if (attempt === 0 && exceedsMaxPixels(decoded.width, decoded.height, deps.deviceMemoryGb)) {
        throw new ImageTooLargeError(decoded.width, decoded.height);
      }
      let target = decoded;
      if (attempt > 0) {
        target = scaleSize(target, Math.sqrt(RETRY_PIXEL_FACTOR));
        downscaled = true;
      }
      if (previewMaxEdge !== undefined) {
        target = fitWithinMaxEdge(target, previewMaxEdge);
        const edge = Math.max(decoded.width, decoded.height);
        if (edge > largestOriginal) {
          largestOriginal = edge;
          previewScale = Math.max(target.width, target.height) / edge;
        }
      }
      if (target.width !== decoded.width || target.height !== decoded.height) {
        const resized = await deps.resample(bitmap, target.width, target.height);
        bitmap.close();
        bitmap = resized;
        bitmaps[bitmaps.length - 1] = bitmap;
      }
      totalPixels += bitmap.width * bitmap.height;
      if (totalPixels > maxPixels * MAX_TOTAL_PIXELS_FACTOR) {
        throw new ImageTooLargeError(bitmap.width, bitmap.height);
      }
      onProgress((bitmaps.length / files.length) * 0.5);
    }

    const controller = new AbortController();
    const context: ToolContext = {
      signal: controller.signal,
      progress: (fraction) => onProgress(0.5 + Math.min(1, Math.max(0, fraction)) * 0.4),
      createCanvas: deps.createCanvas,
      maxPixels,
    };
    const merged = await tool.runMany(bitmaps, step.options, context);
    try {
      const firstType = files[0]?.type ?? '';
      const encoded = await deps.encode(merged, pipeline.output, firstType);
      onProgress(1);
      return {
        imageId,
        blob: encoded.blob,
        width: encoded.width,
        height: encoded.height,
        bytesBefore: files.reduce((sum, file) => sum + file.size, 0),
        bytesAfter: encoded.blob.size,
        ms: deps.now() - started,
        ...(downscaled || encoded.downscaled ? { downscaled: true } : {}),
        ...(encoded.targetMissed ? { targetMissed: true } : {}),
        ...(previewScale !== undefined ? { previewScale } : {}),
      };
    } finally {
      if (!bitmaps.includes(merged)) merged.close();
    }
  } finally {
    for (const bitmap of bitmaps) bitmap.close();
  }
}
