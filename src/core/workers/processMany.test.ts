import { describe, expect, it, vi } from 'vitest';
import type { Pipeline } from '../pipeline/types.ts';
import type { ToolRuntime } from '../../tools/types.ts';
import { ImageTooLargeError, InvalidToolOptionsError, UnknownToolError } from './processImage.ts';
import type { ProcessDeps } from './processImage.ts';
import { ManyToOneError, processMany } from './processMany.ts';

function bitmap(width: number, height: number) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap & {
    close: ReturnType<typeof vi.fn>;
  };
}
const file = (size = 1000, type = 'image/jpeg') => ({ size, type }) as unknown as File;

const pipeline = (toolId = 'merge'): Pipeline => ({
  version: 1,
  steps: [{ toolId, options: {} }],
  output: { format: 'original', stripMetadata: true, fileNamePattern: '{name}.{ext}' },
});

function setup(tool: Partial<ToolRuntime<unknown>> | undefined, decodedSizes: number[][]) {
  const decoded = decodedSizes.map(([w, h]) => bitmap(w!, h!));
  const merged = bitmap(500, 100);
  const runMany = vi.fn<(inputs: ImageBitmap[]) => Promise<ImageBitmap>>(async () => merged);
  const runtime: ToolRuntime<unknown> | undefined = tool && {
    id: 'merge',
    defaults: {},
    validate: () => [],
    run: vi.fn(async (input: ImageBitmap) => input),
    runMany,
    ...tool,
  };
  let next = 0;
  let clock = 0;
  const encoded = new Blob(['12345'], { type: 'image/jpeg' });
  const deps: ProcessDeps = {
    decode: vi.fn(async () => decoded[next++]!),
    getTool: () => runtime,
    encode: vi.fn(async (input: ImageBitmap) => ({
      blob: encoded,
      width: input.width,
      height: input.height,
    })),
    resample: vi.fn(async (_input, width, height) => bitmap(width, height)),
    createCanvas: vi.fn(),
    now: () => (clock += 5),
    deviceMemoryGb: 8,
  };
  return { deps, decoded, merged, runMany, encoded };
}

describe('processMany', () => {
  it('decodes every file, runs the tool once and encodes one result', async () => {
    const { deps, decoded, merged, runMany } = setup({}, [
      [300, 100],
      [200, 100],
    ]);
    const progress = vi.fn();
    const result = await processMany(
      {
        imageId: 'job',
        files: [file(1000), file(2000, 'image/png')],
        pipeline: pipeline(),
        attempt: 0,
      },
      progress,
      deps,
    );
    expect(runMany).toHaveBeenCalledTimes(1);
    expect(runMany.mock.calls[0]![0]).toEqual(decoded);
    expect(deps.encode).toHaveBeenCalledWith(merged, pipeline().output, 'image/jpeg');
    expect(result).toMatchObject({
      imageId: 'job',
      width: 500,
      height: 100,
      bytesBefore: 3000,
      bytesAfter: 5,
    });
    expect(result.previewScale).toBeUndefined();
    expect(progress).toHaveBeenLastCalledWith(1);
    for (const input of decoded) expect(input.close).toHaveBeenCalledTimes(1);
    expect(merged.close).toHaveBeenCalledTimes(1);
  });

  it('shrinks inputs for a preview and reports the scale', async () => {
    const { deps, runMany } = setup({}, [
      [4000, 2000],
      [1000, 500],
    ]);
    const result = await processMany(
      {
        imageId: 'p',
        files: [file(), file()],
        pipeline: pipeline(),
        attempt: 0,
        previewMaxEdge: 1000,
      },
      () => {},
      deps,
    );
    expect(deps.resample).toHaveBeenCalledTimes(1);
    expect(deps.resample).toHaveBeenCalledWith(expect.anything(), 1000, 500);
    expect(result.previewScale).toBeCloseTo(0.25);
    expect(runMany).toHaveBeenCalledTimes(1);
  });

  it('downscales every input after a worker crash', async () => {
    const { deps } = setup({}, [
      [1000, 1000],
      [1000, 1000],
    ]);
    const result = await processMany(
      { imageId: 'r', files: [file(), file()], pipeline: pipeline(), attempt: 1 },
      () => {},
      deps,
    );
    expect(deps.resample).toHaveBeenCalledTimes(2);
    expect(result.downscaled).toBe(true);
  });

  it('refuses an oversized input and still frees what it decoded', async () => {
    const { deps, decoded } = setup({}, [
      [100, 100],
      [10_000, 10_000],
    ]);
    await expect(
      processMany(
        { imageId: 'x', files: [file(), file()], pipeline: pipeline(), attempt: 0 },
        () => {},
        deps,
      ),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
    for (const input of decoded) expect(input.close).toHaveBeenCalledTimes(1);
  });

  it('refuses when the decoded inputs together are too big', async () => {
    const { deps } = setup(
      {},
      Array.from({ length: 6 }, () => [7000, 7000]),
    );
    await expect(
      processMany(
        {
          imageId: 'x',
          files: Array.from({ length: 6 }, () => file()),
          pipeline: pipeline(),
          attempt: 0,
        },
        () => {},
        deps,
      ),
    ).rejects.toBeInstanceOf(ImageTooLargeError);
  });

  it('validates the pipeline before decoding anything', async () => {
    const request = { imageId: 'x', files: [file(), file()], attempt: 0 };
    const unknown = setup(undefined, []);
    await expect(
      processMany({ ...request, pipeline: pipeline() }, () => {}, unknown.deps),
    ).rejects.toBeInstanceOf(UnknownToolError);

    const single = setup({ runMany: undefined }, []);
    await expect(
      processMany({ ...request, pipeline: pipeline() }, () => {}, single.deps),
    ).rejects.toBeInstanceOf(ManyToOneError);

    const invalid = setup({ validate: () => ['nope'] }, []);
    await expect(
      processMany({ ...request, pipeline: pipeline() }, () => {}, invalid.deps),
    ).rejects.toBeInstanceOf(InvalidToolOptionsError);

    const twoSteps = setup({}, []);
    const doubled = pipeline();
    doubled.steps.push(doubled.steps[0]!);
    await expect(
      processMany({ ...request, pipeline: doubled }, () => {}, twoSteps.deps),
    ).rejects.toBeInstanceOf(ManyToOneError);
    expect(twoSteps.deps.decode).not.toHaveBeenCalled();
  });
});
