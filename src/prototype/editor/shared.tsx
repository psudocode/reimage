// PROTOTYPE (throwaway): shared bits for the editor-UI variants. Not production code.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

export type ToolId = 'compress' | 'convert' | 'resize' | 'crop';
export interface Crop { x: number; y: number; w: number; h: number } // percent
export interface Opts {
  tool: ToolId;
  quality: number; // 1..100
  format: 'image/jpeg' | 'image/webp' | 'image/png';
  scale: number; // percent
  crop: Crop;
}
export const defaultOpts: Opts = {
  tool: 'compress', quality: 60, format: 'image/jpeg', scale: 100,
  crop: { x: 10, y: 10, w: 80, h: 80 },
};
export interface Img { id: string; name: string; url: string; size: number }

export function fmt(n: number) {
  return n > 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;
}

/** Generates a sample photo-ish image so the prototype works with zero setup. */
export async function makeSample(): Promise<Img> {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 1000;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#1e3a8a'); sky.addColorStop(1, '#f59e0b');
  g.fillStyle = sky; g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = '#fde68a'; g.beginPath(); g.arc(1150, 420, 90, 0, 7); g.fill();
  for (let i = 0; i < 3; i++) {
    g.fillStyle = ['#334155', '#1e293b', '#0f172a'][i]!;
    g.beginPath(); g.moveTo(0, 1000);
    for (let x = 0; x <= 1600; x += 40) g.lineTo(x, 560 + i * 110 + Math.sin(x / 90 + i * 2) * 60 + Math.cos(x / 37) * 18);
    g.lineTo(1600, 1000); g.fill();
  }
  for (let i = 0; i < 9000; i++) { // noise so compression is visible
    g.fillStyle = `rgba(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0},0.06)`;
    g.fillRect(Math.random() * 1600, Math.random() * 1000, 3, 3);
  }
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
  return { id: 'sample', name: 'sample-sunset.png', url: URL.createObjectURL(blob), size: blob.size };
}

export function useImages() {
  const [images, setImages] = useState<Img[]>([]);
  const [index, setIndex] = useState(0);
  useEffect(() => { void makeSample().then((s) => setImages((p) => (p.length ? p : [s]))); }, []);
  const add = (files: FileList | File[]) =>
    setImages((p) => [...p, ...[...files].filter((f) => f.type.startsWith('image/')).map((f) => ({
      id: crypto.randomUUID(), name: f.name, url: URL.createObjectURL(f), size: f.size }))]);
  return { images, current: images[Math.min(index, images.length - 1)], index, setIndex, add };
}

/** Real preview: draws crop + scale on a canvas and encodes at the chosen quality. */
export function usePreview(img: Img | undefined, o: Opts) {
  const [out, setOut] = useState<{ url: string; bytes: number; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify([img?.id, o.tool === 'crop' ? o.crop : null, o.quality, o.format, o.scale, o.tool]);
  useEffect(() => {
    if (!img) return;
    let dead = false;
    setBusy(true);
    const t = setTimeout(async () => {
      const bmp = await createImageBitmap(await (await fetch(img.url)).blob());
      const useCrop = o.tool === 'crop';
      const sx = useCrop ? bmp.width * o.crop.x / 100 : 0, sy = useCrop ? bmp.height * o.crop.y / 100 : 0;
      const sw = useCrop ? bmp.width * o.crop.w / 100 : bmp.width, sh = useCrop ? bmp.height * o.crop.h / 100 : bmp.height;
      const k = o.tool === 'resize' ? o.scale / 100 : 1;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
      c.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const q = o.tool === 'compress' || o.tool === 'convert' ? o.quality / 100 : 0.92;
      const mime = o.tool === 'convert' || o.tool === 'compress' ? o.format : 'image/jpeg';
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), mime, q));
      if (dead) return;
      setOut((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), bytes: blob.size, w: c.width, h: c.height }; });
      setBusy(false);
    }, 150);
    return () => { dead = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { out, busy };
}

/** Before/after slider. */
export function Compare({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: RPointerEvent) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return;
    const r = ref.current!.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };
  return (
    <div ref={ref} onPointerDown={move} onPointerMove={move} className="relative select-none touch-none cursor-ew-resize overflow-hidden rounded-lg">
      <img src={after} alt="after" draggable={false} className="block w-full" />
      <img src={before} alt="before" draggable={false} className="absolute inset-0 h-full w-full object-fill" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-900">⇆</div>
      </div>
      <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">Before</span>
      <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">After</span>
    </div>
  );
}

