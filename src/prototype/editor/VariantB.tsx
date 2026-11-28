// PROTOTYPE variant B: "Canva-like", scaled to MANY tools.
// Rail = categories (stays short as tools grow), flyout = tools of that category, search finds any tool.
// Only compress/convert/resize/crop are real; the rest are placeholders to test the navigation.
import { useState } from 'react';
import { Stage, Stats, ToolOptions, usePreview, type Opts, type Img, type ToolId } from './shared.tsx';

interface T { id: string; label: string; icon: string; real?: boolean }
const CATS: { id: string; label: string; icon: string; tools: T[] }[] = [
  { id: 'transform', label: 'Transform', icon: '✂', tools: [
    { id: 'crop', label: 'Crop', icon: '✂', real: true }, { id: 'resize', label: 'Resize', icon: '↔', real: true },
    { id: 'rotate', label: 'Rotate', icon: '⟳' }, { id: 'flip', label: 'Flip', icon: '⇋' },
    { id: 'expand', label: 'Expand canvas', icon: '⛶' }, { id: 'straighten', label: 'Straighten', icon: '📐' } ] },
  { id: 'export', label: 'Export', icon: '🗜', tools: [
    { id: 'compress', label: 'Compress', icon: '🗜', real: true }, { id: 'convert', label: 'Convert', icon: '🔄', real: true },
    { id: 'metadata', label: 'Strip metadata', icon: '🧹' }, { id: 'pdf', label: 'Images to PDF', icon: '📄' } ] },
  { id: 'adjust', label: 'Adjust', icon: '🎚', tools: [
    { id: 'brightness', label: 'Brightness', icon: '☀' }, { id: 'contrast', label: 'Contrast', icon: '◐' },
    { id: 'saturation', label: 'Saturation', icon: '🎨' }, { id: 'blur', label: 'Blur', icon: '💧' },
    { id: 'sharpen', label: 'Sharpen', icon: '🔺' }, { id: 'grayscale', label: 'Grayscale', icon: '⬛' } ] },
  { id: 'add', label: 'Add', icon: '＋', tools: [
    { id: 'text', label: 'Text', icon: '🔤' }, { id: 'watermark', label: 'Watermark', icon: '💠' },
    { id: 'logo', label: 'Logo', icon: '🏷' }, { id: 'border', label: 'Border', icon: '🖼' }, { id: 'sticker', label: 'Sticker', icon: '⭐' } ] },
  { id: 'combine', label: 'Combine', icon: '▦', tools: [
    { id: 'merge', label: 'Merge', icon: '🔗' }, { id: 'collage', label: 'Collage', icon: '▦' }, { id: 'grid', label: 'Grid split', icon: '▥' } ] },
  { id: 'ai', label: 'Smart', icon: '✨', tools: [
    { id: 'bgremove', label: 'Remove background', icon: '🪄' }, { id: 'upscale', label: 'Upscale', icon: '🔍' } ] },
];
const ALL = CATS.flatMap((c) => c.tools.map((t) => ({ ...t, cat: c.id })));

interface P { images: Img[]; current: Img; index: number; setIndex(i: number): void; o: Opts; set(p: Partial<Opts>): void; add(f: FileList): void }
export function VariantB({ images, current, index, setIndex, o, set, add }: P) {
  const preview = usePreview(current, o);
  const [active, setActive] = useState<string>(o.tool);
  const [cat, setCat] = useState('transform');
  const [q, setQ] = useState('');
  const pick = (t: T) => { setActive(t.id); if (t.real) set({ tool: t.id as ToolId }); };
  const shown = q ? ALL.filter((t) => t.label.toLowerCase().includes(q.toLowerCase())) : CATS.find((c) => c.id === cat)!.tools;
  const activeTool = ALL.find((t) => t.id === active)!;
  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[32rem] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <nav className="flex w-20 flex-col items-center gap-1 overflow-y-auto border-r border-slate-800 bg-slate-900 py-3">
        {CATS.map((c) => (
          <button key={c.id} onClick={() => { setCat(c.id); setQ(''); }} className={`flex w-16 flex-col items-center rounded-xl py-2 text-[11px] ${!q && cat === c.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <span className="text-xl">{c.icon}</span>{c.label}
          </button>
        ))}
        <label className="mt-auto flex w-16 cursor-pointer flex-col items-center rounded-xl py-2 text-[11px] text-slate-400 hover:bg-slate-800">
          <span className="text-xl">📁</span>Upload
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && add(e.target.files)} />
        </label>
      </nav>
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/70">
        <div className="p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools…  (e.g. water)" className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm placeholder:text-slate-500" />
        </div>
        <div className="grid flex-1 content-start grid-cols-2 gap-2 overflow-y-auto px-3 pb-3">
          {shown.map((t) => (
            <button key={t.id} onClick={() => pick(t)} className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs ${active === t.id ? 'border-violet-500 bg-violet-600/20 text-white' : 'border-slate-800 text-slate-300 hover:bg-slate-800'}`}>
              <span className="text-2xl">{t.icon}</span><span className="text-center leading-tight">{t.label}</span>
              {!t.real && <span className="text-[9px] uppercase text-slate-500">soon</span>}
            </button>
          ))}
          {shown.length === 0 && <p className="col-span-2 text-sm text-slate-500">No tool matches “{q}”.</p>}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-4 py-2">
          <div className="min-w-0 flex-1"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-300">{activeTool.icon} {activeTool.label}</div>
            {activeTool.real ? <div className="max-w-xs"><ToolOptions o={o} set={set} /></div> : <p className="text-sm text-slate-500">Placeholder tool for this prototype.</p>}</div>
          <div className="text-sm"><Stats img={current} preview={preview} /></div>
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
