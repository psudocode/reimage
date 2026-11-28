import { useT } from '../../i18n/index.ts';
import { Icon } from '../../ui/Icon.tsx';
import type { Workspace } from './useEditorModel.ts';

/** "Download all (ZIP)": only offered when two or more images have a finished result. */
export function ZipButton({
  workspace,
  compact = false,
}: {
  workspace: Workspace;
  compact?: boolean;
}) {
  const t = useT();
  const { items, running, zipping, zipError } = workspace;
  const finished = items.filter((item) => item.status === 'done' && item.result).length;
  if (finished < 2 || running) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => void workspace.downloadZip()}
        disabled={zipping}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600 disabled:opacity-40"
      >
        <Icon name="download" className="size-4" />
        <span className={compact ? 'sr-only' : ''}>
          {t(zipping ? 'editor.zipping' : 'editor.downloadZip')}
        </span>
      </button>
      {zipError && (
        <span role="alert" className="text-xs text-red-400">
          {t('editor.zipError').replace('{message}', zipError)}
        </span>
      )}
    </>
  );
}
