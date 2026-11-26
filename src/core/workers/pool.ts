/**
 * Generic, framework-free worker pool.
 *
 * - Concurrency is fixed at `size`; one task per worker at a time.
 * - FIFO queue, but heavier tasks (larger `weight`) are scheduled first.
 * - Cancellation via AbortSignal: queued tasks are dropped, in-flight tasks
 *   terminate their worker (which is replaced).
 * - Crash isolation: if a worker crashes mid-task it is replaced and the task is
 *   retried once (`attempt` = 1) before failing.
 */

export interface PoolWorker<Api> {
  api: Api;
  terminate(): void;
  /** Register a callback fired when the worker dies unexpectedly (error / OOM). */
  onCrash(callback: (reason: unknown) => void): void;
}

export interface TaskContext {
  /** 0 on first try, 1 on the retry after a worker crash. */
  attempt: number;
  signal: AbortSignal;
}

export type PoolTask<Api, R> = (api: Api, ctx: TaskContext) => Promise<R>;

export interface RunOptions {
  /** Larger weights run first (e.g. file size). Defaults to 0. */
  weight?: number;
  signal?: AbortSignal;
}

export interface WorkerPoolOptions<Api> {
  size: number;
  createWorker: () => PoolWorker<Api>;
  /** Max automatic retries after a worker crash. Defaults to 1. */
  maxRetries?: number;
}

export class PoolAbortError extends Error {
  constructor(message = 'Task was cancelled') {
    super(message);
    this.name = 'AbortError';
  }
}

export class WorkerCrashError extends Error {
  readonly reason: unknown;
  constructor(reason: unknown) {
    super('Worker crashed while processing a task');
    this.name = 'WorkerCrashError';
    this.reason = reason;
  }
}

interface QueuedTask<Api> {
  run: PoolTask<Api, unknown>;
  weight: number;
  seq: number;
  attempt: number;
  signal: AbortSignal;
  /** Caller-provided signal; checked again right before a task starts. */
  external: AbortSignal | undefined;
  resolve(value: unknown): void;
  reject(reason: unknown): void;
  cleanup(): void;
}

interface Slot<Api> {
  worker: PoolWorker<Api>;
  current: QueuedTask<Api> | null;
  crash: ((reason: unknown) => void) | null;
}

export class WorkerPool<Api> {
  private readonly size: number;
  private readonly createWorker: () => PoolWorker<Api>;
  private readonly maxRetries: number;
  private readonly slots: Slot<Api>[] = [];
  private queue: QueuedTask<Api>[] = [];
  private seq = 0;
  private destroyed = false;

  constructor(options: WorkerPoolOptions<Api>) {
    this.size = Math.max(1, Math.floor(options.size));
    this.createWorker = options.createWorker;
    this.maxRetries = options.maxRetries ?? 1;
  }

  get concurrency(): number {
    return this.size;
  }

  get pending(): number {
    return this.queue.length;
  }

  get active(): number {
    return this.slots.filter((slot) => slot.current !== null).length;
  }

  run<R>(task: PoolTask<Api, R>, options: RunOptions = {}): Promise<R> {
    if (this.destroyed) {
      return Promise.reject(new Error('Worker pool has been destroyed'));
    }
    const { signal: external, weight = 0 } = options;
    if (external?.aborted) {
      return Promise.reject(new PoolAbortError());
    }

    return new Promise<R>((resolve, reject) => {
      // Per-task controller so cancelling one task never affects others.
      const controller = new AbortController();
      const onExternalAbort = () => this.cancel(entry);
      external?.addEventListener('abort', onExternalAbort, { once: true });

      const entry: QueuedTask<Api> = {
        run: task as PoolTask<Api, unknown>,
        weight,
        seq: this.seq++,
        attempt: 0,
        signal: controller.signal,
        external,
        resolve: resolve as (value: unknown) => void,
        reject,
        cleanup: () => external?.removeEventListener('abort', onExternalAbort),
      };
      this.abortControllers.set(entry, controller);
      this.enqueue(entry);
      this.pump();
    });
  }

