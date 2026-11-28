import { useState } from 'react';
import { LocaleContext, messages, type Locale } from '../i18n/index.ts';
import { Workspace } from './workspace/Workspace.tsx';

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const t = messages[locale].app;

  return (
    <LocaleContext.Provider value={locale}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{t.name}</h1>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs text-emerald-300">
              {t.privacyBadge}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale('en')}
              aria-pressed={locale === 'en'}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                locale === 'en'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale('id')}
              aria-pressed={locale === 'id'}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                locale === 'id'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ID
            </button>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-[100rem] px-4 py-6 space-y-4 md:px-6">
          <p className="text-slate-300">{t.tagline}</p>
          <Workspace />
        </main>
      </div>
    </LocaleContext.Provider>
  );
}
