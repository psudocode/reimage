import { useEffect, useRef, useState } from 'react';
import type { PreviewManyRequest, PreviewRequest } from '../../core/job/JobRunner.ts';
import type { ImageResult } from '../../core/pipeline/types.ts';
import type { WorkspaceItem } from '../workspace/state.ts';
import { buildPipeline } from '../workspace/pipeline.ts';
import { estimateFullSize, type PreviewEstimate } from './previewMath.ts';

export const PREVIEW_DEBOUNCE_MS = 250;

export interface PreviewApi {
  render(request: PreviewRequest): Promise<ImageResult>;
  /** For a many-to-one tool: all the images in, one small result out. */
  renderMany(request: PreviewManyRequest): Promise<ImageResult>;
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
  /** Needed (in list order) when `combining`: the preview is built from all of them. */
  items?: readonly WorkspaceItem[];
  /** The tool turns every item into one image (merge, collage). */
  combining?: boolean;
  toolId: string;
  options: unknown;
  /** Invalid options or a running job: leave the preview alone. */
  enabled: boolean;
  debounceMs?: number;
}

const IDLE: PreviewState = { status: 'idle' };

/** Id the preview of a combined image is reported under. */
const COMBINED_PREVIEW_ID = 'combined-preview';

/**
 * Live preview for the selected image (or, for a many-to-one tool, for the
 * combined image of the whole list): after the options settle for
 * `debounceMs`, run the tool in a worker on a downscaled copy and expose the
 * result. Out-of-order answers are dropped, and object URLs are always freed.
 */
export function usePreview({
  api,
  item,
  items = [],
  combining = false,
  toolId,
  options,
  enabled,
  debounceMs = PREVIEW_DEBOUNCE_MS,
}: PreviewInput): PreviewState {
  const [state, setState] = useState<PreviewState>(IDLE);
  const urlRef = useRef<string | undefined>(undefined);
  const apiRef = useRef(api);
  // A combined preview depends on the whole list, so its identity is every id in order.
  const itemId = combining ? items.map((entry) => entry.id).join('|') || undefined : item?.id;
  // Selecting another item must not restart a combined preview, so it keys on the first file.
  const file = combining ? items[0]?.file : item?.file;

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
    const files = combining ? items.map((entry) => entry.file) : [];
    let current = true;
    setState((previous) => ({ ...previous, status: 'loading', error: undefined }));
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const pipeline = buildPipeline(toolId, options);
          const result = combining
            ? await apiRef.current.renderMany({ imageId: COMBINED_PREVIEW_ID, files, pipeline })
            : await apiRef.current.render({ imageId: itemId, file, pipeline });
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
    // `items` is read through `itemId`, which changes whenever the list does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, itemId, file, combining, toolId, options, debounceMs]);

  return state;
}
