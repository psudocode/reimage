import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { JobRunner, type JobEvents, type JobHandle } from '../../core/job/JobRunner.ts';
import type { InputImage, Job } from '../../core/pipeline/types.ts';
import { createImagePool } from '../../core/workers/imagePool.ts';
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
    return { start: (job, events) => runner.start(job, events), dispose: () => pool.destroy() };
  },
  createId: () => crypto.randomUUID(),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
};

function revokeItem(item: WorkspaceItem, deps: WorkspaceDeps) {
  deps.revokeObjectURL(item.previewUrl);
  if (item.result) deps.revokeObjectURL(item.result.url);
}

export function useWorkspace(deps: WorkspaceDeps = browserWorkspaceDeps) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const [toolId, setToolId] = useState(() => getRegisteredRuntimes()[0]!.id);
  // Each tool keeps its own options, so switching tabs never loses what was typed.
  const [optionsByTool, setOptionsByTool] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(getRegisteredRuntimes().map((tool) => [tool.id, tool.defaults])),
  );
  const options = optionsByTool[toolId];
  const setOptions = useCallback(
    (next: unknown) => setOptionsByTool((previous) => ({ ...previous, [toolId]: next })),
    [toolId],
  );

  // Event callbacks and the unmount cleanup need the latest state without re-subscribing.
  // Layout effect, not a passive one: a click right after a commit must see that commit.
  const stateRef = useRef<WorkspaceState>(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const depsRef = useRef(deps);
  const runnerRef = useRef<WorkspaceRunner | null>(null);
  const handleRef = useRef<JobHandle | null>(null);

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
    dispatch({ type: 'remove', id });
  }, []);

  const clear = useCallback(() => {
    for (const item of stateRef.current.items) revokeItem(item, depsRef.current);
    dispatch({ type: 'clear' });
  }, []);

  const run = useCallback(async () => {
    const { items, running } = stateRef.current;
    if (running || items.length === 0 || errors.length > 0) return;
    const d = depsRef.current;

    // Re-running replaces earlier results: free their blobs now.
    for (const item of items) if (item.result) d.revokeObjectURL(item.result.url);

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
    runnerRef.current ??= d.createRunner();
    const handle = runnerRef.current.start(job, {
      onProgress: (id, fraction) => {
        if (handleRef.current === handle) dispatch({ type: 'progress', id, fraction });
      },
      onResult: (result) => {
        if (handleRef.current !== handle) return;
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
    await handle.promise;
    if (handleRef.current === handle) {
      handleRef.current = null;
      dispatch({ type: 'end' });
    }
  }, [toolId, options, errors]);

  const cancel = useCallback(() => handleRef.current?.cancel(), []);

  useEffect(
    () => () => {
      // Unmount: stop work, free workers and every object URL.
      handleRef.current?.cancel();
      handleRef.current = null;
      runnerRef.current?.dispose();
      runnerRef.current = null;
      for (const item of stateRef.current.items) revokeItem(item, depsRef.current);
    },
    [],
  );

  return {
    ...state,
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