/** Draggable crop box (move + corner handles) over the original image. */
export function CropStage({ src, crop, onChange }: { src: string; crop: Crop; onChange(c: Crop): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: string; sx: number; sy: number; start: Crop } | null>(null);
  const start = (mode: string) => (e: RPointerEvent) => {
    e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: crop };
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current; if (!d) return;
    const r = ref.current!.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / r.width) * 100, dy = ((e.clientY - d.sy) / r.height) * 100;
    let { x, y, w, h } = d.start;
    if (d.mode === 'move') { x = Math.min(100 - w, Math.max(0, x + dx)); y = Math.min(100 - h, Math.max(0, y + dy)); }
    else {
      if (d.mode.includes('w')) { const nx = Math.min(x + w - 5, Math.max(0, x + dx)); w += x - nx; x = nx; }
      if (d.mode.includes('e')) w = Math.min(100 - x, Math.max(5, w + dx));
      if (d.mode.includes('n')) { const ny = Math.min(y + h - 5, Math.max(0, y + dy)); h += y - ny; y = ny; }
      if (d.mode.includes('s')) h = Math.min(100 - y, Math.max(5, h + dy));
    }
    onChange({ x, y, w, h });
  };
  const handles: [string, string][] = [['nw', 'left-0 top-0'], ['ne', 'right-0 top-0'], ['sw', 'left-0 bottom-0'], ['se', 'right-0 bottom-0']];
  return (
    <div ref={ref} className="relative select-none touch-none overflow-hidden rounded-lg" onPointerMove={move} onPointerUp={() => (drag.current = null)}>
      <img src={src} alt="" draggable={false} className="block w-full" />
      <div onPointerDown={start('move')} className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
        style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }}>
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }, (_, i) => <div key={i} className="border border-white/25" />)}
        </div>
        {handles.map(([m, pos]) => (
          <div key={m} onPointerDown={start(m)} className={`absolute ${pos} h-4 w-4 ${m === 'nw' || m === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'} rounded-sm bg-white`}
            style={{ transform: `translate(${pos.includes('left') ? '-50%' : '50%'}, ${pos.includes('top') ? '-50%' : '50%'})` }} />
        ))}
      </div>
    </div>
  );
}

export const TOOLS: { id: ToolId; label: string; icon: string }[] = [
  { id: 'compress', label: 'Compress', icon: '🗜' }, { id: 'convert', label: 'Convert', icon: '🔄' },
  { id: 'resize', label: 'Resize', icon: '↔' }, { id: 'crop', label: 'Crop', icon: '✂' },
];

/** Tool options (stand-in for the real tool Panels). */
export function ToolOptions({ o, set }: { o: Opts; set(p: Partial<Opts>): void }) {
  const row = 'space-y-1 text-sm';
  return (
    <div className="space-y-4">
      {(o.tool === 'compress' || o.tool === 'convert') && (
        <label className={row}><span className="flex justify-between text-slate-300">Quality <b>{o.quality}</b></span>
          <input type="range" min={1} max={100} value={o.quality} onChange={(e) => set({ quality: +e.target.value })} className="w-full" /></label>
      )}
      {(o.tool === 'compress' || o.tool === 'convert') && (
        <label className={row}><span className="text-slate-300">Format</span>
          <select value={o.format} onChange={(e) => set({ format: e.target.value as Opts['format'] })} className="w-full rounded bg-slate-800 p-2">
            <option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></label>
      )}
      {o.tool === 'resize' && (
        <label className={row}><span className="flex justify-between text-slate-300">Scale <b>{o.scale}%</b></span>
          <input type="range" min={5} max={100} value={o.scale} onChange={(e) => set({ scale: +e.target.value })} className="w-full" /></label>
      )}
      {o.tool === 'crop' && <p className="text-sm text-slate-400">Drag the box on the image. Stored as percent, so it applies the same to every image in a batch.
        <br /><span className="font-mono text-xs">x{o.crop.x.toFixed(0)} y{o.crop.y.toFixed(0)} w{o.crop.w.toFixed(0)} h{o.crop.h.toFixed(0)} (%)</span></p>}
    </div>
  );
}

/** The thing being looked at: crop stage while cropping, before/after otherwise. */
export function Stage({ img, o, set, preview }: { img: Img; o: Opts; set(p: Partial<Opts>): void; preview: ReturnType<typeof usePreview> }) {
  const { out, busy } = preview;
  const ready = useMemo(() => out?.url, [out]);
  if (o.tool === 'crop') return <CropStage src={img.url} crop={o.crop} onChange={(crop) => set({ crop })} />;
  return (
    <div className={busy ? 'opacity-70 transition' : 'transition'}>
      {ready ? <Compare before={img.url} after={ready} /> : <div className="h-64 animate-pulse rounded-lg bg-slate-800" />}
    </div>
  );
}

export function Stats({ img, preview }: { img: Img; preview: ReturnType<typeof usePreview> }) {
  const { out, busy } = preview;
  if (!out) return <span className="text-slate-500">…</span>;
  const pct = Math.round((1 - out.bytes / img.size) * 100);
  return (
    <span className={busy ? 'opacity-60' : ''}>
      {fmt(img.size)} → <b>{fmt(out.bytes)}</b>{' '}
      <span className={pct >= 0 ? 'text-emerald-400' : 'text-amber-400'}>({pct >= 0 ? '−' : '+'}{Math.abs(pct)}%)</span>
      <span className="text-slate-500"> · {out.w}×{out.h}</span>
    </span>
  );
}
