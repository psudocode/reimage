import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageResult } from '../../core/pipeline/types.ts';
import type { WorkspaceItem } from '../workspace/state.ts';
import { PREVIEW_DEBOUNCE_MS, usePreview, type PreviewApi } from './usePreview.ts';

const item = (id: string): WorkspaceItem => ({
  id,
  file: new File(['x'], `${id}.jpg`, { type: 'image/jpeg' }),
  name: `${id}.jpg`,
  size: 4000,
  previewUrl: `blob:orig-${id}`,
  status: 'ready',
  progress: 0,
});

const result = (bytes: number, scale = 0.5): ImageResult => ({
  imageId: 'a',
  blob: new Blob(['x']),
  width: 100,
  height: 50,
  bytesBefore: 4000,
  bytesAfter: bytes,
  ms: 1,
  previewScale: scale,
});

function makeApi() {
  const calls: Array<{ resolve(r: ImageResult): void; reject(e: Error): void; pipeline: unknown }> =
    [];
  let urls = 0;
  const revoked: string[] = [];
  const api: PreviewApi = {
    render: vi.fn(
      (request) =>
        new Promise<ImageResult>((resolve, reject) => {
          calls.push({ resolve, reject, pipeline: request.pipeline });
        }),
    ),
    createObjectURL: () => `blob:preview-${(urls += 1)}`,
    revokeObjectURL: (url) => revoked.push(url),
  };
  return { api, calls, revoked };
}

const compressOptions = { mode: 'quality', quality: 60, targetKb: 200 };

describe('usePreview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for the options to settle, then renders once and scales the estimate', async () => {
    const { api, calls } = makeApi();
    const first = item('a');
    const { result: hook, rerender } = renderHook((props) => usePreview(props), {
      initialProps: {
        api,
        item: first,
        toolId: 'compress',
        options: compressOptions,
        enabled: true,
      },
    });
    expect(hook.current.status).toBe('loading');

    // Typing again resets the debounce: still no render.
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 10));
    rerender({
      api,
      item: first,
      toolId: 'compress',
      options: { ...compressOptions, quality: 50 },
      enabled: true,
    });
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 10));
    expect(api.render).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(20));
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(calls[0]!.pipeline).toMatchObject({ steps: [{ toolId: 'compress' }] });

    await act(async () => calls[0]!.resolve(result(1000, 0.5)));
    expect(hook.current).toMatchObject({
      status: 'ready',
      url: 'blob:preview-1',
      estimate: { bytes: 4000, width: 200, height: 100 },
    });
  });

  it('drops an answer that arrives after newer options and frees replaced URLs', async () => {
    const { api, calls, revoked } = makeApi();
    const first = item('a');
    const { result: hook, rerender } = renderHook((props) => usePreview(props), {
      initialProps: {
        api,
        item: first,
        toolId: 'compress',
        options: compressOptions,
        enabled: true,
      },
    });
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));
    const next = { ...compressOptions, quality: 20 };
    rerender({ api, item: first, toolId: 'compress', options: next, enabled: true });
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));

    await act(async () => calls[1]!.resolve(result(500)));
    await act(async () => calls[0]!.resolve(result(9999)));
    expect(hook.current.estimate?.bytes).toBe(2000);
    expect(hook.current.url).toBe('blob:preview-1');

    // A later preview replaces and revokes the previous URL.
    rerender({
      api,
      item: first,
      toolId: 'compress',
      options: { ...next, quality: 10 },
      enabled: true,
    });
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));
    await act(async () => calls[2]!.resolve(result(300)));
    expect(revoked).toEqual(['blob:preview-1']);
  });

  it('reports a failure and keeps the last good preview', async () => {
    const { api, calls } = makeApi();
    const first = item('a');
    const { result: hook, rerender } = renderHook((props) => usePreview(props), {
      initialProps: {
        api,
        item: first,
        toolId: 'compress',
        options: compressOptions,
        enabled: true,
      },
    });
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));
    await act(async () => calls[0]!.resolve(result(500)));
    rerender({
      api,
      item: first,
      toolId: 'compress',
      options: { ...compressOptions, quality: 5 },
      enabled: true,
    });
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));
    await act(async () => calls[1]!.reject(new Error('Cannot decode')));
    expect(hook.current).toMatchObject({
      status: 'error',
      error: 'Cannot decode',
      url: 'blob:preview-1',
    });
  });

  it('does nothing while disabled or without an image', () => {
    const { api } = makeApi();
    const { result: hook, rerender } = renderHook((props) => usePreview(props), {
      initialProps: {
        api,
        item: item('a') as WorkspaceItem | undefined,
        toolId: 'compress',
        options: compressOptions,
        enabled: false,
      },
    });
    act(() => vi.advanceTimersByTime(1000));
    rerender({ api, item: undefined, toolId: 'compress', options: compressOptions, enabled: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(api.render).not.toHaveBeenCalled();
    expect(hook.current.status).toBe('idle');
  });

  it('forgets the preview when another image is selected and frees its URL on unmount', async () => {
    const { api, calls, revoked } = makeApi();
    const {
      result: hook,
      rerender,
      unmount,
    } = renderHook((props) => usePreview(props), {
      initialProps: {
        api,
        item: item('a'),
        toolId: 'compress',
        options: compressOptions,
        enabled: true,
      },
    });
    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));
    await act(async () => calls[0]!.resolve(result(500)));

    rerender({ api, item: item('b'), toolId: 'compress', options: compressOptions, enabled: true });
    expect(revoked).toEqual(['blob:preview-1']);
    expect(hook.current.url).toBeUndefined();

    act(() => vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS));
    await act(async () => calls[1]!.resolve(result(400)));
    unmount();
    expect(revoked).toEqual(['blob:preview-1', 'blob:preview-2']);
  });
});
