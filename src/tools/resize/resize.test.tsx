import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import {
  computeTargetSize,
  resizeDefaults,
  validateResize,
  type ResizeOptions,
} from './options.ts';
import Panel from './Panel.tsx';
import { resizeRuntime } from './runtime.ts';
import { resizeUI } from './ui.ts';

const resampleBitmap = vi.hoisted(() => vi.fn());
vi.mock('../../core/image/resample.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/image/resample.ts')>()),
  resampleBitmap,
}));

const BIG = 100_000_000;
const src = { width: 2000, height: 1000 };
const opts = (patch: Partial<ResizeOptions>): ResizeOptions => ({ ...resizeDefaults, ...patch });

describe('resize validation', () => {
  it('accepts the defaults', () => {
    expect(validateResize(resizeDefaults)).toEqual([]);
  });

  it.each([0, 1001, -5, Number.NaN])('rejects percent %s', (percent) => {
    expect(validateResize(opts({ percent }))).toEqual(['tools.resize.errors.percent']);
  });

  it('needs one side when the ratio is kept, both when it is not', () => {
    const base = opts({ mode: 'pixels' });
    expect(validateResize({ ...base, keepAspect: true })).toEqual([
      'tools.resize.errors.sizeLocked',
    ]);
    expect(validateResize({ ...base, keepAspect: true, width: 800 })).toEqual([]);
    expect(validateResize({ ...base, keepAspect: false, width: 800 })).toEqual([
      'tools.resize.errors.size',
    ]);
    expect(validateResize({ ...base, keepAspect: false, width: 800, height: 600 })).toEqual([]);
  });

  it.each([0, 1.5, 16385, Number.NaN])('rejects side %s', (width) => {
    expect(validateResize(opts({ mode: 'pixels', width }))).not.toEqual([]);
  });

  it('rejects an unknown preset or mode', () => {
    expect(validateResize(opts({ mode: 'preset', preset: 'x' as never }))).toEqual([
      'tools.resize.errors.preset',
    ]);
    expect(validateResize(opts({ mode: 'x' as never }))).not.toEqual([]);
  });
});

describe('computeTargetSize', () => {
  it('scales by percent', () => {
    expect(computeTargetSize(src, opts({ percent: 50 }), BIG)).toEqual({
      width: 1000,
      height: 500,
    });
    expect(computeTargetSize(src, opts({ percent: 200 }), BIG)).toEqual({
      width: 4000,
      height: 2000,
    });
  });

  it('follows one side and keeps the ratio', () => {
    const o = opts({ mode: 'pixels', width: 500 });
    expect(computeTargetSize(src, o, BIG)).toEqual({ width: 500, height: 250 });
    expect(computeTargetSize(src, opts({ mode: 'pixels', height: 100 }), BIG)).toEqual({
      width: 200,
      height: 100,
    });
  });

  it('fits inside the box when both sides are given and the ratio is kept', () => {
    const o = opts({ mode: 'pixels', width: 500, height: 500 });
    expect(computeTargetSize(src, o, BIG)).toEqual({ width: 500, height: 250 });
  });

  it('stretches to the exact size when the ratio is not kept', () => {
    const o = opts({ mode: 'pixels', keepAspect: false, width: 300, height: 700 });
    expect(computeTargetSize(src, o, BIG)).toEqual({ width: 300, height: 700 });
  });

  it('fits presets without enlarging', () => {
    expect(computeTargetSize(src, opts({ mode: 'preset', preset: 'hd' }), BIG)).toEqual({
      width: 1280,
      height: 640,
    });
    const small = { width: 400, height: 300 };
    expect(computeTargetSize(small, opts({ mode: 'preset', preset: 'fhd' }), BIG)).toEqual(small);
  });

  it('applies the memory guard', () => {
    const target = computeTargetSize(src, opts({ percent: 1000 }), 1_000_000);
    expect(target.width * target.height).toBeLessThanOrEqual(1_000_000);
    expect(target.width / target.height).toBeCloseTo(2, 1);
  });
});

describe('resize tool plugin', () => {
  const bitmap = (width: number, height: number) =>
    ({ width, height, close: vi.fn() }) as unknown as ImageBitmap;
  const ctx = () => ({
    signal: new AbortController().signal,
    progress: vi.fn(),
    createCanvas: vi.fn(),
    maxPixels: BIG,
  });

  beforeEach(() => resampleBitmap.mockReset());

  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('resize')).toBe(resizeRuntime);
    expect(getToolUIById('resize')).toBe(resizeUI);
  });

  it('resamples to the target size with Lanczos3', async () => {
    const output = bitmap(1000, 500);
    resampleBitmap.mockResolvedValue(output);
    const context = ctx();
    const result = await resizeRuntime.run(bitmap(2000, 1000), resizeDefaults, context);
    expect(result).toBe(output);
    expect(resampleBitmap).toHaveBeenCalledWith(expect.anything(), 1000, 500, {
      filter: 'lanczos3',
      signal: context.signal,
    });
    expect(context.progress).toHaveBeenCalledWith(1);
  });

  it('returns the input when the size would not change', async () => {
    const input = bitmap(2000, 1000);
    const result = await resizeRuntime.run(input, opts({ percent: 100 }), ctx());
    expect(result).toBe(input);
    expect(resampleBitmap).not.toHaveBeenCalled();
  });
});

function Harness({ initial = resizeDefaults }: { initial?: ResizeOptions }) {
  const [value, setValue] = useState(initial);
  return <Panel value={value} onChange={setValue} />;
}

describe('resize panel', () => {
  it('starts in percent mode and edits the value', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Scale (%)');
    fireEvent.change(input, { target: { value: '25' } });
    expect(input).toHaveValue(25);
  });

  it('switches to pixels, parses empty as unset and shows errors', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Pixels' }));
    expect(screen.getByRole('alert')).toHaveTextContent('width or height');
    fireEvent.change(screen.getByLabelText('Width (px)'), { target: { value: '800' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep aspect ratio' }));
    expect(screen.getByRole('alert')).toHaveTextContent('width and height');
  });

  it('picks a preset', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Preset' }));
    fireEvent.click(screen.getByRole('radio', { name: /^HD/ }));
    expect(screen.getByRole('radio', { name: /^HD/ })).toBeChecked();
    expect(screen.getByText('1280 × 720')).toBeInTheDocument();
  });

  it('is translated', () => {
    render(
      <LocaleContext.Provider value="id">
        <Harness />
      </LocaleContext.Provider>,
    );
    expect(screen.getByLabelText('Skala (%)')).toBeInTheDocument();
  });

  it('loads lazily through the tool plugin', async () => {
    const Lazy = resizeUI.Panel;
    render(
      <Suspense fallback={<span>loading</span>}>
        <Lazy value={resizeDefaults} onChange={() => {}} />
      </Suspense>,
    );
    expect(await screen.findByLabelText('Scale (%)')).toBeInTheDocument();
  });
});
