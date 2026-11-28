import { createStore, del, entries, set, type UseStore } from 'idb-keyval';
import type { PipelineStep } from '../../core/pipeline/types.ts';

export interface Preset {
  id: string;
  name: string;
  steps: PipelineStep[];
  createdAt: number;
}

/** Presets live only in this browser's IndexedDB. Nothing is ever sent anywhere. */
export interface PresetStore {
  list(): Promise<Preset[]>;
  save(preset: Preset): Promise<void>;
  remove(id: string): Promise<void>;
}

function isPreset(value: unknown): value is Preset {
  if (typeof value !== 'object' || value === null) return false;
  const preset = value as Partial<Preset>;
  return (
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.createdAt === 'number' &&
    Array.isArray(preset.steps) &&
    preset.steps.every((step) => typeof step?.toolId === 'string')
  );
}

/** Newest first. Records that are not presets (older or hand-edited data) are skipped. */
export function createPresetStore(store: UseStore): PresetStore {
  return {
    async list() {
      const all = await entries(store);
      return all
        .map(([, value]) => value)
        .filter(isPreset)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    save: (preset) => set(preset.id, preset, store),
    remove: (id) => del(id, store),
  };
}

let browserStore: PresetStore | undefined;

/** Opened on first use, so nothing touches IndexedDB until the user opens Pipelines. */
export function getBrowserPresetStore(): PresetStore {
  browserStore ??= createPresetStore(createStore('reimage', 'presets'));
  return browserStore;
}
