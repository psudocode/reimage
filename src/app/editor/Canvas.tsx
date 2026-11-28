import { Suspense, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolUI } from '../../tools/types.ts';
import type { WorkspaceItem } from '../workspace/state.ts';
import { Compare } from './Compare.tsx';
import type { PreviewState } from './usePreview.ts';

interface CanvasProps {
  item: WorkspaceItem;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: ToolUI<any>;
  options: unknown;
  onOptionsChange(options: unknown): void;
  preview: PreviewState;
  locked: boolean;
}

/**
 * The picture being edited. A tool with an `Overlay` (crop) gets the original
 * with its interactive layer on top; every other tool shows the before/after slider.
 * Mount it with `key={item.id}` so the measured image size resets per image.
 */
export function Canvas({ item, tool, options, onOptionsChange, preview, locked }: CanvasProps) {
  const t = useT();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const Overlay = tool.Overlay;

  if (Overlay) {
    return (
      <div className="relative">
        <img
          src={item.previewUrl}
          alt={item.name}
          draggable={false}
          onLoad={(event) =>
            setSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          className="block h-auto w-full rounded-lg"
        />
        {size && size.width > 0 && size.height > 0 && (
          <Suspense fallback={null}>
            <Overlay
              value={options}
              onChange={onOptionsChange}
              imageSize={size}
              disabled={locked}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div>
      <Compare before={item.previewUrl} after={preview.url} busy={preview.status === 'loading'} />
      {preview.url === undefined && preview.status !== 'error' && (
        <p role="status" className="mt-2 text-center text-xs text-slate-400">
          {t('editor.previewLoading')}
        </p>
      )}
    </div>
  );
}
