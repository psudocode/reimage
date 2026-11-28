import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  MAX_DIMENSION,
  MAX_PERCENT,
  MIN_PERCENT,
  RESIZE_MODES,
  RESIZE_PRESETS,
  validateResize,
  type ResizeOptions,
} from './options.ts';

const MODE_KEYS = {
  pixels: 'tools.resize.modePixels',
  percent: 'tools.resize.modePercent',
  preset: 'tools.resize.modePreset',
} as const;

/** Empty input = not set; anything else is passed on as a number (validated later). */
function parseSide(raw: string): number | undefined {
  return raw.trim() === '' ? undefined : Number(raw);
}

export default function ResizePanel({ value, onChange }: ToolPanelProps<ResizeOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateResize(value);
  const set = (patch: Partial<ResizeOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.resize.description')}</p>

      <fieldset className="flex gap-4">
        <legend className="sr-only">{t('tools.resize.label')}</legend>
        {RESIZE_MODES.map((mode) => (
          <label key={mode} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${id}-mode`}
              checked={value.mode === mode}
              onChange={() => set({ mode })}
            />
            {t(MODE_KEYS[mode])}
          </label>
        ))}
      </fieldset>

      {value.mode === 'pixels' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {(['width', 'height'] as const).map((side) => (
              <div key={side} className="space-y-1">
                <label htmlFor={`${id}-${side}`} className="text-sm">
                  {t(`tools.resize.${side}`)}
                </label>
                <input
                  id={`${id}-${side}`}
                  type="number"
                  min={1}
                  max={MAX_DIMENSION}
                  step={1}
                  inputMode="numeric"
                  value={value[side] ?? ''}
                  onChange={(event) => set({ [side]: parseSide(event.target.value) })}
                  className="w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.keepAspect}
              onChange={(event) => set({ keepAspect: event.target.checked })}
            />
            {t('tools.resize.keepAspect')}
          </label>
          {value.keepAspect && (
            <p className="text-xs text-slate-400">{t('tools.resize.keepAspectHint')}</p>
          )}
        </div>
      )}

      {value.mode === 'percent' && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label htmlFor={`${id}-percent`}>{t('tools.resize.percent')}</label>
          </div>
          <input
            id={`${id}-percent`}
            type="number"
            min={MIN_PERCENT}
            max={MAX_PERCENT}
            step={1}
            inputMode="numeric"
            value={Number.isNaN(value.percent) ? '' : value.percent}
            onChange={(event) =>
              set({ percent: event.target.value === '' ? NaN : Number(event.target.value) })
            }
            className="w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm"
          />
          <p className="text-xs text-slate-400">{t('tools.resize.percentHint')}</p>
        </div>
      )}

      {value.mode === 'preset' && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm">{t('tools.resize.preset')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {RESIZE_PRESETS.map((preset) => (
              <label
                key={preset.id}
                className={`flex cursor-pointer flex-col rounded border px-3 py-2 text-sm ${
                  value.preset === preset.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${id}-preset`}
                    checked={value.preset === preset.id}
                    onChange={() => set({ preset: preset.id })}
                  />
                  {t(`tools.resize.presets.${preset.id}`)}
                </span>
                <span className="pl-6 text-xs text-slate-400">
                  {preset.width} × {preset.height}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-400">{t('tools.resize.presetHint')}</p>
        </fieldset>
      )}

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
