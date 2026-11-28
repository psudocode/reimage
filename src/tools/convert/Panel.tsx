import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import { CONVERT_FORMATS, isLossyFormat, validateConvert, type ConvertOptions } from './options.ts';

const FORMAT_LABELS = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', avif: 'AVIF' } as const;

export default function ConvertPanel({ value, onChange }: ToolPanelProps<ConvertOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateConvert(value);
  const set = (patch: Partial<ConvertOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.convert.description')}</p>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm">{t('tools.convert.format')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {CONVERT_FORMATS.map((format) => (
            <label
              key={format}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${
                value.format === format
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <input
                type="radio"
                name={`${id}-format`}
                checked={value.format === format}
                onChange={() => set({ format })}
              />
              {FORMAT_LABELS[format]}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-400">{t(`tools.convert.hints.${value.format}`)}</p>
      </fieldset>

      {isLossyFormat(value.format) ? (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <label htmlFor={`${id}-quality`}>{t('tools.convert.quality')}</label>
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
          <p className="text-xs text-slate-400">{t('tools.convert.qualityHint')}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">{t('tools.convert.losslessNote')}</p>
      )}

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
