// PROTOTYPE variant C: "Edit stack" — non-destructive step list (pipeline) left, side-by-side result cards, no tool tabs.
import { Compare, CropStage, ToolOptions, TOOLS, fmt, usePreview, type Opts, type Img, type ToolId } from './shared.tsx';
import { useState } from 'react';

interface P { images: Img[]; current: Img; index: number; setIndex(i: number): void; o: Opts; set(p: Partial<Opts>): void }
export function VariantC({ images, current, index, setIndex, o, set }: P) {
  const preview = usePreview(current, o);
  const [stack, setStack] = useState<{ tool: ToolId; on: boolean }[]>([{ tool: 'crop', on: true }, { tool: 'resize', on: true }, { tool: 'compress', on: true }]);
  const { out } = preview;
  return (
    <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Edit stack</h3>
        <ol className="space-y-1">
          {stack.map((s, i) => {
            const t = TOOLS.find((x) => x.id === s.tool)!;
            return (
              <li key={s.tool} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${o.tool === s.tool ? 'bg-emerald-600/20 ring-1 ring-emerald-500' : 'bg-slate-800/60'}`}>
                <span className="text-slate-500">{i + 1}</span>
                <button onClick={() => set({ tool: s.tool })} className="flex-1 text-left">{t.icon} {t.label}</button>
                <input type="checkbox" checked={s.on} onChange={() => setStack(stack.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-slate-500">Toggle steps on/off, click to edit. Same stack = a saved Pipeline preset for batch.</p>
        <hr className="border-slate-800" />
        <ToolOptions o={o} set={set} />
      </aside>
      <section className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <figure className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <figcaption className="text-xs text-slate-400">Original · {fmt(current.size)}</figcaption>
            {o.tool === 'crop' ? <CropStage src={current.url} crop={o.crop} onChange={(crop) => set({ crop })} /> : <img src={current.url} alt="" className="w-full rounded-lg" />}
          </figure>
          <figure className="space-y-1 rounded-xl border border-emerald-700/50 bg-slate-900/60 p-3">
            <figcaption className="text-xs text-slate-400">Result · {out ? `${fmt(out.bytes)} · ${out.w}×${out.h}` : '…'}</figcaption>
            {out ? <Compare before={current.url} after={out.url} /> : <div className="h-48 animate-pulse rounded-lg bg-slate-800" />}
          </figure>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {images.map((im, i) => (
            <button key={im.id} onClick={() => setIndex(i)} className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 ${i === index ? 'border-emerald-500' : 'border-transparent opacity-70'}`}><img src={im.url} alt="" className="h-full w-full object-cover" /></button>
          ))}
        </div>
      </section>
    </div>
  );
}
