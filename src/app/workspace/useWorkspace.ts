import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  JobRunner,
  type JobEvents,
  type JobHandle,
  type PreviewRequest,
} from '../../core/job/JobRunner.ts';
import type { ImageResult, InputImage, Job } from '../../core/pipeline/types.ts';
import { createImagePool } from '../../core/workers/imagePool.ts';
import type { CombinePage } from '../../tools/types.ts';
import { getRegisteredRuntimes, getToolRuntimeById } from '../../tools/runtimeRegistry.ts';
import { extensionForMime, outputFileName, splitAcceptedFiles, uniqueFileName } from './files.ts';
import { buildPipeline } from './pipeline.ts';
import {
  initialWorkspaceState,
  workspaceReducer,
  type WorkspaceItem,
  type WorkspaceState,
} from './state.ts';

/** What the workspace needs from a job runner. Swapped for a fake in tests. */
export interface WorkspaceRunner {
  start(job: Job, events: JobEvents): JobHandle;
  /** One image through a pipeline on a downscaled copy (live preview). */
  preview(request: PreviewRequest): Promise<ImageResult>;
  dispose(): void;
}

export interface WorkspaceDeps {
  /** Called lazily on the first run, so no workers start until the user asks. */
  createRunner(): WorkspaceRunner;
  createId(): string;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export const browserWorkspaceDeps: WorkspaceDeps = {
  createRunner() {
    const pool = createImagePool();
    const runner = new JobRunner(pool);
    return {
      start: (job, events) => runner.start(job, events),
      preview: (request) => runner.preview(request),
      dispose: () => pool.destroy(),
    };
  },
  createId: () => crypto.randomUUID(),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
};

function revokeItem(item: WorkspaceItem, deps: WorkspaceDeps) {
  deps.revokeObjectURL(item.previewUrl);
  if (item.result) deps.revokeObjectURL(item.result.url);
}

/** Pages (in the order the user sees them) of a many-to-one run. */
function orderedPages(items: WorkspaceItem[], parts: Map<string, ImageResult>): CombinePage[] {
  return items.flatMap((item) => {
    const part = parts.get(item.id);
    return part ? [{ blob: part.blob, width: part.width, height: part.height }] : [];
  });
}

export function useWorkspace(deps: WorkspaceDeps = browserWorkspaceDeps) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const [toolId, setToolIdState] = useState(() => getRegisteredRuntimes()[0]!.id);
  // Each tool keeps its own options, so switching tabs never loses what was typed.
  const [optionsByTool, setOptionsByTool] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(getRegisteredRuntimes().map((tool) => [tool.id, tool.defaults])),
  );
  const options = optionsByTool[toolId];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Event callbacks and the unmount cleanup need the latest state without re-subscribing.
  // Layout effect, not a passive one: a click right after a commit must see that commit.
  const stateRef = useRef<WorkspaceState>(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const depsRef = useRef(deps);
  const runnerRef = useRef<WorkspaceRunner | null>(null);
  const handleRef = useRef<JobHandle | null>(null);

  /** Results were made with the old settings: free them so nothing stale can be downloaded. */
  const invalidateResults = useCallback(() => {
    const { items, running, combined } = stateRef.current;
    if (running || !items.some((item) => item.status === 'done' || item.status === 'failed')) {
      return;
    }
    for (const item of items) if (item.result) depsRef.current.revokeObjectURL(item.result.url);
    if (combined) depsRef.current.revokeObjectURL(combined.url);
    dispatch({ type: 'invalidate' });
  }, []);

  const setToolId = useCallback(
    (id: string) => {
      invalidateResults();
      setToolIdState(id);
    },
    [invalidateResults],
  );
  const setOptions = useCallback(
    (next: unknown) => {
      invalidateResults();
      setOptionsByTool((previous) => ({ ...previous, [toolId]: next }));
    },
    [toolId, invalidateResults],
  );

  const ensureRunner = useCallback(() => {
    runnerRef.current ??= depsRef.current.createRunner();
    return runnerRef.current;
  }, []);

  /** What the live preview needs; stable so its effects don't re-run on every render. */
  const previewApi = useMemo(
    () => ({
      render: (request: PreviewRequest) => ensureRunner().preview(request),
      createObjectURL: (blob: Blob) => depsRef.current.createObjectURL(blob),
      revokeObjectURL: (url: string) => depsRef.current.revokeObjectURL(url),
    }),
    [ensureRunner],
  );

  const errors = useMemo(
    () => getToolRuntimeById(toolId)?.validate(options) ?? [],
    [toolId, options],
  );

  const addFiles = useCallback((files: Iterable<File>) => {
    const { accepted, rejected } = splitAcceptedFiles(files);
    const d = depsRef.current;
    const items: WorkspaceItem[] = accepted.map((file) => ({
      id: d.createId(),
      file,
      name: file.name,
      size: file.size,
      previewUrl: d.createObjectURL(file),
      status: 'ready',
      progress: 0,
    }));
    if (items.length > 0) dispatch({ type: 'add', items });
    return { added: items.length, rejected: rejected.length };
  }, []);

  const removeItem = useCallback((id: string) => {
    const item = stateRef.current.items.find((candidate) => candidate.id === id);
    if (!item) return;
    revokeItem(item, depsRef.current);
    const { combined } = stateRef.current;
    if (combined) depsRef.current.revokeObjectURL(combined.url);
    dispatch({ type: 'remove', id });
  }, []);

  const clear = useCallback(() => {
    for (const item of stateRef.current.items) revokeItem(item, depsRef.current);
    const { combined } = stateRef.current;
    if (combined) depsRef.current.revokeObjectURL(combined.url);
    dispatch({ type: 'clear' });
  }, []);

  const run = useCallback(async () => {
    const { items, running, combined } = stateRef.current;
    if (running || items.length === 0 || errors.length > 0) return;
    const d = depsRef.current;

    // Re-running replaces earlier results: free their blobs now.
    for (const item of items) if (item.result) d.revokeObjectURL(item.result.url);
    if (combined) d.revokeObjectURL(combined.url);

    const tool = getToolRuntimeById(toolId)!;
    const combine = tool.kind === 'many-to-one' ? tool.combine : undefined;
    const parts = new Map<string, ImageResult>();
    const pipeline = buildPipeline(toolId, options);
    const images: InputImage[] = items.map((item) => ({
      id: item.id,
      file: item.file,
      name: item.name,
      size: item.size,
    }));
    const job: Job = { id: d.createId(), images, pipeline, status: 'queued' };
    const usedNames = new Set<string>();
    const names = new Map(items.map((item) => [item.id, item.name]));

    dispatch({ type: 'begin' });
    const handle = ensureRunner().start(job, {
      onProgress: (id, fraction) => {
        if (handleRef.current === handle) dispatch({ type: 'progress', id, fraction });
      },
      onResult: (result) => {
        if (handleRef.current !== handle) return;
        if (combine) {
          parts.set(result.imageId, result);
          dispatch({ type: 'part', id: result.imageId });
          return;
        }
        const fileName = uniqueFileName(
          outputFileName(
            names.get(result.imageId) ?? 'image',
            pipeline.output.fileNamePattern,
            extensionForMime(result.blob.type),
          ),
          usedNames,
        );
        dispatch({
          type: 'result',
          id: result.imageId,
          result: {
            url: d.createObjectURL(result.blob),
            fileName,
            width: result.width,
            height: result.height,
            bytesAfter: result.bytesAfter,
            downscaled: result.downscaled === true,
            targetMissed: result.targetMissed === true,
          },
        });
      },
      onFailure: ({ imageId, error }) => {
        if (handleRef.current === handle) {
          dispatch({ type: 'failure', id: imageId, message: error.message });
        }
      },
    });
    handleRef.current = handle;
    const outcome = await handle.promise;
    if (combine && outcome.status === 'done' && handleRef.current === handle) {
      try {
        const blob = await combine(orderedPages(items, parts), options);
        // Cancel or a new run may have happened while the file was being built.
        if (handleRef.current === handle) {
          dispatch({
            type: 'combined',
            result: {
              url: d.createObjectURL(blob),
              fileName: outputFileName('images', '{name}.{ext}', extensionForMime(blob.type)),
              width: 0,
              height: 0,
              bytesAfter: blob.size,
              downscaled: false,
              targetMissed: false,
            },
          });
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        for (const item of items) dispatch({ type: 'failure', id: item.id, message });
      }
    }
    if (handleRef.current === handle) {
      handleRef.current = null;
      dispatch({ type: 'end' });
    }
  }, [toolId, options, errors, ensureRunner]);

  const cancel = useCallback(() => handleRef.current?.cancel(), []);

  useEffect(
    () => () => {
      // Unmount: stop work, free workers and every object URL.
      handleRef.current?.cancel();
      handleRef.current = null;
      runnerRef.current?.dispose();
      runnerRef.current = null;
      for (const item of stateRef.current.items) revokeItem(item, depsRef.current);
      const { combined } = stateRef.current;
      if (combined) depsRef.current.revokeObjectURL(combined.url);
    },
    [],
  );

  const selected = state.items.find((item) => item.id === selectedId) ?? state.items[0];

  return {
    ...state,
    selected,
    select: setSelectedId,
    previewApi,
    toolId,
    setToolId,
    options,
    setOptions,
    errors,
    addFiles,
    removeItem,
    clear,
    run,
    cancel,
  };
}
