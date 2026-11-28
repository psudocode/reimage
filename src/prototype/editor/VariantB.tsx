// PROTOTYPE variant B: "Canva-like" — icon tool rail left, big centered canvas, contextual floating bar, filmstrip bottom.
import { Stage, Stats, ToolOptions, TOOLS, usePreview, type Opts, type Img } from './shared.tsx';

interface P { images: Img[]; current: Img; index: number; setIndex(i: number): void; o: Opts; set(p: Partial<Opts>): void; add(f: FileList): void }
export function VariantB({ images, current, index, setIndex, o, set, add }: P) {
  const preview = usePreview(current, o);
  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[32rem] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <nav className="flex w-20 flex-col items-center gap-2 border-r border-slate-800 bg-slate-900 py-3">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => set({ tool: t.id })} className={`flex w-16 flex-col items-center rounded-xl py-2 text-xs ${o.tool === t.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span className="text-xl">{t.icon}</span>{t.label}
          </button>
        ))}
        <label className="mt-auto flex w-16 cursor-pointer flex-col items-center rounded-xl py-2 text-xs text-slate-400 hover:bg-slate-800">
          <span className="text-xl">＋</span>Add
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && add(e.target.files)} />
        </label>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 py-2">
          <div className="w-64 shrink-0"><ToolOptions o={o} set={set} /></div>
          <div className="ml-auto text-sm"><Stats img={current} preview={preview} /></div>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold">Download ⬇</button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-900/40 p-8">
          <div className="mx-auto max-w-2xl rounded-lg shadow-2xl shadow-black/60"><Stage img={current} o={o} set={set} preview={preview} /></div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-slate-800 bg-slate-900 p-2">
          {images.map((im, i) => (
            <button key={im.id} onClick={() => setIndex(i)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? 'border-violet-500' : 'border-transparent opacity-70'}`}>
              <img src={im.url} alt={im.name} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
