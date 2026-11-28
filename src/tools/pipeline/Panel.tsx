import { Suspense, useEffect, useId, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import type { PipelineStep } from '../../core/pipeline/types.ts';
import { getRegisteredRuntimes, getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import type { ToolPanelProps } from '../types.ts';
import {
  MAX_PIPELINE_STEPS,
  PIPELINE_TOOL_ID,
  validatePipelineSteps,
  type PipelineToolOptions,
} from './options.ts';
import { getBrowserPresetStore, type Preset } from './presetStore.ts';

const BUTTON =
  'rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-40';
const INPUT_CLASS = 'w-full rounded border border-slate-700 bg-transparent px-2 py-1 text-sm';

/** Keep the steps whose tool still exists: a preset saved by another version must not break the panel. */
function usableSteps(steps: PipelineStep[]): PipelineStep[] {
  return steps.filter(
    (step) => step.toolId !== PIPELINE_TOOL_ID && getToolRuntimeById(step.toolId),
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function StepEditor({ step, onChange }: { step: PipelineStep; onChange(options: unknown): void }) {
  const t = useT();
  const ui = getToolUIById(step.toolId);
  if (!ui) return null;
  const { Panel } = ui;
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">{t('workspace.loading')}</p>}>
      <Panel value={step.options} onChange={onChange} />
    </Suspense>
  );
}

function Presets({
  steps,
  onLoad,
}: {
  steps: PipelineStep[];
  onLoad(steps: PipelineStep[]): void;
}) {
  const t = useT();
  const id = useId();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);

  const refresh = async () => {
    try {
      setPresets(await getBrowserPresetStore().list());
      setFailed(false);
    } catch {
      // IndexedDB can be blocked (private mode, storage off). Pipelines still work, only saving does not.
      setFailed(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || steps.length === 0) return;
    try {
      await getBrowserPresetStore().save({
        id: crypto.randomUUID(),
        name: trimmed,
        steps,
        createdAt: Date.now(),
      });
      setName('');
      await refresh();
    } catch {
      setFailed(true);
    }
  };

  const remove = async (presetId: string) => {
    try {
      await getBrowserPresetStore().remove(presetId);
      await refresh();
    } catch {
      setFailed(true);
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2 border-t border-slate-800 pt-3">
      <h3 id={`${id}-title`} className="text-sm font-medium">
        {t('tools.pipeline.presets')}
      </h3>
      <p className="text-xs text-slate-500">{t('tools.pipeline.presetsHint')}</p>
      <div className="flex gap-2">
        <input
          aria-label={t('tools.pipeline.presetName')}
          placeholder={t('tools.pipeline.presetName')}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          className={INPUT_CLASS}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!name.trim() || steps.length === 0}
          className={BUTTON}
        >
          {t('tools.pipeline.savePreset')}
        </button>
      </div>
      {failed && (
        <p role="alert" className="text-xs text-amber-400">
          {t('tools.pipeline.storageError')}
        </p>
      )}
      {presets.length === 0 && !failed ? (
        <p className="text-xs text-slate-500">{t('tools.pipeline.noPresets')}</p>
      ) : (
        <ul className="space-y-1">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{preset.name}</span>
              <button
                type="button"
                className={BUTTON}
                aria-label={`${t('tools.pipeline.loadPreset')}: ${preset.name}`}
                onClick={() => onLoad(usableSteps(preset.steps))}
              >
                {t('tools.pipeline.loadPreset')}
              </button>
              <button
                type="button"
                className={BUTTON}
                aria-label={`${t('tools.pipeline.deletePreset')}: ${preset.name}`}
                onClick={() => void remove(preset.id)}
              >
                {t('tools.pipeline.deletePreset')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PipelinePanel({ value, onChange }: ToolPanelProps<PipelineToolOptions>) {
  const t = useT();
  const id = useId();
  const { steps } = value;
  const errors =
    steps.length === 0 ? [] : validatePipelineSteps(value, getToolRuntimeById as never);
  const addable = getRegisteredRuntimes().filter((tool) => tool.id !== PIPELINE_TOOL_ID);
  const setSteps = (next: PipelineStep[]) => onChange({ ...value, steps: next });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{t('tools.pipeline.description')}</p>

      {steps.length === 0 ? (
        <p className="text-sm text-slate-500">{t('tools.pipeline.empty')}</p>
      ) : (
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const label = t(getToolUIById(step.toolId)?.labelKey ?? step.toolId);
            return (
              <li
                key={`${index}-${step.toolId}`}
                className="space-y-2 rounded-lg border border-slate-800 p-3"
              >
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {index + 1}. {label}
                  </span>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={index === 0}
                    aria-label={`${t('tools.pipeline.moveUp')}: ${label}`}
                    onClick={() => setSteps(move(steps, index, index - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={index === steps.length - 1}
                    aria-label={`${t('tools.pipeline.moveDown')}: ${label}`}
                    onClick={() => setSteps(move(steps, index, index + 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    aria-label={`${t('tools.pipeline.removeStep')}: ${label}`}
                    onClick={() => setSteps(steps.filter((_, at) => at !== index))}
                  >
                    ✕
                  </button>
                </div>
                <StepEditor
                  step={step}
                  onChange={(options) =>
                    setSteps(steps.map((item, at) => (at === index ? { ...item, options } : item)))
                  }
                />
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-add`} className="sr-only">
          {t('tools.pipeline.addStep')}
        </label>
        <select
          id={`${id}-add`}
          value=""
          disabled={steps.length >= MAX_PIPELINE_STEPS}
          onChange={(event) => {
            const tool = addable.find((candidate) => candidate.id === event.target.value);
            if (tool)
              setSteps([...steps, { toolId: tool.id, options: structuredClone(tool.defaults) }]);
          }}
          className={INPUT_CLASS}
        >
          <option value="">{t('tools.pipeline.addStep')}</option>
          {addable.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {t(getToolUIById(tool.id)?.labelKey ?? tool.id)}
            </option>
          ))}
        </select>
      </div>

      {errors.map((key) => (
        <p key={key} role="alert" className="text-sm text-red-400">
          {t(key)}
        </p>
      ))}

      <Presets steps={steps} onLoad={setSteps} />
    </div>
  );
}