  /** Cancel everything (queued + in-flight) and shut down all workers. */
  destroy(): void {
    this.destroyed = true;
    const queued = this.queue;
    this.queue = [];
    for (const entry of queued) this.fail(entry, new PoolAbortError('Worker pool destroyed'));
    for (const slot of this.slots) {
      const entry = slot.current;
      slot.current = null;
      slot.crash = null;
      slot.worker.terminate();
      if (entry) this.fail(entry, new PoolAbortError('Worker pool destroyed'));
    }
    this.slots.length = 0;
  }

  // -- internals ------------------------------------------------------------

  private readonly abortControllers = new Map<QueuedTask<Api>, AbortController>();

  private enqueue(entry: QueuedTask<Api>): void {
    this.queue.push(entry);
    // Heavier first; stable FIFO among equal weights (seq).
    this.queue.sort((a, b) => b.weight - a.weight || a.seq - b.seq);
  }

  private pump(): void {
    if (this.destroyed) return;
    while (this.queue.length > 0) {
      const slot = this.acquireSlot();
      if (!slot) return;
      const entry = this.queue.shift();
      if (!entry) return;
      // A bulk abort fires listeners one by one; don't start work whose signal
      // has already been aborted but whose own listener hasn't run yet.
      if (entry.external?.aborted) {
        this.abortControllers.get(entry)?.abort();
        this.fail(entry, new PoolAbortError());
        continue;
      }
      this.start(slot, entry);
    }
  }

  private acquireSlot(): Slot<Api> | null {
    const idle = this.slots.find((slot) => slot.current === null);
    if (idle) return idle;
    if (this.slots.length < this.size) {
      const slot = this.spawnSlot();
      this.slots.push(slot);
      return slot;
    }
    return null;
  }

  private spawnSlot(): Slot<Api> {
    const slot: Slot<Api> = { worker: this.createWorker(), current: null, crash: null };
    this.wireCrash(slot);
    return slot;
  }

  private wireCrash(slot: Slot<Api>): void {
    const worker = slot.worker;
    worker.onCrash((reason) => {
      // Ignore crashes from workers we already replaced/terminated.
      if (slot.worker !== worker) return;
      this.handleCrash(slot, reason);
    });
  }

  private start(slot: Slot<Api>, entry: QueuedTask<Api>): void {
    slot.current = entry;
    const { worker } = slot;
    let settled = false;

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (slot.current === entry) slot.current = null;
      fn();
      this.pump();
    };

    slot.crash = (reason) => {
      done(() => this.retryOrFail(entry, reason));
    };

    entry.run(worker.api, { attempt: entry.attempt, signal: entry.signal }).then(
      (value) => done(() => this.succeed(entry, value)),
      (error) => done(() => this.fail(entry, error)),
    );
  }

  private handleCrash(slot: Slot<Api>, reason: unknown): void {
    slot.worker.terminate();
    const crash = slot.crash;
    slot.crash = null;
    slot.worker = this.createWorker();
    this.wireCrash(slot);
    if (crash) crash(reason);
    else this.pump();
  }

  private retryOrFail(entry: QueuedTask<Api>, reason: unknown): void {
    if (entry.signal.aborted) {
      this.fail(entry, new PoolAbortError());
      return;
    }
    if (entry.attempt < this.maxRetries) {
      entry.attempt += 1;
      this.enqueue(entry);
      return;
    }
    this.fail(entry, new WorkerCrashError(reason));
  }

  private cancel(entry: QueuedTask<Api>): void {
    this.abortControllers.get(entry)?.abort();

    const queuedIndex = this.queue.indexOf(entry);
    if (queuedIndex !== -1) {
      this.queue.splice(queuedIndex, 1);
      this.fail(entry, new PoolAbortError());
      return;
    }

    const slot = this.slots.find((candidate) => candidate.current === entry);
    if (!slot) return;
    // In-flight: kill the worker (the only reliable way to stop WASM/canvas work),
    // replace it, and reject the task.
    slot.current = null;
    slot.crash = null;
    slot.worker.terminate();
    slot.worker = this.createWorker();
    this.wireCrash(slot);
    this.fail(entry, new PoolAbortError());
    this.pump();
  }

  private succeed(entry: QueuedTask<Api>, value: unknown): void {
    this.release(entry);
    entry.resolve(value);
  }

  private fail(entry: QueuedTask<Api>, error: unknown): void {
    this.release(entry);
    entry.reject(error);
  }

  private release(entry: QueuedTask<Api>): void {
    entry.cleanup();
    this.abortControllers.delete(entry);
  }
}
