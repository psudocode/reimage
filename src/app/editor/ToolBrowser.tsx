import { useT } from '../../i18n/index.ts';
import type { ToolUI } from '../../tools/types.ts';
import { Icon } from '../../ui/Icon.tsx';
import type { CategoryGroup } from './toolCatalog.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolUI = ToolUI<any>;

interface CategoryNavProps {
  groups: CategoryGroup[];
  /** `null` while a search is showing results from every category. */
  activeId: string | null;
  onSelect(id: CategoryGroup['id']): void;
  variant: 'rail' | 'tabs';
  /** Extra items placed after the categories (the desktop Upload button). */
  children?: React.ReactNode;
}

/** Category navigation: a vertical rail on desktop, a bottom tab bar on mobile. */
export function CategoryNav({ groups, activeId, onSelect, variant, children }: CategoryNavProps) {
  const t = useT();
  const rail = variant === 'rail';
  return (
    <nav
      aria-label={t('editor.railLabel')}
      className={
        rail
          ? 'flex w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-slate-800 bg-slate-900 py-3'
          : 'flex overflow-x-auto border-t border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)]'
      }
    >
      {groups.map((group) => {
        const active = group.id === activeId;
        return (
          <button
            key={group.id}
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(group.id)}
            className={
              rail
                ? `flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] ${
                    active ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`
                : `flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                    active ? 'text-violet-400' : 'text-slate-500'
                  }`
            }
          >
            <Icon name={group.icon} className="size-5" />
            {t(group.labelKey)}
          </button>
        );
      })}
      {children}
    </nav>
  );
}

interface SearchBoxProps {
  value: string;
  onChange(value: string): void;
  autoFocus?: boolean;
}

export function SearchBox({ value, onChange, autoFocus = false }: SearchBoxProps) {
  const t = useT();
  return (
    <div className="relative">
      <Icon
        name="search"
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500"
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        aria-label={t('editor.searchLabel')}
        placeholder={t('editor.searchPlaceholder')}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg bg-slate-800 py-2 pl-8 pr-3 text-sm placeholder:text-slate-500"
      />
    </div>
  );
}

interface ToolButtonsProps {
  tools: AnyToolUI[];
  activeId: string;
  disabled: boolean;
  onSelect(id: string): void;
  variant: 'grid' | 'chips';
  query?: string;
}

/** The tools of one category (or of a search): an icon + label grid, or sideways chips. */
export function ToolButtons({
  tools,
  activeId,
  disabled,
  onSelect,
  variant,
  query,
}: ToolButtonsProps) {
  const t = useT();
  const grid = variant === 'grid';

  if (tools.length === 0) {
    return (
      <p role="status" className="px-1 text-sm text-slate-500">
        {t('editor.noMatch').replace('{query}', query ?? '')}
      </p>
    );
  }
  return (
    <div
      role="group"
      aria-label={t('editor.toolsLabel')}
      className={
        grid ? 'grid grid-cols-2 content-start gap-2' : 'flex gap-2 overflow-x-auto px-3 py-2'
      }
    >
      {tools.map((tool) => {
        const active = tool.id === activeId;
        return (
          <button
            key={tool.id}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onSelect(tool.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
              grid ? 'px-2 py-3' : 'w-16 shrink-0 px-1 py-2 text-[11px]'
            } ${
              active
                ? 'border-violet-500 bg-violet-600/20 text-white'
                : `border-slate-800 text-slate-300 ${disabled ? '' : 'hover:bg-slate-800'}`
            }`}
          >
            <Icon name={tool.icon} className={grid ? 'size-6' : 'size-5'} />
            <span className="w-full truncate text-center leading-tight">{t(tool.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
