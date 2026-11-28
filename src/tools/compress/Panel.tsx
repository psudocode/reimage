import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import { MAX_TARGET_KB, type CompressOptions, validateCompress } from './options.ts';

export default function CompressPanel({ value, onChange }: ToolPanelProps<CompressOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateCompress(value);
  const set = (patch: Partial<CompressOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.compress.description')}</p>

      <fieldset className="flex gap-4">
        <legend className="sr-only">{t('tools.compress.label')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={value.mode === 'quality'}
            onChange={() => set({ mode: 'quality' })}
          />
          {t('tools.compress.modeQuality')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={`${id}-mode`}
            checked={value.mode === 'targetSize'}
            onChange={() => set({ mode: 'targetSize' })}
          />
          {t('tools.compress.modeTarget')}
        </label>
      </fieldset>

      {value.mode === 'quality' ? (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label htmlFor={`${id}-quality`}>{t('tools.compress.quality')}</label>
            <output htmlFor={`${id}-quality`}>{value.quality}</output>
          </div>
          <input
            id={`${id}-quality`}
            type="range"
            min={1}
            max={100}
            step={1}
            value={value.quality}
            onChange={(event) => set({ quality: Number(event.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-slate-400">{t('tools.compress.qualityHint')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          <label htmlFor={`${id}-target`} className="block text-sm">
            {t('tools.compress.targetSize')}
          </label>
          <input
            id={`${id}-target`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_TARGET_KB}
            step={1}
            value={Number.isFinite(value.targetKb) ? value.targetKb : ''}
            onChange={(event) =>
              set({ targetKb: event.target.value === '' ? Number.NaN : Number(event.target.value) })
            }
            aria-invalid={errors.length > 0}
            className="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
          <p className="text-xs text-slate-400">{t('tools.compress.targetHint')}</p>
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
