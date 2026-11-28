import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  CROP_MODES,
  CROP_RATIOS,
  MAX_RATIO_TERM,
  validateCrop,
  type CropOptions,
  type CropRatioId,
} from './options.ts';

const MODE_KEYS = { ratio: 'tools.crop.modeRatio', free: 'tools.crop.modeFree' } as const;
const EDGES = ['left', 'top', 'right', 'bottom'] as const;
const INPUT_CLASS = 'w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm';

/** Empty input becomes NaN so validation can flag it. */
const parseNumber = (raw: string) => (raw.trim() === '' ? NaN : Number(raw));
const show = (value: number) => (Number.isNaN(value) ? '' : value);

export default function CropPanel({ value, onChange }: ToolPanelProps<CropOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateCrop(value);
  const set = (patch: Partial<CropOptions>) => onChange({ ...value, ...patch });
  const ratios: readonly CropRatioId[] = [...CROP_RATIOS.map((ratio) => ratio.id), 'custom'];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.crop.description')}</p>

      <fieldset className="flex gap-4">
        <legend className="sr-only">{t('tools.crop.label')}</legend>
        {CROP_MODES.map((mode) => (
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

      {value.mode === 'ratio' && (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm">{t('tools.crop.ratio')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {ratios.map((ratio) => (
                <label
                  key={ratio}
                  className={`flex cursor-pointer items-center justify-center gap-1 rounded border px-2 py-1 text-sm ${
                    value.ratio === ratio
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`${id}-ratio`}
                    checked={value.ratio === ratio}
                    onChange={() => set({ ratio })}
                  />
                  {ratio === 'custom' ? t('tools.crop.custom') : ratio}
                </label>
              ))}
            </div>
          </fieldset>

          {value.ratio === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              {(['customWidth', 'customHeight'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <label htmlFor={`${id}-${field}`} className="text-sm">
                    {t(`tools.crop.${field}`)}
                  </label>
                  <input
                    id={`${id}-${field}`}
                    type="number"
                    min={1}
                    max={MAX_RATIO_TERM}
                    step={1}
                    inputMode="numeric"
                    value={show(value[field])}
                    onChange={(event) => set({ [field]: parseNumber(event.target.value) })}
                    className={INPUT_CLASS}
                  />
                </div>
              ))}
            </div>
          )}

          {(['positionX', 'positionY'] as const).map((field) => (
            <div key={field} className="space-y-1">
              <label htmlFor={`${id}-${field}`} className="flex justify-between text-sm">
                <span>{t(`tools.crop.${field}`)}</span>
                <span className="text-slate-400">{show(value[field])}%</span>
              </label>
              <input
                id={`${id}-${field}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={show(value[field])}
                onChange={(event) => set({ [field]: parseNumber(event.target.value) })}
                className="w-full"
              />
            </div>
          ))}
          <p className="text-xs text-slate-400">{t('tools.crop.ratioHint')}</p>
        </div>
      )}

      {value.mode === 'free' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {EDGES.map((edge) => (
              <div key={edge} className="space-y-1">
                <label htmlFor={`${id}-${edge}`} className="text-sm">
                  {t(`tools.crop.${edge}`)}
                </label>
                <input
                  id={`${id}-${edge}`}
                  type="number"
                  min={0}
                  max={99}
                  step={1}
                  inputMode="numeric"
                  value={show(value[edge])}
                  onChange={(event) => set({ [edge]: parseNumber(event.target.value) })}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">{t('tools.crop.freeHint')}</p>
        </div>
      )}

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
