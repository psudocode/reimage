import { useT } from '../../i18n/index.ts';
import { Icon } from '../../ui/Icon.tsx';
import type { WorkspaceItem } from '../workspace/state.ts';

interface FilmstripProps {
  items: WorkspaceItem[];
  selectedId: string;
  locked: boolean;
  onSelect(id: string): void;
  onRemove(id: string): void;
  onClear(): void;
}

/** Desktop: every image as a thumbnail under the canvas. */
export function Filmstrip({
  items,
  selectedId,
  locked,
  onSelect,
  onRemove,
  onClear,
}: FilmstripProps) {
  const t = useT();
  return (
    <section
      aria-label={t('editor.filmstrip')}
      className="flex items-center gap-2 border-t border-slate-800 bg-slate-900 p-2"
    >
      <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-1">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id} className="group relative shrink-0">
              <button
                type="button"
                aria-label={item.name}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(item.id)}
                className={`block h-14 w-20 overflow-hidden rounded-lg border-2 ${
                  item.status === 'failed'
                    ? 'border-red-500'
                    : selected
                      ? 'border-violet-500'
                      : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={item.previewUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full bg-slate-800 object-cover"
                />
                {item.status === 'processing' && (
                  <progress
                    value={item.progress}
                    max={1}
                    aria-label={`${t('workspace.status.processing')}: ${item.name}`}
                    className="absolute inset-x-1 bottom-1 h-1 w-[calc(100%-0.5rem)]"
                  />
                )}
                {item.status === 'done' && (
                  <span className="absolute bottom-1 left-1 rounded bg-emerald-600 px-1 text-[10px] leading-4">
                    ✓
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => onRemove(item.id)}
                aria-label={`${t('workspace.remove')}: ${item.name}`}
                className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-slate-700 text-slate-200 opacity-0 hover:bg-slate-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Icon name="close" className="size-3" />
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onClear}
        disabled={locked}
        className="shrink-0 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {t('workspace.clearAll')}
      </button>
    </section>
  );
}
