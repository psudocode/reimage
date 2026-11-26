import { describe, expect, it } from 'vitest';
import {
  getRegisteredRuntimes,
  getSupportedRuntimes,
  getToolRuntimeById,
} from './runtimeRegistry.ts';
import { getRegisteredUIs, getToolUIById } from './uiRegistry.ts';
import type { Env } from '../core/pipeline/types.ts';

const env: Env = {
  offscreenCanvas: true,
  avifDecode: true,
  heicDecode: false,
  wasmSimd: true,
  deviceMemory: 8,
};

describe('tool registries', () => {
  it('have unique, kebab-case ids', () => {
    for (const list of [getRegisteredRuntimes(), getRegisteredUIs()]) {
      const ids = list.map((tool) => tool.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    }
  });

  it('register the same tools on the worker side and the UI side', () => {
    const runtimeIds = getRegisteredRuntimes().map((tool) => tool.id);
    const uiIds = getRegisteredUIs().map((tool) => tool.id);
    expect(uiIds).toEqual(runtimeIds);
  });

  it('look tools up by id on each side', () => {
    expect(getToolRuntimeById('nope')).toBeUndefined();
    expect(getToolUIById('nope')).toBeUndefined();
    for (const { id } of getRegisteredRuntimes()) {
      expect(getToolRuntimeById(id)?.id).toBe(id);
      expect(getToolUIById(id)?.id).toBe(id);
    }
  });

  it('only list runtimes the environment supports', () => {
    expect(getSupportedRuntimes(env).map((tool) => tool.id)).toEqual(
      getRegisteredRuntimes().map((tool) => tool.id),
    );
  });

  it('give every UI an i18n label key that exists in both locales', async () => {
    const { translate } = await import('../i18n/index.ts');
    for (const ui of getRegisteredUIs()) {
      for (const locale of ['en', 'id'] as const) {
        expect(translate(locale, ui.labelKey)).not.toBe(ui.labelKey);
      }
    }
  });
});
