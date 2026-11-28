import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import { deleteModel, downloadModel, isModelCached } from './model.ts';
import type { RemoveBackgroundOptions } from './options.ts';

type ModelState = 'checking' | 'missing' | 'downloading' | 'ready';

export default function RemoveBackgroundPanel({
  value,
  onChange,
}: ToolPanelProps<RemoveBackgroundOptions>) {
  const t = useT();
  const [state, setState] = useState<ModelState>('checking');
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void isModelCached().then((cached) => live && setState(cached ? 'ready' : 'missing'));
    return () => {
      live = false;
      controller.current?.abort();
    };
  }, []);

  const download = useCallback(async () => {
    controller.current = new AbortController();
    setFailed(false);
    setProgress(0);
    setState('downloading');
    try {
      await downloadModel(setProgress, controller.current.signal);
      setState('ready');
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setFailed(true);
      setState('missing');
    }
  }, []);

  const remove = async () => {
    await deleteModel();
    setState('missing');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.removeBackground.description')}</p>

      <div className="space-y-2 rounded border border-slate-700 p-3">
        {state === 'ready' && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>{t('tools.removeBackground.modelReady')}</span>
            <button type="button" onClick={remove} className="text-xs text-slate-400 underline">
              {t('tools.removeBackground.removeModel')}
            </button>
          </div>
        )}
        {state === 'missing' && (
          <>
            <p className="text-sm">{t('tools.removeBackground.modelMissing')}</p>
            <button
              type="button"
              onClick={download}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              {t('tools.removeBackground.download')}
            </button>
            <p className="text-xs text-slate-500">{t('tools.removeBackground.privacy')}</p>
          </>
        )}
        {state === 'downloading' && (
          <div className="space-y-1">
            <label htmlFor="rb-progress" className="text-sm">
              {t('tools.removeBackground.downloading')}
            </label>
            <progress id="rb-progress" className="w-full" max={1} value={progress} />
            <button
              type="button"
              onClick={() => controller.current?.abort()}
              className="text-xs text-slate-400 underline"
            >
              {t('tools.removeBackground.cancel')}
            </button>
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm text-red-400">
            {t('tools.removeBackground.errors.download')}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.softEdges}
          onChange={(event) => onChange({ ...value, softEdges: event.target.checked })}
        />
        {t('tools.removeBackground.softEdges')}
      </label>
      <p className="text-xs text-slate-500">{t('tools.removeBackground.softEdgesHint')}</p>
      <p className="text-xs text-slate-500">{t('tools.removeBackground.outputHint')}</p>
    </div>
  );
}
