import { describe, expect, it, vi } from 'vitest';
import type { ToolContext } from '../types.ts';
import { removeBackgroundRuntime } from './runtime.ts';

vi.mock('./session.ts', () => ({ infer: vi.fn() }));

const ctx = (patch: Partial<ToolContext> = {}): ToolContext => ({
  signal: new AbortController().signal,
  progress: () => {},
  createCanvas: () => {
    throw new Error('should not draw');
  },
  maxPixels: 100,
  ...patch,
});

const bitmap = (width: number, height: number) => ({ width, height }) as ImageBitmap;

describe('remove background runtime', () => {
  it('refuses an image over the memory guard before touching a canvas', async () => {
    await expect(
      removeBackgroundRuntime.run(bitmap(20, 20), { softEdges: true }, ctx()),
    ).rejects.toThrow(/too large/);
  });

  it('stops when cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      removeBackgroundRuntime.run(
        bitmap(2, 2),
        { softEdges: true },
        ctx({ signal: controller.signal }),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('is hidden without OffscreenCanvas', () => {
    const env = { offscreenCanvas: false } as Parameters<
      NonNullable<typeof removeBackgroundRuntime.supports>
    >[0];
    expect(removeBackgroundRuntime.supports?.(env)).toBe(false);
  });
});
