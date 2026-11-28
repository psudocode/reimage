import { useState } from 'react';
import { useT } from '../../i18n/index.ts';
import { Editor } from '../editor/Editor.tsx';
import { Dropzone } from './Dropzone.tsx';
import { browserWorkspaceDeps, useWorkspace, type WorkspaceDeps } from './useWorkspace.ts';

/**
 * Entry point of the app body. With no images it is a drop zone; once there are
 * some it becomes the editor (rail, tool panel, live canvas, filmstrip).
 */
export function Workspace({ deps = browserWorkspaceDeps }: { deps?: WorkspaceDeps }) {
  const t = useT();
  const workspace = useWorkspace(deps);
  const [skipped, setSkipped] = useState(0);

  const handleFiles = (files: File[]) => {
    setSkipped(workspace.addFiles(files).rejected);
  };

  if (workspace.items.length === 0) {
    return (
      <section
        aria-label={t('workspace.imagesTitle')}
        className="mx-auto w-full max-w-3xl space-y-4"
      >
        <Dropzone onFiles={handleFiles} disabled={workspace.running} />
        {skipped > 0 && (
          <p role="status" className="text-sm text-amber-400">
            {t('workspace.skipped').replace('{count}', String(skipped))}
          </p>
        )}
        <p className="text-center text-sm text-slate-500">{t('workspace.empty')}</p>
      </section>
    );
  }

  return <Editor workspace={workspace} onFiles={handleFiles} skipped={skipped} />;
}
