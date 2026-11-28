// PROTOTYPE variant A: "Classic editor" — filmstrip left, canvas center, inspector right (Photoshop/Squoosh-like).
import { Stage, Stats, ToolOptions, TOOLS, usePreview, type Opts, type Img } from './shared.tsx';

interface P { images: Img[]; current: Img; index: number; setIndex(i: number): void; o: Opts; set(p: Partial<Opts>): void }
export function VariantA({ images, current, index, setIndex, o, set }: P) {
  const preview = usePreview(current, o);
  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-[32rem] grid-cols-[7rem_1fr_17rem] overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="space-y-2 overflow-y-auto border-r border-slate-800 p-2">
        {images.map((im, i) => (
          <button key={im.id} onClick={() => setIndex(i)} className={`block w-full overflow-hidden rounded border-2 ${i === index ? 'border-blue-500' : 'border-transparent'}`}>
            <img src={im.url} alt={im.name} className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex-1 overflow-auto bg-[conic-gradient(#0f172a_25%,#111827_0_50%,#0f172a_0_75%,#111827_0)] bg-[length:20px_20px] p-6">
          <div className="mx-auto max-w-3xl"><Stage img={current} o={o} set={set} preview={preview} /></div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-sm text-slate-300">
          <span className="truncate text-slate-500">{current.name}</span><Stats img={current} preview={preview} />
        </div>
      </div>
      <aside className="space-y-4 overflow-y-auto border-l border-slate-800 p-4">
        <div className="grid grid-cols-2 gap-1">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => set({ tool: t.id })} className={`rounded px-2 py-1.5 text-sm ${o.tool === t.id ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700'}`}>{t.icon} {t.label}</button>
          ))}
        </div>
        <ToolOptions o={o} set={set} />
        <button className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold">Apply to all {images.length} image{images.length > 1 ? 's' : ''}</button>
      </aside>
    </div>
  );
}
