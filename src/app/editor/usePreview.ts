import { useEffect, useRef, useState } from 'react';
import type { PreviewRequest } from '../../core/job/JobRunner.ts';
import type { ImageResult } from '../../core/pipeline/types.ts';
import type { WorkspaceItem } from '../workspace/state.ts';
import { buildPipeline } from '../workspace/pipeline.ts';
import { estimateFullSize, type PreviewEstimate } from './previewMath.ts';

export const PREVIEW_DEBOUNCE_MS = 250;

export interface PreviewApi {
  render(request: PreviewRequest): Promise<ImageResult>;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface PreviewState {
  /** `loading` keeps the last `url`/`estimate` so the canvas doesn't flash empty. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Object URL of the downscaled "after" image. */
  url?: string;
  estimate?: PreviewEstimate;
  error?: string;
}

interface PreviewInput {
  api: PreviewApi;
  item: WorkspaceItem | undefined;
  toolId: string;
  options: unknown;
  /** Invalid options or a running job: leave the preview alone. */
  enabled: boolean;
  debounceMs?: number;
}

const IDLE: PreviewState = { status: 'idle' };

/**
 * Live preview for the selected image: after the options settle for
 * `debounceMs`, run the tool in a worker on a downscaled copy and expose the
 * result. Out-of-order answers are dropped, and object URLs are always freed.
 */
export function usePreview({
  api,
  item,
  toolId,
  options,
  enabled,
  debounceMs = PREVIEW_DEBOUNCE_MS,
}: PreviewInput): PreviewState {
  const [state, setState] = useState<PreviewState>(IDLE);
  const urlRef = useRef<string | undefined>(undefined);
  const apiRef = useRef(api);
  const itemId = item?.id;
  const file = item?.file;

  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const replaceUrl = (next: string | undefined) => {
    if (urlRef.current && urlRef.current !== next) apiRef.current.revokeObjectURL(urlRef.current);
    urlRef.current = next;
  };

  useEffect(() => {
    // Another image is a new picture: drop the old "after" at once.
    replaceUrl(undefined);
    setState(IDLE);
  }, [itemId]);

  useEffect(() => () => replaceUrl(undefined), []);

  useEffect(() => {
    if (!enabled || !itemId || !file) return;
    let current = true;
    setState((previous) => ({ ...previous, status: 'loading', error: undefined }));
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await apiRef.current.render({
            imageId: itemId,
            file,
            pipeline: buildPipeline(toolId, options),
          });
          if (!current) return;
          const url = apiRef.current.createObjectURL(result.blob);
          replaceUrl(url);
          setState({ status: 'ready', url, estimate: estimateFullSize(result) });
        } catch (cause) {
          if (!current) return;
          setState((previous) => ({
            ...previous,
            status: 'error',
            error: cause instanceof Error ? cause.message : String(cause),
          }));
        }
      })();
    }, debounceMs);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [enabled, itemId, file, toolId, options, debounceMs]);

  return state;
}
