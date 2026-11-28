import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPipeline } from '../../app/workspace/pipeline.ts';
import { LocaleContext } from '../../i18n/index.ts';
import type { ToolContext, ToolRuntime } from '../types.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import { mergeStepOutputs, validatePipelineSteps } from './options.ts';
import Panel from './Panel.tsx';
import type { Preset, PresetStore } from './presetStore.ts';
import { getBrowserPresetStore } from './presetStore.ts';
import { createPipelineRuntime } from './runtime.ts';

// A tiny in-memory stand-in for IndexedDB, which jsdom does not have.
const kv = vi.hoisted(() => new Map<string, unknown>());
vi.mock('idb-keyval', () => ({
  createStore: () => ({}),
  entries: async () => [...kv.entries()],
  set: async (key: string, value: unknown) => void kv.set(key, value),
  del: async (key: string) => void kv.delete(key),
}));

vi.mock('./presetStore.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./presetStore.ts')>()),
  getBrowserPresetStore: vi.fn(),
}));

const bitmap = (name: string) =>
  ({ name, close: vi.fn() }) as unknown as ImageBitmap & { name: string };

function fakeTool(
  id: string,
  run?: ToolRuntime['run'],
  toOutput?: ToolRuntime['toOutput'],
): ToolRuntime {
  return {
    id,
    defaults: {},
    validate: (o) => ((o as { bad?: boolean }).bad ? [`${id}.bad`] : []),
    run: run ?? (async (input) => input),
    toOutput,
  };
}

describe('pipeline options', () => {
  const tools = new Map([
    ['a', fakeTool('a')],
    ['b', fakeTool('b')],
  ]);
  const lookup = (id: string) => tools.get(id);

  it('needs at least one step', () => {
    expect(validatePipelineSteps({ steps: [] }, lookup)).toEqual(['tools.pipeline.errors.empty']);
  });

  it('rejects unknown tools and nested pipelines', () => {
    const steps = [
      { toolId: 'zzz', options: {} },
      { toolId: 'pipeline', options: {} },
    ];
    expect(validatePipelineSteps({ steps }, lookup)).toEqual(['tools.pipeline.errors.unknownTool']);
  });

  it('passes a step’s own errors through', () => {
    const steps = [{ toolId: 'a', options: { bad: true } }];
    expect(validatePipelineSteps({ steps }, lookup)).toEqual(['a.bad']);
  });

  it('limits the number of steps', () => {
    const steps = Array.from({ length: 11 }, () => ({ toolId: 'a', options: {} }));
    expect(validatePipelineSteps({ steps }, lookup)).toEqual(['tools.pipeline.errors.tooMany']);
  });

  it('merges step outputs with the later step winning', () => {
    const map = new Map([
      ['c', fakeTool('c', undefined, () => ({ format: 'jpeg', quality: 60 }))],
      ['d', fakeTool('d', undefined, () => ({ format: 'webp' }))],
    ]);
    const steps = [
      { toolId: 'c', options: {} },
      { toolId: 'd', options: {} },
    ];
    expect(mergeStepOutputs({ steps }, (id) => map.get(id))).toEqual({
      format: 'webp',
      quality: 60,
    });
  });
});

describe('pipeline runtime', () => {
  const ctx = (progress = vi.fn()) => ({ progress }) as unknown as ToolContext;

  it('runs steps in order and closes only its own intermediates', async () => {
    const input = bitmap('in');
    const mid = bitmap('mid');
    const out = bitmap('out');
    const order: string[] = [];
    const tools = new Map([
      ['a', fakeTool('a', async () => (order.push('a'), mid))],
      ['b', fakeTool('b', async () => (order.push('b'), out))],
    ]);
    const runtime = createPipelineRuntime((id) => tools.get(id));
    const steps = [
      { toolId: 'a', options: {} },
      { toolId: 'b', options: {} },
    ];
    const progress = vi.fn();
    await expect(runtime.run(input, { steps }, ctx(progress))).resolves.toBe(out);
    expect(order).toEqual(['a', 'b']);
    expect(input.close).not.toHaveBeenCalled();
    expect(mid.close).toHaveBeenCalledOnce();
    expect(out.close).not.toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith(1);
  });

  it('frees the intermediate when a later step fails', async () => {
    const input = bitmap('in');
    const mid = bitmap('mid');
    const tools = new Map([
      ['a', fakeTool('a', async () => mid)],
      ['b', fakeTool('b', async () => Promise.reject(new Error('boom')))],
    ]);
    const runtime = createPipelineRuntime((id) => tools.get(id));
    const steps = [
      { toolId: 'a', options: {} },
      { toolId: 'b', options: {} },
    ];
    await expect(runtime.run(input, { steps }, ctx())).rejects.toThrow('boom');
    expect(mid.close).toHaveBeenCalledOnce();
    expect(input.close).not.toHaveBeenCalled();
  });

  it('is registered on both sides and cannot run itself', () => {
    const runtime = getToolRuntimeById('pipeline')!;
    expect(getToolUIById('pipeline')?.category).toBe('automate');
    expect(runtime.validate({ steps: [{ toolId: 'pipeline', options: { steps: [] } }] })).toEqual([
      'tools.pipeline.errors.unknownTool',
    ]);
  });

  it('builds a job pipeline whose output comes from the chained steps', () => {
    const pipeline = buildPipeline('pipeline', {
      steps: [
        { toolId: 'resize', options: getToolRuntimeById('resize')!.defaults },
        {
          toolId: 'convert',
          options: { ...getToolRuntimeById('convert')!.defaults, format: 'webp' },
        },
      ],
    });
    expect(pipeline.steps).toHaveLength(1);
    expect(pipeline.output.format).toBe('webp');
  });
});

