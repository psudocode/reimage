import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  MAX_MARGIN,
  MAX_OPACITY,
  MAX_SIZE,
  MAX_TEXT_LENGTH,
  MIN_OPACITY,
  MIN_SIZE,
  WATERMARK_MODES,
  WATERMARK_POSITIONS,
  validateWatermark,
  type WatermarkOptions,
} from './options.ts';

const MODE_KEYS = {
  text: 'tools.watermark.modeText',
  image: 'tools.watermark.modeImage',
} as const;

const inputClass = 'w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm';

export default function WatermarkPanel({ value, onChange }: ToolPanelProps<WatermarkOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateWatermark(value);
  const set = (patch: Partial<WatermarkOptions>) => onChange({ ...value, ...patch });

  const slider = (
    field: 'size' | 'opacity' | 'margin',
    labelKey: string,
    min: number,
    max: number,
  ) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <label htmlFor={`${id}-${field}`}>{t(labelKey)}</label>
        <span className="text-slate-400">{value[field]}%</span>
      </div>
      <input
        id={`${id}-${field}`}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value[field]}
        onChange={(event) => set({ [field]: Number(event.target.value) })}
        className="w-full"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.watermark.description')}</p>

      <fieldset className="flex gap-4">
        <legend className="sr-only">{t('tools.watermark.label')}</legend>
        {WATERMARK_MODES.map((mode) => (
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

      {value.mode === 'text' && (
        <div className="space-y-2">
          <div className="space-y-1">
            <label htmlFor={`${id}-text`} className="text-sm">
              {t('tools.watermark.text')}
            </label>
            <input
              id={`${id}-text`}
              type="text"
              maxLength={MAX_TEXT_LENGTH}
              value={value.text}
              onChange={(event) => set({ text: event.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-color`} className="text-sm">
              {t('tools.watermark.color')}
            </label>
            <input
              id={`${id}-color`}
              type="color"
              value={value.color}
              onChange={(event) => set({ color: event.target.value })}
            />
          </div>
        </div>
      )}

      {value.mode === 'image' && (
        <div className="space-y-1">
          <label htmlFor={`${id}-logo`} className="text-sm">
            {t('tools.watermark.logo')}
          </label>
          <input
            id={`${id}-logo`}
            type="file"
            accept="image/*"
            onChange={(event) => set({ logo: event.target.files?.[0] })}
            className="w-full text-sm"
          />
          <p className="text-xs text-slate-500">{t('tools.watermark.logoHint')}</p>
        </div>
      )}

      {slider('size', `tools.watermark.size.${value.mode}`, MIN_SIZE, MAX_SIZE)}
      {slider('opacity', 'tools.watermark.opacity', MIN_OPACITY, MAX_OPACITY)}

      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm">{t('tools.watermark.position')}</legend>
        <div className="grid w-32 grid-cols-3 gap-1">
          {WATERMARK_POSITIONS.map((position) => (
            <label
              key={position}
              title={t(`tools.watermark.positions.${position}`)}
              className={`flex h-9 cursor-pointer items-center justify-center rounded border ${
                value.position === position
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <input
                type="radio"
                name={`${id}-position`}
                aria-label={t(`tools.watermark.positions.${position}`)}
                checked={value.position === position}
                onChange={() => set({ position })}
                className="size-3"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {slider('margin', 'tools.watermark.margin', 0, MAX_MARGIN)}

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
