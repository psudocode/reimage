import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import { validateStripMetadata, type StripMetadataOptions } from './options.ts';

export default function StripMetadataPanel({
  value,
  onChange,
}: ToolPanelProps<StripMetadataOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateStripMetadata(value);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.stripMetadata.description')}</p>

      <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
        <li>{t('tools.stripMetadata.removesLocation')}</li>
        <li>{t('tools.stripMetadata.removesCamera')}</li>
        <li>{t('tools.stripMetadata.removesOther')}</li>
      </ul>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <label htmlFor={`${id}-quality`}>{t('tools.stripMetadata.quality')}</label>
          <span className="text-slate-400">{value.quality}</span>
        </div>
        <input
          id={`${id}-quality`}
          type="range"
          min={1}
          max={100}
          step={1}
          value={Number.isFinite(value.quality) ? value.quality : 92}
          onChange={(event) => onChange({ ...value, quality: Number(event.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-slate-500">{t('tools.stripMetadata.qualityHint')}</p>
      </div>

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
