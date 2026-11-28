import { describe, expect, it, vi } from 'vitest';
import type { ImageResult, InputImage, Job, Pipeline } from '../pipeline/types.ts';
import { WorkerPool, type PoolWorker } from '../workers/pool.ts';
import { JobRunner, PREVIEW_MAX_EDGE, type ImageWorkerPoolLike } from './JobRunner.ts';

type ManyFn = (
  request: { imageId: string; files: unknown[]; attempt: number; previewMaxEdge?: number },
  onProgress: (fraction: number) => void,
) => Promise<ImageResult>;

type ProcessFn = (
  request: { imageId: string; attempt: number; previewMaxEdge?: number },
  onProgress: (fraction: number) => void,
) => Promise<ImageResult>;

function makePool(process: ProcessFn, size = 2, processMany: ManyFn = async () => result('x')) {
  const createWorker = (): PoolWorker<{ process: ProcessFn; processMany: ManyFn }> => ({
    api: { process, processMany },
    terminate: () => {},
    onCrash: () => {},
  });
  return new WorkerPool({ size, createWorker }) as unknown as ImageWorkerPoolLike;
}

const pipeline: Pipeline = {
  version: 1,
  steps: [],
  output: { format: 'webp', stripMetadata: true, fileNamePattern: '{name}.{ext}' },
};

function image(id: string, size = 100): InputImage {
  return { id, name: `${id}.jpg`, size, file: { size } as unknown as File };
}

function job(images: InputImage[]): Job {
  return { id: 'job-1', images, pipeline, status: 'queued' };
}

function result(imageId: string): ImageResult {
  return {
    imageId,
    blob: new Blob(['x']),
    width: 1,
    height: 1,
    bytesBefore: 10,
    bytesAfter: 1,
    ms: 1,
  };
}

