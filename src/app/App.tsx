import { useState } from 'react';
import { LocaleContext, messages, type Locale } from '../i18n/index.ts';

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const t = messages[locale].app;

  return (
    <LocaleContext.Provider value={locale}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">{t.name}</span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs text-emerald-300">
              {t.privacyBadge}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale('en')}
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

        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-xl text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">{t.name}</h1>
            <p className="text-slate-300 text-lg">{t.tagline}</p>
            <p className="text-sm text-slate-400 pt-2">{t.comingSoon}</p>
          </div>
        </main>
      </div>
    </LocaleContext.Provider>
  );
}
