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
  type PreviewManyRequest,
  type PreviewRequest,
} from '../../core/job/JobRunner.ts';
import type { ImageResult, InputImage, Job } from '../../core/pipeline/types.ts';
import { createImagePool } from '../../core/workers/imagePool.ts';
import { MAX_MERGE_IMAGES, MIN_MERGE_IMAGES } from '../../tools/merge/options.ts';
import { getRegisteredRuntimes, getToolRuntimeById } from '../../tools/runtimeRegistry.ts';
import { extensionForMime, outputFileName, splitAcceptedFiles, uniqueFileName } from './files.ts';
import { buildPipeline, COMBINED_NAME } from './pipeline.ts';
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
  /** Every image through a many-to-one tool, into one downscaled result. */
  previewMany(request: PreviewManyRequest): Promise<ImageResult>;
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
      previewMany: (request) => runner.previewMany(request),
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
    const { items, running, combined, combinedError } = stateRef.current;
    const finished = items.some((item) => item.status === 'done' || item.status === 'failed');
    if (running || !(finished || combined || combinedError)) return;
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
      renderMany: (request: PreviewManyRequest) => ensureRunner().previewMany(request),
      createObjectURL: (blob: Blob) => depsRef.current.createObjectURL(blob),
      revokeObjectURL: (url: string) => depsRef.current.revokeObjectURL(url),
    }),
    [ensureRunner],
  );

  /** A many-to-one tool (merge) turns the whole list into one image. */
  const combining = getToolRuntimeById(toolId)?.kind === 'many-to-one';
  const itemCount = state.items.length;
  /** i18n key when the list itself (not the options) rules a many-to-one tool out. */
  const combineError = combining
    ? itemCount < MIN_MERGE_IMAGES
      ? 'tools.merge.errors.needTwo'
      : itemCount > MAX_MERGE_IMAGES
        ? 'tools.merge.errors.tooMany'
        : undefined
    : undefined;
  const errors = useMemo(() => {
    const found = getToolRuntimeById(toolId)?.validate(options) ?? [];
    return combineError ? [...found, combineError] : found;
  }, [toolId, options, combineError]);

  /** The merged image belongs to the whole list: free it before the list changes. */
  const revokeCombined = useCallback(() => {
    const { combined } = stateRef.current;
    if (combined) depsRef.current.revokeObjectURL(combined.url);
  }, []);

  const addFiles = useCallback(
    (files: Iterable<File>) => {
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
      if (items.length > 0) {
        revokeCombined();
        dispatch({ type: 'add', items });
      }
      return { added: items.length, rejected: rejected.length };
    },
    [revokeCombined],
  );

  const removeItem = useCallback(
    (id: string) => {
      const item = stateRef.current.items.find((candidate) => candidate.id === id);
      if (!item) return;
      revokeCombined();
      revokeItem(item, depsRef.current);
      dispatch({ type: 'remove', id });
    },
    [revokeCombined],
  );

  const clear = useCallback(() => {
    revokeCombined();
    for (const item of stateRef.current.items) revokeItem(item, depsRef.current);
    dispatch({ type: 'clear' });
  }, [revokeCombined]);

  const run = useCallback(async () => {
    const { items, running } = stateRef.current;
    if (running || items.length === 0 || errors.length > 0) return;
    const d = depsRef.current;

    // Re-running replaces earlier results: free their blobs now.
    for (const item of items) if (item.result) d.revokeObjectURL(item.result.url);
    revokeCombined();

    const pipeline = buildPipeline(toolId, options);
    const images: InputImage[] = items.map((item) => ({
      id: item.id,
      file: item.file,
      name: item.name,
      size: item.size,
    }));
    const job: Job = {
      id: d.createId(),
      images,
      pipeline,
      status: 'queued',
      ...(combining ? { combine: true } : {}),
    };
    const usedNames = new Set<string>();
    const names = new Map(items.map((item) => [item.id, item.name]));

    dispatch({ type: 'begin' });
    const handle = ensureRunner().start(job, {
      onProgress: (id, fraction) => {
        if (handleRef.current === handle) dispatch({ type: 'progress', id, fraction });
      },
      onResult: (result) => {
        if (handleRef.current !== handle) return;
        const extension = extensionForMime(result.blob.type);
        if (combining) {
          dispatch({
            type: 'combined',
            result: {
              url: d.createObjectURL(result.blob),
              fileName: outputFileName(COMBINED_NAME, pipeline.output.fileNamePattern, extension),
              width: result.width,
              height: result.height,
              bytesAfter: result.bytesAfter,
              downscaled: result.downscaled === true,
              targetMissed: result.targetMissed === true,
            },
          });
          return;
        }
        const fileName = uniqueFileName(
          outputFileName(
            names.get(result.imageId) ?? 'image',
            pipeline.output.fileNamePattern,
            extension,
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
        if (handleRef.current !== handle) return;
        if (combining) dispatch({ type: 'combinedFailure', message: error.message });
        else dispatch({ type: 'failure', id: imageId, message: error.message });
      },
    });
    handleRef.current = handle;
    await handle.promise;
    if (handleRef.current === handle) {
      handleRef.current = null;
      dispatch({ type: 'end' });
    }
  }, [toolId, options, errors, combining, ensureRunner, revokeCombined]);

  const cancel = useCallback(() => handleRef.current?.cancel(), []);

  useEffect(
    () => () => {
      // Unmount: stop work, free workers and every object URL.
      handleRef.current?.cancel();
      handleRef.current = null;
      runnerRef.current?.dispose();
      runnerRef.current = null;
      for (const item of stateRef.current.items) revokeItem(item, depsRef.current);
      if (stateRef.current.combined) {
        depsRef.current.revokeObjectURL(stateRef.current.combined.url);
      }
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
    combining,
    combineError,
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
