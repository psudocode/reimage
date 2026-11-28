import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import type { ToolContext } from '../types.ts';
import { computeMergeLayout, mergeDefaults, validateMerge, type MergeOptions } from './options.ts';
import Panel from './Panel.tsx';
import { mergeRuntime } from './runtime.ts';

const opts = (patch: Partial<MergeOptions>): MergeOptions => ({ ...mergeDefaults, ...patch });
const BIG = 50_000_000;

describe('merge validation', () => {
  it('accepts the defaults', () => {
    expect(validateMerge(mergeDefaults)).toEqual([]);
  });

  it('checks columns only for the grid', () => {
    expect(validateMerge(opts({ columns: 99 }))).toEqual([]);
    expect(validateMerge(opts({ layout: 'grid', columns: 99 }))).toEqual([
      'tools.merge.errors.columns',
    ]);
    expect(validateMerge(opts({ layout: 'grid', columns: 1 }))).toEqual([
      'tools.merge.errors.columns',
    ]);
    expect(validateMerge(opts({ layout: 'grid', columns: 3 }))).toEqual([]);
  });

  it('checks the gap, the background and the layout', () => {
    expect(validateMerge(opts({ gap: -1 }))).toEqual(['tools.merge.errors.gap']);
    expect(validateMerge(opts({ gap: 1.5 }))).toEqual(['tools.merge.errors.gap']);
    expect(validateMerge(opts({ gap: Number.NaN }))).toEqual(['tools.merge.errors.gap']);
    expect(validateMerge(opts({ background: 'red' }))).toEqual(['tools.merge.errors.background']);
    expect(validateMerge(opts({ background: 'transparent' }))).toEqual([]);
    expect(validateMerge(opts({ layout: 'x' as never }))).toEqual(['tools.merge.errors.layout']);
  });
});

describe('computeMergeLayout', () => {
  const a = { width: 400, height: 200 };
  const b = { width: 300, height: 400 };

  it('lines pictures up in a row at the smallest height, never enlarging', () => {
    const layout = computeMergeLayout([a, b], opts({ gap: 10 }), BIG);
    expect(layout.placements).toEqual([
      { x: 10, y: 10, width: 400, height: 200 },
      { x: 420, y: 10, width: 150, height: 200 },
    ]);
    expect(layout).toMatchObject({ width: 580, height: 220 });
  });

  it('stacks pictures at the smallest width', () => {
    const layout = computeMergeLayout([a, b], opts({ layout: 'vertical' }), BIG);
    expect(layout.placements).toEqual([
      { x: 0, y: 0, width: 300, height: 150 },
      { x: 0, y: 150, width: 300, height: 400 },
    ]);
    expect(layout).toMatchObject({ width: 300, height: 550 });
  });

  it('fills a grid row by row and centres pictures in their cell', () => {
    const layout = computeMergeLayout([a, b, a], opts({ layout: 'grid', columns: 2 }), BIG);
    // Cell = smallest width x smallest height = 300 x 200.
    expect(layout).toMatchObject({ width: 600, height: 400 });
    expect(layout.placements[0]).toEqual({ x: 0, y: 25, width: 300, height: 150 });
    expect(layout.placements[1]).toEqual({ x: 300 + 75, y: 0, width: 150, height: 200 });
    expect(layout.placements[2]).toEqual({ x: 0, y: 200 + 25, width: 300, height: 150 });
  });

  it('never uses more columns than pictures', () => {
    const layout = computeMergeLayout([a, a], opts({ layout: 'grid', columns: 6 }), BIG);
    expect(layout.width).toBe(800);
    expect(layout.height).toBe(200);
  });

  it('shrinks everything to stay inside the memory guard', () => {
    const wide = { width: 4000, height: 3000 };
    const layout = computeMergeLayout([wide, wide], opts({ gap: 40 }), 1_000_000);
    expect(layout.width * layout.height).toBeLessThanOrEqual(1_000_000);
    expect(layout.width).toBeGreaterThan(layout.height);
    for (const place of layout.placements) {
      expect(place.x + place.width).toBeLessThanOrEqual(layout.width);
      expect(place.y + place.height).toBeLessThanOrEqual(layout.height);
    }
  });
});

