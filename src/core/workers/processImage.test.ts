import { describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '../pipeline/types.ts';
import type { ToolRuntime } from '../../tools/types.ts';
import {
  ImageTooLargeError,
  InvalidToolOptionsError,
  UnknownToolError,
  processImage,
  type ProcessDeps,
} from './processImage.ts';

function bitmap(width: number, height: number) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap & {
    close: ReturnType<typeof vi.fn>;
  };
}

function file(size = 1000, type = 'image/jpeg') {
  return { size, type, name: 'photo.jpg' } as unknown as File;
}

const pipeline = (steps: Pipeline['steps'] = []): Pipeline => ({
  version: 1,
  steps,
  output: { format: 'webp', quality: 80, stripMetadata: true, fileNamePattern: '{name}.{ext}' },
});

function makeTool(overrides: Partial<ToolRuntime<unknown>> = {}): ToolRuntime<unknown> {
  return {
    id: 'noop',
    defaults: {},
    validate: () => [],
    run: vi.fn(async (input: ImageBitmap) => input),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ProcessDeps> = {}) {
  const decoded = bitmap(400, 300);
  const encoded = new Blob(['x'.repeat(10)], { type: 'image/webp' });
  let clock = 0;
  const deps: ProcessDeps = {
    decode: vi.fn(async () => decoded),
    getTool: vi.fn(() => undefined),
    encode: vi.fn(async (bitmap: ImageBitmap) => ({
      blob: encoded,
      width: bitmap.width,
      height: bitmap.height,
    })),
    resample: vi.fn(async (_input, width, height) => bitmap(width, height)),
    createCanvas: vi.fn(),
    now: () => (clock += 5),
    deviceMemoryGb: 8,
    ...overrides,
  };
  return { deps, decoded, encoded };
}

describe('processImage', () => {
  it('decodes, encodes and reports stats for an empty pipeline', async () => {
    const { deps, decoded, encoded } = makeDeps();
    const progress = vi.fn();

    const result = await processImage(
      { imageId: 'a', file: file(1000), pipeline: pipeline(), attempt: 0 },
      progress,
      deps,
    );

    expect(result).toMatchObject({
      imageId: 'a',
      blob: encoded,
      width: 400,
      height: 300,
      bytesBefore: 1000,
      bytesAfter: encoded.size,
    });
    expect(result.ms).toBeGreaterThan(0);
    expect(result.downscaled).toBeUndefined();
    expect(decoded.close).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenLastCalledWith(1);
  });

  it('runs steps in order and closes every intermediate bitmap', async () => {
    const first = bitmap(200, 150);
    const second = bitmap(100, 75);
    const toolA = makeTool({ id: 'a', run: vi.fn(async () => first) });
    const toolB = makeTool({ id: 'b', run: vi.fn(async () => second) });
    const { deps, decoded } = makeDeps({
      getTool: (id) => (id === 'a' ? toolA : id === 'b' ? toolB : undefined),
    });

    const result = await processImage(
      {
        imageId: 'x',
        file: file(),
        pipeline: pipeline([
          { toolId: 'a', options: { n: 1 } },
          { toolId: 'b', options: { n: 2 } },
        ]),
        attempt: 0,
      },
      vi.fn(),
      deps,
    );

    expect(toolA.run).toHaveBeenCalledWith(decoded, { n: 1 }, expect.any(Object));
    expect(toolB.run).toHaveBeenCalledWith(first, { n: 2 }, expect.any(Object));
    expect(result).toMatchObject({ width: 100, height: 75 });
    expect(decoded.close).toHaveBeenCalledTimes(1);
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
  });

  it('does not close a bitmap twice when a tool returns its input', async () => {
    const { deps, decoded } = makeDeps({ getTool: () => makeTool() });
    await processImage(
      {
        imageId: 'x',
        file: file(),
        pipeline: pipeline([{ toolId: 'noop', options: {} }]),
        attempt: 0,
      },
      vi.fn(),
      deps,
    );
    expect(decoded.close).toHaveBeenCalledTimes(1);
  });

  it('fails fast on an unknown tool, before decoding', async () => {
    const { deps } = makeDeps();
    await expect(
      processImage(
        {
          imageId: 'x',
          file: file(),
          pipeline: pipeline([{ toolId: 'nope', options: {} }]),
          attempt: 0,
        },
        vi.fn(),
        deps,
      ),
    ).rejects.toBeInstanceOf(UnknownToolError);
    expect(deps.decode).not.toHaveBeenCalled();
  });

  it('fails fast on invalid tool options, before decoding', async () => {
    const tool = makeTool({ validate: () => ['errors.badWidth'] });
    const { deps } = makeDeps({ getTool: () => tool });
    await expect(
      processImage(
        {
          imageId: 'x',
          file: file(),
          pipeline: pipeline([{ toolId: 'noop', options: {} }]),
          attempt: 0,
        },
        vi.fn(),
        deps,
      ),
    ).rejects.toBeInstanceOf(InvalidToolOptionsError);
    expect(deps.decode).not.toHaveBeenCalled();
  });

  it('closes the current bitmap when a tool throws', async () => {
    const tool = makeTool({
      run: vi.fn(async () => {
        throw new Error('tool exploded');
      }),
    });
    const { deps, decoded } = makeDeps({ getTool: () => tool });
    await expect(
      processImage(
        {
          imageId: 'x',
          file: file(),
          pipeline: pipeline([{ toolId: 'noop', options: {} }]),
          attempt: 0,
        },
        vi.fn(),
        deps,
      ),
    ).rejects.toThrow('tool exploded');
    expect(decoded.close).toHaveBeenCalledTimes(1);
  });

  it('refuses images above the pixel guard', async () => {
    const huge = bitmap(10_000, 10_000); // 100 MP
    const { deps } = makeDeps({ decode: async () => huge });
    await expect(
      processImage({ imageId: 'x', file: file(), pipeline: pipeline(), attempt: 0 }, vi.fn(), deps),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
    expect(huge.close).toHaveBeenCalledTimes(1);
  });

  it('shrinks to the preview edge before the pipeline and reports the scale', async () => {
    const run = vi.fn(async (input: ImageBitmap) => input);
    const { deps } = makeDeps({ getTool: () => makeTool({ run }) });
    const result = await processImage(
      {
        imageId: 'x',
        file: file(),
        pipeline: pipeline([{ toolId: 'noop', options: {} }]),
        attempt: 0,
        previewMaxEdge: 200,
      },
      vi.fn(),
      deps,
    );
    // 400x300 -> 200x150, and the tool saw the small bitmap.
    expect(deps.resample).toHaveBeenCalledWith(expect.anything(), 200, 150);
    expect(run.mock.calls[0]![0]).toMatchObject({ width: 200, height: 150 });
    expect(result.previewScale).toBe(0.5);
    expect(result.downscaled).toBeUndefined();
  });

  it('scales a target size down with the preview so the estimate stays honest', async () => {
    const { deps } = makeDeps();
    const request = {
      imageId: 'x',
      file: file(),
      pipeline: { ...pipeline(), output: { ...pipeline().output, targetBytes: 100_000 } },
      attempt: 0,
    };
    await processImage({ ...request, previewMaxEdge: 200 }, vi.fn(), deps);
    expect(deps.encode).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ targetBytes: 25_000 }),
      'image/jpeg',
    );
    await processImage(request, vi.fn(), deps);
    expect(deps.encode).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ targetBytes: 100_000 }),
      'image/jpeg',
    );
  });

  it('leaves a small image alone in preview mode (scale 1)', async () => {
    const { deps } = makeDeps();
    const result = await processImage(
      { imageId: 'x', file: file(), pipeline: pipeline(), attempt: 0, previewMaxEdge: 1000 },
      vi.fn(),
      deps,
    );
    expect(deps.resample).not.toHaveBeenCalled();
    expect(result.previewScale).toBe(1);
  });

  it('still applies the pixel guard to the original image in preview mode', async () => {
    const huge = bitmap(10_000, 10_000);
    const { deps } = makeDeps({ decode: async () => huge });
    await expect(
      processImage(
        { imageId: 'x', file: file(), pipeline: pipeline(), attempt: 0, previewMaxEdge: 800 },
        vi.fn(),
        deps,
      ),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
  });

  it('omits previewScale for a normal run', async () => {
    const { deps } = makeDeps();
    const result = await processImage(
      { imageId: 'x', file: file(), pipeline: pipeline(), attempt: 0 },
      vi.fn(),
      deps,
    );
    expect(result).not.toHaveProperty('previewScale');
  });

  it('downscales and flags the result on a retry attempt', async () => {
    const { deps } = makeDeps();
    const result = await processImage(
      { imageId: 'x', file: file(), pipeline: pipeline(), attempt: 1 },
      vi.fn(),
      deps,
    );
    expect(deps.resample).toHaveBeenCalledTimes(1);
    expect(result.downscaled).toBe(true);
    // 400x300 scaled by sqrt(0.5) ≈ 283x212 → about half the pixels.
    expect(result.width * result.height).toBeLessThan(400 * 300 * 0.6);
  });

  it('keeps reported progress within 0..1 and monotonic across steps', async () => {
    const tool = makeTool({
      run: vi.fn(async (input: ImageBitmap, _o: unknown, ctx) => {
        ctx.progress(0.5);
        ctx.progress(2); // out-of-range values are clamped
        return input;
      }),
    });
    const { deps } = makeDeps({ getTool: () => tool });
    const values: number[] = [];
    await processImage(
      {
        imageId: 'x',
        file: file(),
        pipeline: pipeline([{ toolId: 'noop', options: {} }]),
        attempt: 0,
      },
      (value) => values.push(value),
      deps,
    );
    expect(values.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(values.at(-1)).toBe(1);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it('uses the dimensions and flags reported by the encoder', async () => {
    const { deps } = makeDeps({
      encode: vi.fn(async () => ({
        blob: new Blob(['x']),
        width: 100,
        height: 75,
        downscaled: true,
        targetMissed: true,
      })),
    });
    const result = await processImage(
      { imageId: 'x', file: file(), pipeline: pipeline(), attempt: 0 },
      vi.fn(),
      deps,
    );
    expect(result).toMatchObject({ width: 100, height: 75, downscaled: true, targetMissed: true });
  });
});
