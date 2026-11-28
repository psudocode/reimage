import * as Comlink from 'comlink';
import type { ImageResult, InputImage, Job, JobStatus, Pipeline } from '../pipeline/types.ts';
import { PoolAbortError, type WorkerPool } from '../workers/pool.ts';
import type { ImageWorkerApi } from '../workers/image.worker.ts';

/**
 * What the runner needs from a pool: `run`, nothing else. Using `Pick` keeps the
 * real `WorkerPool<Remote<ImageWorkerApi>>` assignable (the class itself is
 * invariant because of its private fields) while tests pass a fake.
 */
export type ImageWorkerPoolLike = Pick<WorkerPool<Comlink.Remote<ImageWorkerApi>>, 'run'>;

export interface ImageFailure {
  imageId: string;
  error: Error;
}

export interface JobOutcome {
  jobId: string;
  /** `done` = at least one image succeeded (or no images); `failed` = every image failed. */
  status: Extract<JobStatus, 'done' | 'failed' | 'cancelled'>;
  results: ImageResult[];
  failures: ImageFailure[];
}

export interface JobEvents {
  onStatus?(status: JobStatus): void;
  /** `fraction` is for this image; `overall` is the mean across the whole job (both 0..1). */
  onProgress?(imageId: string, fraction: number, overall: number): void;
  onResult?(result: ImageResult): void;
  onFailure?(failure: ImageFailure): void;
}

export interface JobHandle {
  readonly id: string;
  readonly status: JobStatus;
  /** Resolves once every image has settled. Never rejects. */
  readonly promise: Promise<JobOutcome>;
  cancel(): void;
}

/** Longest side, in pixels, of the downscaled copy a live preview runs on. */
export const PREVIEW_MAX_EDGE = 1024;

export interface PreviewRequest {
  imageId: string;
  file: File;
  pipeline: Pipeline;
  /** Defaults to `PREVIEW_MAX_EDGE`. */
  maxEdge?: number;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Splits a batch into per-image tasks, feeds them to the worker pool, and
 * reports progress. One failing image never fails the rest of the batch.
 */
export class JobRunner {
  private readonly pool: ImageWorkerPoolLike;

  constructor(pool: ImageWorkerPoolLike) {
    this.pool = pool;
  }

  /**
   * Runs one image through a pipeline on a downscaled copy, for live preview.
   * The result is small and fast; `previewScale` says how far it was shrunk.
   * Shares the job pool, so it never starts more workers than a normal run.
   */
  preview(request: PreviewRequest, signal?: AbortSignal): Promise<ImageResult> {
    const { imageId, file, pipeline, maxEdge = PREVIEW_MAX_EDGE } = request;
    return this.pool.run(
      (api, ctx) =>
        api.process(
          { imageId, file, pipeline, attempt: ctx.attempt, previewMaxEdge: maxEdge },
          Comlink.proxy(() => {}),
        ),
      { weight: 0, signal },
    );
  }

  start(job: Job, events: JobEvents = {}): JobHandle {
    const controller = new AbortController();
    const progress = new Map<string, number>(job.images.map((image) => [image.id, 0]));
    const results: ImageResult[] = [];
    const failures: ImageFailure[] = [];
    let status: JobStatus = 'queued';

    const setStatus = (next: JobStatus) => {
      if (status === next) return;
      status = next;
      events.onStatus?.(next);
    };

    const overall = () => {
      if (progress.size === 0) return 1;
      let sum = 0;
      for (const value of progress.values()) sum += value;
      return sum / progress.size;
    };

    const reportProgress = (imageId: string, fraction: number) => {
      // Ignore late progress from a cancelled/finished image and never go backwards.
      const previous = progress.get(imageId);
      if (previous === undefined || fraction <= previous) return;
      progress.set(imageId, Math.min(1, fraction));
      events.onProgress?.(imageId, Math.min(1, fraction), overall());
    };

    const runImage = async (image: InputImage) => {
      try {
        const result = await this.pool.run(
          (api, ctx) =>
            api.process(
              { imageId: image.id, file: image.file, pipeline: job.pipeline, attempt: ctx.attempt },
              Comlink.proxy((fraction: number) => reportProgress(image.id, fraction)),
            ),
          { weight: image.size, signal: controller.signal },
        );
        reportProgress(image.id, 1);
        results.push(result);
        events.onResult?.(result);
      } catch (cause) {
        if (cause instanceof PoolAbortError || controller.signal.aborted) return;
        const failure = { imageId: image.id, error: toError(cause) };
        failures.push(failure);
        events.onFailure?.(failure);
      }
    };

    const promise = (async (): Promise<JobOutcome> => {
      setStatus('running');
      // Submit biggest files first: the pool starts the first task immediately, so
      // ordering has to happen here (technical.md §7: reduces tail latency).
      const ordered = [...job.images].sort((a, b) => b.size - a.size);
      await Promise.all(ordered.map(runImage));

      let final: JobOutcome['status'];
      if (controller.signal.aborted) final = 'cancelled';
      else if (job.images.length > 0 && results.length === 0) final = 'failed';
      else final = 'done';
      setStatus(final);
      return { jobId: job.id, status: final, results, failures };
    })();

    return {
      id: job.id,
      get status() {
        return status;
      },
      promise,
      cancel: () => controller.abort(),
    };
  }
}