describe('merge runtime', () => {
  function makeCtx(overrides: Partial<ToolContext> = {}) {
    const calls: unknown[][] = [];
    const context = {
      fillStyle: '',
      imageSmoothingQuality: '',
      fillRect: vi.fn(),
      drawImage: vi.fn((...args: unknown[]) => calls.push(args)),
    };
    const out = { width: 0, height: 0 } as unknown as ImageBitmap;
    const created: Array<[number, number]> = [];
    const ctx: ToolContext = {
      signal: new AbortController().signal,
      progress: vi.fn(),
      createCanvas: (width, height) => {
        created.push([width, height]);
        return {
          getContext: () => context,
          transferToImageBitmap: () => out,
        } as unknown as OffscreenCanvas;
      },
      maxPixels: BIG,
      ...overrides,
    };
    return { ctx, context, calls, created, out };
  }

  const bitmap = (width: number, height: number) => ({ width, height }) as unknown as ImageBitmap;

  it('is registered as many-to-one on both sides', () => {
    expect(getToolRuntimeById('merge')?.kind).toBe('many-to-one');
    expect(getToolUIById('merge')?.id).toBe('merge');
  });

  it('draws every picture on one canvas filled with the background', async () => {
    const { ctx, context, calls, created, out } = makeCtx();
    const result = await mergeRuntime.runMany!(
      [bitmap(100, 50), bitmap(100, 50)],
      opts({ background: '#112233', gap: 5 }),
      ctx,
    );
    expect(result).toBe(out);
    expect(created).toEqual([[215, 60]]);
    expect(context.fillStyle).toBe('#112233');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 215, 60);
    expect(calls.map((call) => call.slice(1))).toEqual([
      [5, 5, 100, 50],
      [110, 5, 100, 50],
    ]);
    expect(ctx.progress).toHaveBeenLastCalledWith(1);
  });

  it('leaves a transparent background unpainted and writes PNG', async () => {
    const { ctx, context } = makeCtx();
    const options = opts({ background: 'transparent' });
    await mergeRuntime.runMany!([bitmap(10, 10), bitmap(10, 10)], options, ctx);
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(mergeRuntime.toOutput?.(options)).toEqual({ format: 'png' });
    expect(mergeRuntime.toOutput?.(mergeDefaults)).toEqual({});
  });

  it('needs two pictures and honours cancellation', async () => {
    const { ctx } = makeCtx();
    await expect(mergeRuntime.runMany!([bitmap(10, 10)], mergeDefaults, ctx)).rejects.toThrow(
      /at least two/,
    );
    const controller = new AbortController();
    controller.abort();
    const cancelled = makeCtx({ signal: controller.signal });
    await expect(
      mergeRuntime.runMany!([bitmap(10, 10), bitmap(10, 10)], mergeDefaults, cancelled.ctx),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('merge panel', () => {
  function Harness({ initial = mergeDefaults }: { initial?: MergeOptions }) {
    const [value, setValue] = useState(initial);
    return (
      <LocaleContext.Provider value="en">
        <Suspense fallback={null}>
          <Panel value={value} onChange={setValue} />
        </Suspense>
        <output data-testid="value">{JSON.stringify(value)}</output>
      </LocaleContext.Provider>
    );
  }
  const current = () => JSON.parse(screen.getByTestId('value').textContent!) as MergeOptions;

  it('switches layout and shows columns only for the grid', () => {
    render(<Harness />);
    expect(screen.queryByLabelText('Columns')).toBeNull();
    fireEvent.click(screen.getByLabelText('Grid'));
    expect(current().layout).toBe('grid');
    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '3' } });
    expect(current().columns).toBe(3);
  });

  it('sets the gap and flags a bad one', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Gap (px)'), { target: { value: '24' } });
    expect(current().gap).toBe(24);
    fireEvent.change(screen.getByLabelText('Gap (px)'), { target: { value: '500' } });
    expect(screen.getByRole('alert').textContent).toMatch(/0 to 200/);
  });

  it('toggles a transparent background and restores a colour', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Transparent background'));
    expect(current().background).toBe('transparent');
    expect(screen.getByLabelText('Background')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Transparent background'));
    expect(current().background).toBe(mergeDefaults.background);
  });
});
