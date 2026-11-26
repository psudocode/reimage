import { describe, expect, it, vi } from 'vitest';
import { createCodecRegistry, type CodecFactories } from './index.ts';
import { lazyModule } from './lazy.ts';
import type { Codec } from './types.ts';

describe('lazyModule', () => {
  it('does not import until first use, then imports exactly once', async () => {
    const importer = vi.fn(async () => ({ value: 1 }));
    const load = lazyModule(importer);
    expect(importer).not.toHaveBeenCalled();

    const [a, b] = await Promise.all([load(), load()]);
    await load();
    expect(importer).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('runs the init hook once, before the module is handed out', async () => {
    const order: string[] = [];
    const init = vi.fn(async () => {
      order.push('init');
    });
    const load = lazyModule(async () => {
      order.push('import');
      return {};
    }, init);
    await load();
    await load();
    expect(order).toEqual(['import', 'init']);
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed import, so a later call can retry', async () => {
    const importer = vi
      .fn<() => Promise<{ ok: true }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true });
    const load = lazyModule(importer);

    await expect(load()).rejects.toThrow('offline');
    await expect(load()).resolves.toEqual({ ok: true });
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed init either', async () => {
    const init = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('wasm fetch failed'))
      .mockResolvedValueOnce(undefined);
    const load = lazyModule(async () => ({}), init);
    await expect(load()).rejects.toThrow('wasm fetch failed');
    await expect(load()).resolves.toEqual({});
  });
});

describe('createCodecRegistry', () => {
  const fake = (id: Codec['id']) => ({ id }) as Codec;

  it('creates nothing up front and only the requested codec on demand', () => {
    const factories = {
      jpeg: vi.fn(() => fake('jpeg')),
      png: vi.fn(() => fake('png')),
      webp: vi.fn(() => fake('webp')),
      avif: vi.fn(() => fake('avif')),
    } satisfies CodecFactories;
    const registry = createCodecRegistry(factories);

    expect(Object.values(factories).every((factory) => factory.mock.calls.length === 0)).toBe(true);
    const first = registry.get('webp');
    expect(registry.get('webp')).toBe(first);
    expect(factories.webp).toHaveBeenCalledTimes(1);
    expect(factories.jpeg).not.toHaveBeenCalled();
    expect(factories.avif).not.toHaveBeenCalled();
  });
});
