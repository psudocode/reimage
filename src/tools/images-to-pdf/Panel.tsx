import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import { MARGINS, PAGE_SIZES, validateImagesToPdf, type ImagesToPdfOptions } from './options.ts';

export default function ImagesToPdfPanel({ value, onChange }: ToolPanelProps<ImagesToPdfOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateImagesToPdf(value);
  const set = (patch: Partial<ImagesToPdfOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.imagesToPdf.description')}</p>

      <div className="space-y-1">
        <label htmlFor={`${id}-size`} className="block text-sm">
          {t('tools.imagesToPdf.pageSize')}
        </label>
        <select
          id={`${id}-size`}
          value={value.pageSize}
          onChange={(event) =>
            set({ pageSize: event.target.value as ImagesToPdfOptions['pageSize'] })
          }
          className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {t(`tools.imagesToPdf.sizes.${size}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${id}-margin`} className="block text-sm">
          {t('tools.imagesToPdf.margin')}
        </label>
        <select
          id={`${id}-margin`}
          value={value.margin}
          onChange={(event) => set({ margin: event.target.value as ImagesToPdfOptions['margin'] })}
          className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm"
        >
          {MARGINS.map((margin) => (
            <option key={margin} value={margin}>
              {t(`tools.imagesToPdf.margins.${margin}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <label htmlFor={`${id}-quality`}>{t('tools.imagesToPdf.quality')}</label>
          <output htmlFor={`${id}-quality`}>{value.quality}</output>
        </div>
        <input
          id={`${id}-quality`}
          type="range"
          min={1}
          max={100}
          step={1}
          value={Number.isFinite(value.quality) ? value.quality : 85}
          onChange={(event) => set({ quality: Number(event.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-slate-500">{t('tools.imagesToPdf.qualityHint')}</p>
      </div>

      <p className="text-xs text-slate-500">{t('tools.imagesToPdf.orderHint')}</p>

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
