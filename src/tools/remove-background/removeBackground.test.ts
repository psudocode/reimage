import { afterEach, describe, expect, it, vi } from 'vitest';
import { maskToAlpha, rgbaToTensor } from './mask.ts';
import {
  MODEL_BYTES,
  MODEL_URL,
  ModelNotDownloadedError,
  downloadModel,
  isModelCached,
  readModel,
} from './model.ts';
import { toOutputSettings, validateRemoveBackground } from './options.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';

describe('rgbaToTensor', () => {
  it('writes planar RGB, normalised, ignoring alpha', () => {
    // pixel 0 = (128, 0, 255), pixel 1 = (255, 128, 0)
    const out = rgbaToTensor(new Uint8ClampedArray([128, 0, 255, 9, 255, 128, 0, 9]), 2);
    expect(Array.from(out)).toEqual([0, 127 / 256, -0.5, 0, 127 / 256, -0.5]);
  });
});

describe('maskToAlpha', () => {
  it('stretches the range to 0..255', () => {
    expect(Array.from(maskToAlpha([0.2, 0.4, 0.6], true))).toEqual([0, 128, 255]);
  });
  it('cuts hard at 50% when edges are not soft', () => {
    expect(Array.from(maskToAlpha([0, 0.4, 0.6, 1], false))).toEqual([0, 0, 255, 255]);
  });
  it('gives a flat mask no subject', () => {
    expect(Array.from(maskToAlpha([0.7, 0.7], true))).toEqual([0, 0]);
  });
});

describe('options', () => {
  it('is always valid and always outputs PNG', () => {
    expect(validateRemoveBackground()).toEqual([]);
    expect(toOutputSettings()).toEqual({ format: 'png' });
  });
  it('is registered as a worker runtime', () => {
    expect(getToolRuntimeById('remove-background')?.toOutput).toBe(toOutputSettings);
  });
});

function fakeCaches() {
  const store = new Map<string, Response>();
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (key: string) => store.get(key),
      put: async (key: string, value: Response) => void store.set(key, value),
    }),
    delete: async () => true,
  });
  return store;
}

function streamOf(bytes: number) {
  return new Response(new Uint8Array(bytes));
}

describe('model cache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports missing, and refuses to read a missing model', async () => {
    fakeCaches();
    expect(await isModelCached()).toBe(false);
    await expect(readModel()).rejects.toBeInstanceOf(ModelNotDownloadedError);
  });

  it('downloads the pinned URL, reports progress, then caches it', async () => {
    fakeCaches();
    const fetchMock = vi.fn(async () => streamOf(MODEL_BYTES));
    vi.stubGlobal('fetch', fetchMock);
    const progress = vi.fn();
    await downloadModel(progress);
    expect(fetchMock).toHaveBeenCalledWith(MODEL_URL, { signal: undefined });
    expect(progress).toHaveBeenLastCalledWith(1);
    expect(await isModelCached()).toBe(true);
    expect((await readModel()).byteLength).toBe(MODEL_BYTES);
  });

  it('does not cache a truncated download', async () => {
    fakeCaches();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamOf(1000)),
    );
    await expect(downloadModel(() => {})).rejects.toThrow(/incomplete/);
    expect(await isModelCached()).toBe(false);
  });

  it('pins the model to a commit, not a branch', () => {
    expect(MODEL_URL).toMatch(/\/resolve\/[0-9a-f]{40}\//);
  });
});
