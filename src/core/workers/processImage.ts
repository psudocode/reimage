import { decodeFile } from '../image/decode.ts';
import { wasmEncoder, type Encoder } from '../image/encode.ts';
import { fitWithinMaxPixels, resampleBitmap, scaleSize, type Size } from '../image/resample.ts';
import { exceedsMaxPixels, getMaxPixels } from '../limits.ts';
import type { ImageResult, Pipeline } from '../pipeline/types.ts';
import type { ToolContext, ToolRuntime } from '../../tools/types.ts';

export interface ProcessRequest {
  imageId: string;
  file: File;
  pipeline: Pipeline;
  /** 0 on the first try; >0 after a worker crash. Triggers a downscale. */
  attempt: number;
}

export interface ProcessDeps {
  decode(file: File): Promise<ImageBitmap>;
  getTool(id: string): ToolRuntime<unknown> | undefined;
  encode: Encoder;
  resample(input: ImageBitmap, width: number, height: number): Promise<ImageBitmap>;
  createCanvas(width: number, height: number): OffscreenCanvas;
  now(): number;
  deviceMemoryGb: number;
}

/** Pixel factor applied on the retry after a worker crash (likely out-of-memory). */
export const RETRY_PIXEL_FACTOR = 0.5;

export class UnknownToolError extends Error {
  constructor(toolId: string) {
    super(`Unknown tool "${toolId}"`);
    this.name = 'UnknownToolError';
  }
}

export class InvalidToolOptionsError extends Error {
  readonly errors: string[];
  constructor(toolId: string, errors: string[]) {
    super(`Invalid options for tool "${toolId}": ${errors.join(', ')}`);
    this.name = 'InvalidToolOptionsError';
    this.errors = errors;
  }
}

export class ImageTooLargeError extends Error {
  constructor(width: number, height: number) {
    super(`Image is too large to process (${width}x${height})`);
    this.name = 'ImageTooLargeError';
  }
}

/**
 * Decode → run each pipeline step → encode, for ONE image.
 * Pure orchestration: every environment-specific piece is injected so this runs
 * in unit tests without a browser. Intermediate bitmaps are closed eagerly.
 */
export async function processImage(
  request: ProcessRequest,
  onProgress: (fraction: number) => void,
  deps: ProcessDeps,
): Promise<ImageResult> {
  const { imageId, file, pipeline, attempt } = request;
  const started = deps.now();
  const stepCount = pipeline.steps.length;

  // Validate everything up front so we fail before spending memory on a decode.
  const tools = pipeline.steps.map((step) => {
    const tool = deps.getTool(step.toolId);
    if (!tool) throw new UnknownToolError(step.toolId);
    const errors = tool.validate(step.options);
    if (errors.length > 0) throw new InvalidToolOptionsError(step.toolId, errors);
    return tool;
  });

  let current = await deps.decode(file);
  let downscaled = false;

  const replace = async (next: Promise<ImageBitmap>) => {
    const previous = current;
    try {
      current = await next;
    } finally {
      if (previous !== current) previous.close();
    }
  };

  try {
    const source: Size = { width: current.width, height: current.height };
    if (attempt > 0) {
      const target = scaleSize(source, Math.sqrt(RETRY_PIXEL_FACTOR));
      await replace(deps.resample(current, target.width, target.height));
      downscaled = true;
    } else if (exceedsMaxPixels(source.width, source.height, deps.deviceMemoryGb)) {
      // The UI offers a downscale on load; reaching here means it was declined or
      // bypassed. Refuse rather than risk crashing the worker.
      throw new ImageTooLargeError(source.width, source.height);
    }
    // Defensive: even after the retry downscale, never exceed the hard pixel cap.
    const capped = fitWithinMaxPixels(
      { width: current.width, height: current.height },
      getMaxPixels(deps.deviceMemoryGb),
    );
    if (capped.width !== current.width || capped.height !== current.height) {
      await replace(deps.resample(current, capped.width, capped.height));
      downscaled = true;
    }

    const controller = new AbortController();
    for (let index = 0; index < stepCount; index += 1) {
      const tool = tools[index]!;
      const step = pipeline.steps[index]!;
      const context: ToolContext = {
        signal: controller.signal,
        progress: (fraction) => {
          const clamped = Math.min(1, Math.max(0, fraction));
          onProgress((index + clamped) / (stepCount + 1));
        },
        createCanvas: deps.createCanvas,
        maxPixels: getMaxPixels(deps.deviceMemoryGb),
      };
      await replace(tool.run(current, step.options, context));
      onProgress((index + 1) / (stepCount + 1));
    }

    const encoded = await deps.encode(current, pipeline.output, file.type);
    onProgress(1);

    return {
      imageId,
      blob: encoded.blob,
      width: encoded.width,
      height: encoded.height,
      bytesBefore: file.size,
      bytesAfter: encoded.blob.size,
      ms: deps.now() - started,
      ...(downscaled || encoded.downscaled ? { downscaled: true } : {}),
      ...(encoded.targetMissed ? { targetMissed: true } : {}),
    };
  } finally {
    current.close();
  }
}

/** Real-browser dependencies. Only valid inside a worker (or a window). */
export function createBrowserDeps(
  getTool: ProcessDeps['getTool'],
  deviceMemoryGb: number,
): ProcessDeps {
  return {
    decode: (file) => decodeFile(file),
    getTool,
    encode: wasmEncoder,
    resample: (input, width, height) => resampleBitmap(input, width, height),
    createCanvas: (width, height) => new OffscreenCanvas(width, height),
    now: () => performance.now(),
    deviceMemoryGb,
  };
}
