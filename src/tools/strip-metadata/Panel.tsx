import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  MAX_QUALITY,
  MIN_QUALITY,
  validateStripMetadata,
  type StripMetadataOptions,
} from './options.ts';

const REMOVED_KEYS = [
  'tools.stripMetadata.items.gps',
  'tools.stripMetadata.items.camera',
  'tools.stripMetadata.items.timestamps',
  'tools.stripMetadata.items.thumbnails',
  'tools.stripMetadata.items.author',
] as const;

export default function StripMetadataPanel({
  value,
  onChange,
}: ToolPanelProps<StripMetadataOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateStripMetadata(value);
  const set = (patch: Partial<StripMetadataOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.stripMetadata.description')}</p>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t('tools.stripMetadata.purgedHeading')}
        </h3>
        <ul className="space-y-1.5 text-xs text-slate-300">
          {REMOVED_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <span className="text-emerald-400" aria-hidden="true">
                ✓
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <label htmlFor={`${id}-quality`}>{t('tools.stripMetadata.quality')}</label>
          <output htmlFor={`${id}-quality`}>{value.quality}</output>
        </div>
        <input
          id={`${id}-quality`}
          type="range"
          min={MIN_QUALITY}
          max={MAX_QUALITY}
          step={1}
          value={value.quality}
          onChange={(event) => set({ quality: Number(event.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-slate-500">{t('tools.stripMetadata.qualityHint')}</p>
        <p className="text-xs text-slate-500">{t('tools.stripMetadata.losslessNote')}</p>
      </div>

      <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-300">
        {t('tools.stripMetadata.privacyNote')}
      </div>

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
