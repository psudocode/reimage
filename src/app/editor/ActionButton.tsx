import { useT } from '../../i18n/index.ts';
import { Icon } from '../../ui/Icon.tsx';
import type { Workspace } from './useEditorModel.ts';

const PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-violet-600';

/**
 * The one main action, in three states:
 * running → Cancel; current image has a finished result → Download that file;
 * otherwise → Apply (runs the tool on every image in the batch).
 */
export function ActionButton({
  workspace,
  compact = false,
}: {
  workspace: Workspace;
  compact?: boolean;
}) {
  const t = useT();
  const { running, selected, items, errors, combined } = workspace;
  const label = compact ? 'sr-only' : '';

  if (running) {
    return (
      <button
        type="button"
        onClick={workspace.cancel}
        className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600"
      >
        {t('workspace.cancel')}
      </button>
    );
  }
  if (combined) {
    return (
      <a href={combined.url} download={combined.fileName} className={PRIMARY}>
        <Icon name="download" className="size-4" />
        <span className={label}>{t('editor.download')}</span>
        <span className="sr-only"> {combined.fileName}</span>
      </a>
    );
  }
  if (selected?.status === 'done' && selected.result) {
    return (
      <a href={selected.result.url} download={selected.result.fileName} className={PRIMARY}>
        <Icon name="download" className="size-4" />
        <span className={label}>{t('editor.download')}</span>
        <span className="sr-only"> {selected.result.fileName}</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void workspace.run()}
      disabled={items.length === 0 || errors.length > 0}
      className={PRIMARY}
    >
      {t('editor.apply')}
    </button>
  );
}
