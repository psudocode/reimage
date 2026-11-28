import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  CROP_MODES,
  CROP_RATIOS,
  MAX_RATIO_TERM,
  validateCrop,
  type CropOptions,
} from './options.ts';

const MODE_KEYS = { ratio: 'tools.crop.modeRatio', free: 'tools.crop.modeFree' } as const;
const FIELD_CLASS = 'w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm';

/** Empty input becomes NaN so validation can flag it. */
const parse = (raw: string) => (raw.trim() === '' ? NaN : Number(raw));

export default function CropPanel({ value, onChange }: ToolPanelProps<CropOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateCrop(value);
  const set = (patch: Partial<CropOptions>) => onChange({ ...value, ...patch });

  const numberField = (
    key: 'left' | 'top' | 'width' | 'height' | 'ratioWidth' | 'ratioHeight' | 'offsetX' | 'offsetY',
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <div className="space-y-1">
      <label htmlFor={`${id}-${key}`} className="text-sm">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        type="number"
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        value={Number.isNaN(value[key]) ? '' : value[key]}
        onChange={(event) => set({ [key]: parse(event.target.value) })}
        className={FIELD_CLASS}
      />
    </div>
  );

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
            <div className="grid grid-cols-3 gap-2">
              {[...CROP_RATIOS.map((r) => r.id), 'custom' as const].map((ratio) => (
                <label
                  key={ratio}
                  className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${
                    value.ratio === ratio
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
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
              {numberField('ratioWidth', t('tools.crop.ratioWidth'), 1, MAX_RATIO_TERM, 0.1)}
              {numberField('ratioHeight', t('tools.crop.ratioHeight'), 1, MAX_RATIO_TERM, 0.1)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {numberField('offsetX', t('tools.crop.offsetX'), 0, 100)}
            {numberField('offsetY', t('tools.crop.offsetY'), 0, 100)}
          </div>
          <p className="text-xs text-slate-500">{t('tools.crop.offsetHint')}</p>
        </div>
      )}

      {value.mode === 'free' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {numberField('left', t('tools.crop.left'), 0, 99)}
            {numberField('top', t('tools.crop.top'), 0, 99)}
            {numberField('width', t('tools.crop.width'), 1, 100)}
            {numberField('height', t('tools.crop.height'), 1, 100)}
          </div>
          <p className="text-xs text-slate-500">{t('tools.crop.freeHint')}</p>
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