describe('JobRunner', () => {
  it('processes every image and reports results + status transitions', async () => {
    const pool = makePool(async (request) => result(request.imageId));
    const statuses: string[] = [];
    const onResult = vi.fn();

    const handle = new JobRunner(pool).start(job([image('a'), image('b'), image('c')]), {
      onStatus: (status) => statuses.push(status),
      onResult,
    });
    const outcome = await handle.promise;

    expect(outcome.status).toBe('done');
    expect(outcome.results.map((r) => r.imageId).sort()).toEqual(['a', 'b', 'c']);
    expect(outcome.failures).toEqual([]);
    expect(onResult).toHaveBeenCalledTimes(3);
    expect(statuses).toEqual(['running', 'done']);
    expect(handle.status).toBe('done');
  });

  it('isolates failures: one bad image does not fail the batch', async () => {
    const pool = makePool(async (request) => {
      if (request.imageId === 'bad') throw new Error('corrupt file');
      return result(request.imageId);
    });
    const onFailure = vi.fn();

    const outcome = await new JobRunner(pool).start(job([image('ok'), image('bad')]), { onFailure })
      .promise;

    expect(outcome.status).toBe('done');
    expect(outcome.results.map((r) => r.imageId)).toEqual(['ok']);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]?.imageId).toBe('bad');
    expect(outcome.failures[0]?.error.message).toBe('corrupt file');
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('marks the job failed when every image fails', async () => {
    const pool = makePool(async () => {
      throw new Error('nope');
    });
    const outcome = await new JobRunner(pool).start(job([image('a'), image('b')])).promise;
    expect(outcome.status).toBe('failed');
    expect(outcome.failures).toHaveLength(2);
  });

  it('finishes immediately for an empty job', async () => {
    const outcome = await new JobRunner(makePool(async () => result('x'))).start(job([])).promise;
    expect(outcome).toMatchObject({ status: 'done', results: [], failures: [] });
  });

  it('reports per-image and overall progress, monotonically', async () => {
    const pool = makePool(async (request, onProgress) => {
      onProgress(0.5);
      onProgress(0.25); // regressions are ignored
      return result(request.imageId);
    });
    const events: Array<[string, number, number]> = [];

    await new JobRunner(pool).start(job([image('a'), image('b')]), {
      onProgress: (id, fraction, overall) => events.push([id, fraction, overall]),
    }).promise;

    const overall = events.map(([, , o]) => o);
    expect([...overall].sort((x, y) => x - y)).toEqual(overall);
    expect(overall.at(-1)).toBe(1);
    expect(events.every(([, fraction]) => fraction >= 0 && fraction <= 1)).toBe(true);
  });

  it('cancel() drops queued images and resolves as cancelled without failures', async () => {
    const started: string[] = [];
    const pool = makePool(
      (request) =>
        new Promise<ImageResult>(() => {
          started.push(request.imageId); // never settles; only cancellation ends it
        }),
      1,
    );

    const handle = new JobRunner(pool).start(job([image('a'), image('b'), image('c')]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    handle.cancel();
    const outcome = await handle.promise;

    expect(started).toEqual(['a']);
    expect(outcome.status).toBe('cancelled');
    expect(outcome.failures).toEqual([]);
    expect(outcome.results).toEqual([]);
  });

  it('schedules larger files first', async () => {
    const order: string[] = [];
    const pool = makePool(async (request) => {
      order.push(request.imageId);
      return result(request.imageId);
    }, 1);

    await new JobRunner(pool).start(
      job([image('small', 10), image('huge', 1000), image('mid', 100)]),
    ).promise;

    expect(order).toEqual(['huge', 'mid', 'small']);
  });

  it('passes the pool retry attempt through to the worker', async () => {
    const seen: number[] = [];
    const pool = makePool(async (request) => {
      seen.push(request.attempt);
      return result(request.imageId);
    });
    await new JobRunner(pool).start(job([image('a')])).promise;
    expect(seen).toEqual([0]);
  });

  it('previews one image on a downscaled copy', async () => {
    const seen: Array<{ imageId: string; previewMaxEdge?: number }> = [];
    const pool = makePool(async (request) => {
      seen.push(request);
      return { ...result(request.imageId), previewScale: 0.25 };
    });
    const runner = new JobRunner(pool);

    const first = await runner.preview({ imageId: 'a', file: image('a').file, pipeline });
    expect(first.previewScale).toBe(0.25);
    await runner.preview({ imageId: 'b', file: image('b').file, pipeline, maxEdge: 300 });

    expect(seen).toEqual([
      expect.objectContaining({ imageId: 'a', previewMaxEdge: PREVIEW_MAX_EDGE }),
      expect.objectContaining({ imageId: 'b', previewMaxEdge: 300 }),
    ]);
  });

  describe('combined jobs (many-to-one)', () => {
    const combined = (images: InputImage[]): Job => ({ ...job(images), combine: true });

    it('sends every file in one task and reports one result under the job id', async () => {
      const process = vi.fn(async (request: { imageId: string }) => result(request.imageId));
      const processMany = vi.fn<ManyFn>(async (request, onProgress) => {
        onProgress(0.5);
        return result(request.imageId);
      });
      const onResult = vi.fn();
      const onProgress = vi.fn();

      const outcome = await new JobRunner(makePool(process, 2, processMany)).start(
        combined([image('a'), image('b'), image('c')]),
        { onResult, onProgress },
      ).promise;

      expect(process).not.toHaveBeenCalled();
      expect(processMany).toHaveBeenCalledTimes(1);
      expect(processMany.mock.calls[0]![0]).toMatchObject({ imageId: 'job-1', attempt: 0 });
      expect(processMany.mock.calls[0]![0].files).toHaveLength(3);
      expect(outcome.status).toBe('done');
      expect(outcome.results.map((r) => r.imageId)).toEqual(['job-1']);
      expect(onResult).toHaveBeenCalledTimes(1);
      // Every input moves with the one task.
      expect(onProgress).toHaveBeenCalledWith('a', 0.5, expect.any(Number));
      expect(onProgress).toHaveBeenLastCalledWith(expect.any(String), 1, 1);
    });

    it('fails the job when the one task fails', async () => {
      const onFailure = vi.fn();
      const pool = makePool(
        async (request) => result(request.imageId),
        2,
        async () => {
          throw new Error('boom');
        },
      );
      const outcome = await new JobRunner(pool).start(combined([image('a'), image('b')]), {
        onFailure,
      }).promise;
      expect(outcome.status).toBe('failed');
      expect(onFailure).toHaveBeenCalledWith({ imageId: 'job-1', error: expect.any(Error) });
    });

    it('cancels', async () => {
      const pool = makePool(
        async (request) => result(request.imageId),
        1,
        () => new Promise<ImageResult>(() => {}),
      );
      const handle = new JobRunner(pool).start(combined([image('a'), image('b')]));
      handle.cancel();
      expect((await handle.promise).status).toBe('cancelled');
    });

    it('previews many files as one small image', async () => {
      const processMany = vi.fn<ManyFn>(async (request) => result(request.imageId));
      const preview = await new JobRunner(
        makePool(async () => result('x'), 2, processMany),
      ).previewMany({
        imageId: 'p',
        files: [{} as File, {} as File],
        pipeline,
      });
      expect(preview.imageId).toBe('p');
      expect(processMany.mock.calls[0]![0]).toMatchObject({ previewMaxEdge: PREVIEW_MAX_EDGE });
    });
  });
});
