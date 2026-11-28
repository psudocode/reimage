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
import { getRegisteredRuntimes, getToolRuntimeById } from '../../tools/runtimeRegistry.ts';
import { extensionForMime, outputFileName, splitAcceptedFiles, uniqueFileName } from './files.ts';
import { buildPipeline } from './pipeline.ts';
import { createZip } from './zip.ts';
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
  /** Hands a file to the browser's download flow. */
  saveBlob(blob: Blob, fileName: string): void;
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
  saveBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

function revokeItem(item: WorkspaceItem, deps: WorkspaceDeps) {
  deps.revokeObjectURL(item.previewUrl);
  if (item.result) deps.revokeObjectURL(item.result.url);
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
    const { items, running } = stateRef.current;
    if (running || !items.some((item) => item.status === 'done' || item.status === 'failed')) {
      return;
    }
    for (const item of items) if (item.result) depsRef.current.revokeObjectURL(item.result.url);
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
    const handle = ensureRunner().start(job, {
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
            blob: result.blob,
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
  }, [toolId, options, errors, ensureRunner]);

  const cancel = useCallback(() => handleRef.current?.cancel(), []);

  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const downloadZip = useCallback(async () => {
    const entries = stateRef.current.items.flatMap((item) =>
      item.status === 'done' && item.result
        ? [{ fileName: item.result.fileName, blob: item.result.blob }]
        : [],
    );
    if (entries.length === 0) return;
    setZipping(true);
    setZipError(null);
    try {
      depsRef.current.saveBlob(await createZip(entries), 'reimage.zip');
    } catch (error) {
      setZipError(error instanceof Error ? error.message : String(error));
    } finally {
      setZipping(false);
    }
  }, []);

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
    downloadZip,
    zipping,
    zipError,
  };
}
