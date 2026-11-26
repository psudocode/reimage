import { Suspense, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import { compress } from '../../tools/compress/index.ts';
import { Dropzone } from './Dropzone.tsx';
import { formatBytes, savedPercent } from './files.ts';
import { ImageList } from './ImageList.tsx';
import { browserWorkspaceDeps, useWorkspace, type WorkspaceDeps } from './useWorkspace.ts';

export function Workspace({ deps = browserWorkspaceDeps }: { deps?: WorkspaceDeps }) {
  const t = useT();
  const workspace = useWorkspace(deps);
  const { items, running, options, errors } = workspace;
  const [skipped, setSkipped] = useState(0);
  const Panel = compress.Panel;

  const handleFiles = (files: File[]) => {
    setSkipped(workspace.addFiles(files).rejected);
  };

  const done = items.filter((item) => item.status === 'done' && item.result);
  const totalBefore = done.reduce((sum, item) => sum + item.size, 0);
  const totalAfter = done.reduce((sum, item) => sum + (item.result?.bytesAfter ?? 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label={t('workspace.imagesTitle')} className="space-y-4">
        <Dropzone onFiles={handleFiles} disabled={running} compact={items.length > 0} />

        {skipped > 0 && (
          <p role="status" className="text-sm text-amber-400">
            {t('workspace.skipped').replace('{count}', String(skipped))}
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-center text-sm text-slate-500">{t('workspace.empty')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>{t('workspace.count').replace('{count}', String(items.length))}</span>
              <button
                type="button"
                onClick={workspace.clear}
                disabled={running}
                className="rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {t('workspace.clearAll')}
              </button>
            </div>
            <ImageList items={items} locked={running} onRemove={workspace.removeItem} />
          </>
        )}
      </section>

      <aside
        aria-label={t('workspace.optionsTitle')}
        className="h-fit space-y-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
      >
        <h2 className="text-lg font-semibold">{t(compress.labelKey)}</h2>
        <Suspense fallback={<p className="text-sm text-slate-400">{t('workspace.loading')}</p>}>
          <Panel value={options} onChange={workspace.setOptions} />
        </Suspense>

        {running ? (
          <button
            type="button"
            onClick={workspace.cancel}
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold hover:bg-slate-600"
          >
            {t('workspace.cancel')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void workspace.run()}
            disabled={items.length === 0 || errors.length > 0}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-600"
          >
            {t('workspace.run')}
          </button>
        )}

        <div aria-live="polite" className="text-sm text-slate-300">
          {!running && done.length > 0 && (
            <p>
              {t('workspace.summary')
                .replace('{count}', String(done.length))
                .replace('{before}', formatBytes(totalBefore))
                .replace('{after}', formatBytes(totalAfter))
                .replace('{percent}', String(-savedPercent(totalBefore, totalAfter)))}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
