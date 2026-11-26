import { describe, expect, it } from 'vitest';
import { PoolAbortError, WorkerCrashError, WorkerPool, type PoolWorker } from './pool.ts';

interface FakeApi {
  id: number;
}

interface FakeWorker extends PoolWorker<FakeApi> {
  terminated: boolean;
  crash(reason?: unknown): void;
}

function makeFactory() {
  const workers: FakeWorker[] = [];
  const createWorker = (): PoolWorker<FakeApi> => {
    let crashCb: ((reason: unknown) => void) | null = null;
    const worker: FakeWorker = {
      api: { id: workers.length },
      terminated: false,
      terminate() {
        worker.terminated = true;
      },
      onCrash(cb) {
        crashCb = cb;
      },
      crash(reason = new Error('boom')) {
        crashCb?.(reason);
      },
    };
    workers.push(worker);
    return worker;
  };
  return { workers, createWorker };
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('WorkerPool', () => {
  it('never runs more tasks than the pool size', async () => {
    const { createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 2, createWorker });
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, () => deferred());

    const results = gates.map((gate, index) =>
      pool.run(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await gate.promise;
        running -= 1;
        return index;
      }),
    );

    await tick();
    expect(pool.active).toBe(2);
    expect(pool.pending).toBe(3);

    for (const gate of gates) {
      gate.resolve();
      await tick();
    }
    expect(await Promise.all(results)).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it('schedules heavier tasks first and keeps FIFO among equal weights', async () => {
    const { createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });
    const order: string[] = [];
    const gate = deferred();

    // Occupies the only worker so the rest queue up.
    const blocker = pool.run(async () => {
      await gate.promise;
    });
    const run = (name: string, weight: number) =>
      pool.run(
        async () => {
          order.push(name);
        },
        { weight },
      );

    const rest = [run('small-a', 1), run('big', 10), run('small-b', 1), run('medium', 5)];
    gate.resolve();
    await Promise.all([blocker, ...rest]);

    expect(order).toEqual(['big', 'medium', 'small-a', 'small-b']);
  });

  it('rejects queued tasks on abort without running them', async () => {
    const { createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });
    const gate = deferred();
    const blocker = pool.run(() => gate.promise);

    const controller = new AbortController();
    let ran = false;
    const queued = pool.run(
      async () => {
        ran = true;
      },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(queued).rejects.toBeInstanceOf(PoolAbortError);
    gate.resolve();
    await blocker;
    expect(ran).toBe(false);
  });

  it('does not start queued tasks that share an already-aborted signal', async () => {
    const { createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });
    const controller = new AbortController();
    const never = deferred();
    const started: string[] = [];

    const tasks = ['a', 'b', 'c'].map((name) =>
      pool.run(
        () => {
          started.push(name);
          return never.promise;
        },
        { signal: controller.signal },
      ),
    );
    await tick();
    controller.abort();

    for (const task of tasks) await expect(task).rejects.toBeInstanceOf(PoolAbortError);
    expect(started).toEqual(['a']);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const { createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });
    const controller = new AbortController();
    controller.abort();
    await expect(pool.run(async () => 1, { signal: controller.signal })).rejects.toBeInstanceOf(
      PoolAbortError,
    );
  });

  it('terminates and replaces the worker when an in-flight task is aborted', async () => {
    const { workers, createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });
    const controller = new AbortController();
    const never = deferred();

    const inflight = pool.run(() => never.promise, { signal: controller.signal });
    await tick();
    controller.abort();

    await expect(inflight).rejects.toBeInstanceOf(PoolAbortError);
    expect(workers[0]?.terminated).toBe(true);
    expect(workers).toHaveLength(2);

    // The pool is still usable afterwards, on the replacement worker.
    await expect(pool.run(async (api) => api.id)).resolves.toBe(1);
  });

  it('aborting one task does not affect others', async () => {
    const { createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 2, createWorker });
    const controller = new AbortController();
    const never = deferred();
    const keep = deferred<string>();

    const cancelled = pool.run(() => never.promise, { signal: controller.signal });
    const survivor = pool.run(() => keep.promise);
    await tick();
    controller.abort();
    keep.resolve('ok');

    await expect(cancelled).rejects.toBeInstanceOf(PoolAbortError);
    await expect(survivor).resolves.toBe('ok');
  });

  it('restarts a crashed worker and retries the task once with attempt=1', async () => {
    const { workers, createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });
    const attempts: number[] = [];

    const result = pool.run(async (api, ctx) => {
      attempts.push(ctx.attempt);
      if (ctx.attempt === 0) {
        workers[api.id]?.crash();
        return new Promise<string>(() => {}); // hangs, like a dead worker
      }
      return 'recovered';
    });

    await expect(result).resolves.toBe('recovered');
    expect(attempts).toEqual([0, 1]);
    expect(workers[0]?.terminated).toBe(true);
    expect(workers).toHaveLength(2);
  });

  it('fails with WorkerCrashError after exhausting retries', async () => {
    const { workers, createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });

    const result = pool.run(async (api) => {
      workers[api.id]?.crash();
      return new Promise<string>(() => {});
    });

    await expect(result).rejects.toBeInstanceOf(WorkerCrashError);
    expect(workers).toHaveLength(3); // initial + 2 replacements
    // Pool still works.
    await expect(pool.run(async () => 'alive')).resolves.toBe('alive');
  });

  it('propagates ordinary task errors without restarting the worker', async () => {
    const { workers, createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });

    await expect(
      pool.run(async () => {
        throw new Error('bad image');
      }),
    ).rejects.toThrow('bad image');
    expect(workers).toHaveLength(1);
    expect(workers[0]?.terminated).toBe(false);
  });

  it('destroy() rejects queued and in-flight work and terminates workers', async () => {
    const { workers, createWorker } = makeFactory();
    const pool = new WorkerPool({ size: 1, createWorker });
    const never = deferred();

    const inflight = pool.run(() => never.promise);
    const queued = pool.run(async () => 1);
    await tick();
    pool.destroy();

    await expect(inflight).rejects.toBeInstanceOf(PoolAbortError);
    await expect(queued).rejects.toBeInstanceOf(PoolAbortError);
    expect(workers.every((worker) => worker.terminated)).toBe(true);
    await expect(pool.run(async () => 1)).rejects.toThrow('destroyed');
  });
});
