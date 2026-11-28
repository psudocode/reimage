import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  MAX_COLUMNS,
  MAX_GAP,
  MERGE_LAYOUTS,
  MIN_COLUMNS,
  TRANSPARENT,
  mergeDefaults,
  validateMerge,
  type MergeOptions,
} from './options.ts';

const LAYOUT_KEYS = {
  horizontal: 'tools.merge.layoutHorizontal',
  vertical: 'tools.merge.layoutVertical',
  grid: 'tools.merge.layoutGrid',
} as const;

const INPUT = 'w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm';

/** A number field: empty means "not a number yet" so validation can flag it. */
function parseNumber(raw: string): number {
  return raw.trim() === '' ? NaN : Number(raw);
}

export default function MergePanel({ value, onChange }: ToolPanelProps<MergeOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateMerge(value);
  const set = (patch: Partial<MergeOptions>) => onChange({ ...value, ...patch });
  const transparent = value.background === TRANSPARENT;
  // The colour input can only show a real colour; remember a sensible one for "transparent".
  const swatch = transparent ? mergeDefaults.background : value.background;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.merge.description')}</p>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">{t('tools.merge.layout')}</legend>
        {MERGE_LAYOUTS.map((layout) => (
          <label key={layout} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${id}-layout`}
              checked={value.layout === layout}
              onChange={() => set({ layout })}
            />
            {t(LAYOUT_KEYS[layout])}
          </label>
        ))}
      </fieldset>

      {value.layout === 'grid' && (
        <div className="space-y-1">
          <label htmlFor={`${id}-columns`} className="text-sm">
            {t('tools.merge.columns')}
          </label>
          <input
            id={`${id}-columns`}
            type="number"
            min={MIN_COLUMNS}
            max={MAX_COLUMNS}
            step={1}
            inputMode="numeric"
            value={Number.isNaN(value.columns) ? '' : value.columns}
            onChange={(event) => set({ columns: parseNumber(event.target.value) })}
            className={INPUT}
          />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={`${id}-gap`} className="text-sm">
          {t('tools.merge.gap')}
        </label>
        <input
          id={`${id}-gap`}
          type="number"
          min={0}
          max={MAX_GAP}
          step={1}
          inputMode="numeric"
          value={Number.isNaN(value.gap) ? '' : value.gap}
          onChange={(event) => set({ gap: parseNumber(event.target.value) })}
          className={INPUT}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-background`} className="text-sm">
            {t('tools.merge.background')}
          </label>
          <input
            id={`${id}-background`}
            type="color"
            value={swatch}
            disabled={transparent}
            onChange={(event) => set({ background: event.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-slate-700 bg-transparent disabled:opacity-40"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(event) =>
              set({ background: event.target.checked ? TRANSPARENT : mergeDefaults.background })
            }
          />
          {t('tools.merge.transparent')}
        </label>
        {transparent && (
          <p className="text-xs text-slate-500">{t('tools.merge.transparentHint')}</p>
        )}
      </div>

      <p className="text-xs text-slate-500">{t('tools.merge.sizeHint')}</p>

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
