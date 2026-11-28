import { useT } from '../../i18n/index.ts';
import { formatBytes, savedPercent } from '../workspace/files.ts';
import type { WorkspaceItem } from '../workspace/state.ts';
import type { PreviewState } from './usePreview.ts';

interface StatsProps {
  item: WorkspaceItem;
  preview: PreviewState;
}

/**
 * File size before → after. After a run these are the real numbers; until then
 * they come from the preview and are marked "≈" because the preview is downscaled.
 */
export function Stats({ item, preview }: StatsProps) {
  const t = useT();
  const real = item.status === 'done' ? item.result : undefined;
  const after = real
    ? { bytes: real.bytesAfter, width: real.width, height: real.height }
    : preview.estimate;

  if (!after) {
    return (
      <span aria-live="polite" className="text-slate-500">
        {preview.status === 'error' ? '–' : '…'}
      </span>
    );
  }

  const mark = real ? '' : t('editor.estimated');
  const percent = savedPercent(item.size, after.bytes);
  return (
    <span
      aria-live="polite"
      title={real ? undefined : t('editor.previewNote')}
      className={preview.status === 'loading' && !real ? 'opacity-60' : undefined}
    >
      {formatBytes(item.size)} → <b>{mark + formatBytes(after.bytes)}</b>{' '}
      <span className={percent >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
        ({percent >= 0 ? '−' : '+'}
        {Math.abs(percent)}%)
      </span>
      <span className="text-slate-500">
        {' '}
        · {mark}
        {after.width}×{after.height}
      </span>
    </span>
  );
}
