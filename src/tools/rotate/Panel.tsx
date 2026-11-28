import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import { ROTATIONS, validateRotate, type RotateOptions } from './options.ts';

export default function RotatePanel({ value, onChange }: ToolPanelProps<RotateOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateRotate(value);
  const set = (patch: Partial<RotateOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.rotate.description')}</p>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm">{t('tools.rotate.rotation')}</legend>
        <div className="grid grid-cols-4 gap-2">
          {ROTATIONS.map((rotation) => (
            <label
              key={rotation}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded border px-2 py-2 text-sm ${
                value.rotation === rotation
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <input
                type="radio"
                name={`${id}-rotation`}
                aria-label={t(`tools.rotate.turns.${rotation}`)}
                checked={value.rotation === rotation}
                onChange={() => set({ rotation })}
              />
              {rotation}°
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">{t('tools.rotate.rotationHint')}</p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm">{t('tools.rotate.flip')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.flipH}
            onChange={(event) => set({ flipH: event.target.checked })}
          />
          {t('tools.rotate.flipH')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.flipV}
            onChange={(event) => set({ flipV: event.target.checked })}
          />
          {t('tools.rotate.flipV')}
        </label>
      </fieldset>

      <p className="text-xs text-slate-500">{t('tools.rotate.exifHint')}</p>

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
