import { useId } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  EXPAND_BACKGROUNDS,
  EXPAND_MODES,
  MAX_PADDING,
  validateExpand,
  type ExpandOptions,
} from './options.ts';

const MODE_KEYS = { all: 'tools.expand.modeAll', sides: 'tools.expand.modeSides' } as const;
const BACKGROUND_KEYS = {
  transparent: 'tools.expand.bgTransparent',
  color: 'tools.expand.bgColor',
} as const;
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** Empty input becomes NaN, which validation reports as an invalid padding. */
function parsePadding(raw: string): number {
  return raw.trim() === '' ? NaN : Number(raw);
}

export default function ExpandPanel({ value, onChange }: ToolPanelProps<ExpandOptions>) {
  const t = useT();
  const id = useId();
  const errors = validateExpand(value);
  const set = (patch: Partial<ExpandOptions>) => onChange({ ...value, ...patch });
  const inputClass = 'w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm';

  const paddingInput = (key: 'all' | (typeof SIDES)[number], label: string) => (
    <div key={key} className="space-y-1">
      <label htmlFor={`${id}-${key}`} className="text-sm">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        type="number"
        min={0}
        max={MAX_PADDING}
        step={1}
        inputMode="numeric"
        value={Number.isNaN(value[key]) ? '' : value[key]}
        onChange={(event) => set({ [key]: parsePadding(event.target.value) })}
        className={inputClass}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.expand.description')}</p>

      <fieldset className="flex gap-4">
        <legend className="sr-only">{t('tools.expand.label')}</legend>
        {EXPAND_MODES.map((mode) => (
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

      {value.mode === 'all' ? (
        paddingInput('all', t('tools.expand.padding'))
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {SIDES.map((side) => paddingInput(side, t(`tools.expand.${side}`)))}
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm">{t('tools.expand.background')}</legend>
        <div className="flex gap-4">
          {EXPAND_BACKGROUNDS.map((background) => (
            <label key={background} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-background`}
                checked={value.background === background}
                onChange={() => set({ background })}
              />
              {t(BACKGROUND_KEYS[background])}
            </label>
          ))}
        </div>
        {value.background === 'color' ? (
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-color`} className="text-sm">
              {t('tools.expand.color')}
            </label>
            <input
              id={`${id}-color`}
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(value.color) ? value.color : '#ffffff'}
              onChange={(event) => set({ color: event.target.value })}
              className="h-8 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
            />
            <span className="text-xs text-slate-500">{value.color}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">{t('tools.expand.transparentHint')}</p>
        )}
      </fieldset>

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}
    </div>
  );
}
