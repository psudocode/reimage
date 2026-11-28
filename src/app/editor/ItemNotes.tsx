import { useT } from '../../i18n/index.ts';
import { isHeicFile } from '../workspace/files.ts';
import type { WorkspaceItem } from '../workspace/state.ts';

/** Problems and caveats for one image after a run. Renders nothing when all is well. */
export function ItemNotes({ item }: { item: WorkspaceItem }) {
  const t = useT();
  if (item.status === 'failed') {
    return (
      <p role="alert" className="text-xs text-red-400">
        {t('workspace.status.failed')}:{' '}
        {isHeicFile(item.file) ? t('workspace.heicUnsupported') : item.error}
      </p>
    );
  }
  if (item.status === 'done' && item.result) {
    return (
      <>
        {item.result.targetMissed && (
          <p className="text-xs text-amber-400">{t('workspace.targetMissed')}</p>
        )}
        {item.result.downscaled && (
          <p className="text-xs text-slate-400">{t('workspace.downscaled')}</p>
        )}
      </>
    );
  }
  return null;
}
