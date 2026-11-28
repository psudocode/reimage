// PROTOTYPE (throwaway) — question: "Should reimage look like an image editor (preview + before/after + canvas tools)?"
// Three variants of the workspace, switchable with ?variant=A|B|C (arrow keys too). Mounted from App.tsx when the param is set.
import { useEffect, useState } from 'react';
import { VariantA } from './VariantA.tsx';
import { VariantB } from './VariantB.tsx';
import { VariantC } from './VariantC.tsx';
import { defaultOpts, useImages, type Opts } from './shared.tsx';

const VARIANTS = [['A', 'Classic editor'], ['B', 'Canva-like'], ['C', 'Edit stack']] as const;

function useVariant() {
  const read = () => new URLSearchParams(location.search).get('variant')?.toUpperCase() ?? 'A';
  const [v, setV] = useState(read);
  const go = (k: string) => { const u = new URL(location.href); u.searchParams.set('variant', k); history.replaceState(null, '', u); setV(k); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
      const i = VARIANTS.findIndex(([k]) => k === v);
      if (e.key === 'ArrowRight') go(VARIANTS[(i + 1) % 3]![0]);
      if (e.key === 'ArrowLeft') go(VARIANTS[(i + 2) % 3]![0]);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  return [v, go] as const;
}

export function PrototypeEditor() {
  const [variant, go] = useVariant();
  const { images, current, index, setIndex, add } = useImages();
  const [o, setO] = useState<Opts>(defaultOpts);
  const set = (p: Partial<Opts>) => setO((prev) => ({ ...prev, ...p }));
  const i = VARIANTS.findIndex(([k]) => k === variant);
  if (!current) return <p className="text-slate-400">Loading sample…</p>;
  const props = { images, current, index, setIndex, o, set, add };
  return (
    <>
      {variant === 'B' ? <VariantB {...props} /> : variant === 'C' ? <VariantC {...props} /> : <VariantA {...props} />}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-xl">
        <button onClick={() => go(VARIANTS[(i + 2) % 3]![0])} aria-label="previous variant">←</button>
        <span>{VARIANTS[Math.max(i, 0)]![0]} ({VARIANTS[Math.max(i, 0)]![1]})</span>
        <button onClick={() => go(VARIANTS[(i + 1) % 3]![0])} aria-label="next variant">→</button>
      </div>
    </>
  );
}
