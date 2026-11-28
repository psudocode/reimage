import { useT } from '../../i18n/index.ts';
import { formatBytes, isHeicFile, savedPercent } from './files.ts';
import type { WorkspaceItem } from './state.ts';

interface ImageListProps {
  items: WorkspaceItem[];
  locked: boolean;
  onRemove(id: string): void;
  /** When set, the thumbnail and name become a button that picks the image. */
  selectedId?: string;
  onSelect?(id: string): void;
}

function ItemStatusText({ item }: { item: WorkspaceItem }) {
  const t = useT();
  if (item.status === 'failed') {
    return (
      <p role="alert" className="text-xs text-red-400">
        {t('workspace.status.failed')}:{' '}
        {isHeicFile(item.file) ? t('workspace.heicUnsupported') : item.error}
      </p>
    );
  }
  if (item.status === 'done' && item.result) {
    const percent = savedPercent(item.size, item.result.bytesAfter);
    return (
      <div className="space-y-0.5 text-xs">
        <p className={percent > 0 ? 'text-emerald-400' : 'text-amber-400'}>
          {formatBytes(item.size)} → {formatBytes(item.result.bytesAfter)} ·{' '}
          {percent > 0
            ? t('workspace.smaller').replace('{percent}', String(percent))
            : percent < 0
              ? t('workspace.larger').replace('{percent}', String(-percent))
              : t('workspace.sameSize')}
        </p>
        {item.result.targetMissed && (
          <p className="text-amber-400">{t('workspace.targetMissed')}</p>
        )}
        {item.result.downscaled && <p className="text-slate-400">{t('workspace.downscaled')}</p>}
      </div>
    );
  }
  if (item.status === 'processing') {
    return <p className="text-xs text-slate-400">{t('workspace.status.processing')}</p>;
  }
  return <p className="text-xs text-slate-400">{formatBytes(item.size)}</p>;
}

function ItemBody({
  item,
  selectedId,
  onSelect,
  children,
}: {
  item: WorkspaceItem;
  selectedId?: string;
  onSelect?(id: string): void;
  children: React.ReactNode;
}) {
  const className = 'flex min-w-0 flex-1 items-center gap-3 text-left';
  if (!onSelect) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={item.id === selectedId ? 'true' : undefined}
      className={className}
    >
      {children}
    </button>
  );
}

export function ImageList({ items, locked, onRemove, selectedId, onSelect }: ImageListProps) {
  const t = useT();
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-center gap-3 rounded-lg border bg-slate-900/60 p-2 ${
            item.id === selectedId ? 'border-violet-500' : 'border-slate-800'
          }`}
        >
          <ItemBody item={item} selectedId={selectedId} onSelect={onSelect}>
            <img
              src={item.previewUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-14 shrink-0 rounded object-cover bg-slate-800"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium" title={item.name}>
                {item.name}
              </p>
              <ItemStatusText item={item} />
              {item.status === 'processing' && (
                <progress
                  value={item.progress}
                  max={1}
                  aria-label={`${t('workspace.status.processing')}: ${item.name}`}
                  className="h-1.5 w-full"
                />
              )}
            </div>
          </ItemBody>
          {item.status === 'done' && item.result && (
            <a
              href={item.result.url}
              download={item.result.fileName}
              className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              {t('workspace.download')}
              <span className="sr-only"> {item.result.fileName}</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={locked}
            aria-label={`${t('workspace.remove')}: ${item.name}`}
            className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
