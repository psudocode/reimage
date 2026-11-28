import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from '../i18n/index.ts';

/** Toast shown when the app is ready offline or a new version waits to be activated. */
export function UpdatePrompt() {
  const t = useT();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };
  const button = 'px-2.5 py-1 rounded text-xs font-medium transition';

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm shadow-lg"
    >
      <span>{needRefresh ? t('pwa.updateAvailable') : t('pwa.offlineReady')}</span>
      {needRefresh && (
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className={`${button} bg-blue-600 text-white hover:bg-blue-500`}
        >
          {t('pwa.reload')}
        </button>
      )}
      <button
        type="button"
        onClick={close}
        className={`${button} bg-slate-800 text-slate-300 hover:bg-slate-700`}
      >
        {needRefresh ? t('pwa.later') : t('pwa.dismiss')}
      </button>
    </div>
  );
}