describe('preset store', () => {
  it('lists newest first, skips junk and removes', async () => {
    kv.clear();
    const { createPresetStore } =
      await vi.importActual<typeof import('./presetStore.ts')>('./presetStore.ts');
    const store = createPresetStore({} as never);
    const mk = (id: string, createdAt: number): Preset => ({ id, name: id, steps: [], createdAt });
    await store.save(mk('old', 1));
    await store.save(mk('new', 2));
    kv.set('junk', { nope: true });
    expect((await store.list()).map((p) => p.id)).toEqual(['new', 'old']);
    await store.remove('new');
    expect((await store.list()).map((p) => p.id)).toEqual(['old']);
  });
});

describe('pipeline panel', () => {
  const saved: Preset[] = [];
  const store: PresetStore = {
    list: async () => [...saved],
    save: async (p) => void saved.push(p),
    remove: async (id) => void saved.splice(0, saved.length, ...saved.filter((p) => p.id !== id)),
  };

  beforeEach(() => {
    saved.length = 0;
    vi.mocked(getBrowserPresetStore).mockReturnValue(store);
  });

  const view = (value: { steps: { toolId: string; options: unknown }[] }, onChange = vi.fn()) => {
    render(
      <LocaleContext.Provider value="en">
        <Suspense fallback={null}>
          <Panel value={value} onChange={onChange} />
        </Suspense>
      </LocaleContext.Provider>,
    );
    return onChange;
  };

  it('adds a step with the tool defaults', () => {
    const onChange = view({ steps: [] });
    fireEvent.change(screen.getByLabelText('Add a step'), { target: { value: 'strip-metadata' } });
    expect(onChange).toHaveBeenCalledWith({
      steps: [
        { toolId: 'strip-metadata', options: getToolRuntimeById('strip-metadata')!.defaults },
      ],
    });
  });

  it('does not offer the pipeline tool as a step', () => {
    view({ steps: [] });
    expect(screen.queryByRole('option', { name: 'Pipelines' })).toBeNull();
  });

  it('reorders and removes steps', () => {
    const steps = [
      { toolId: 'strip-metadata', options: { quality: 90 } },
      { toolId: 'strip-metadata', options: { quality: 80 } },
    ];
    const onChange = view({ steps });
    fireEvent.click(screen.getAllByLabelText(/Move down/)[0]!);
    expect(onChange).toHaveBeenCalledWith({ steps: [steps[1], steps[0]] });
    fireEvent.click(screen.getAllByLabelText(/Remove step/)[0]!);
    expect(onChange).toHaveBeenLastCalledWith({ steps: [steps[1]] });
  });

  it('saves a preset and loads it back', async () => {
    const steps = [{ toolId: 'strip-metadata', options: { quality: 90 } }];
    const onChange = view({ steps });
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'For web' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ name: 'For web', steps });
    fireEvent.click(await screen.findByRole('button', { name: /Load: For web/ }));
    expect(onChange).toHaveBeenCalledWith({ steps });
  });

  it('drops preset steps whose tool no longer exists', async () => {
    saved.push({ id: '1', name: 'Old', createdAt: 1, steps: [{ toolId: 'gone', options: {} }] });
    const onChange = view({ steps: [] });
    fireEvent.click(await screen.findByRole('button', { name: /Load: Old/ }));
    expect(onChange).toHaveBeenCalledWith({ steps: [] });
  });

  it('keeps working when storage is blocked', async () => {
    vi.spyOn(store, 'list').mockRejectedValue(new Error('blocked'));
    view({ steps: [] });
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked saving presets/);
  });
});
