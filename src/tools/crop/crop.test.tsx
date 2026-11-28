import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import { computeCropRect, cropDefaults, validateCrop, type CropOptions } from './options.ts';
import Panel from './Panel.tsx';
import { cropRuntime } from './runtime.ts';
import { cropUI } from './ui.ts';

const BIG = 100_000_000;
const src = { width: 2000, height: 1000 };
const opts = (patch: Partial<CropOptions>): CropOptions => ({ ...cropDefaults, ...patch });

describe('crop validation', () => {
  it('accepts the defaults', () => {
    expect(validateCrop(cropDefaults)).toEqual([]);
  });

  it('checks the free box stays inside the image', () => {
    const free = opts({ mode: 'free' });
    expect(validateCrop({ ...free, left: 10, top: 10, width: 50, height: 50 })).toEqual([]);
    expect(validateCrop({ ...free, left: 60, width: 50 })).toEqual(['tools.crop.errors.box']);
    expect(validateCrop({ ...free, width: 0 })).toEqual(['tools.crop.errors.box']);
    expect(validateCrop({ ...free, height: Number.NaN })).toEqual(['tools.crop.errors.box']);
  });

  it('checks the ratio and the position', () => {
    expect(validateCrop(opts({ ratio: 'x' as never }))).toEqual(['tools.crop.errors.ratio']);
    expect(validateCrop(opts({ ratio: 'custom', ratioWidth: 0 }))).toEqual([
      'tools.crop.errors.ratio',
    ]);
    expect(validateCrop(opts({ ratio: 'custom', ratioWidth: 5, ratioHeight: 2 }))).toEqual([]);
    expect(validateCrop(opts({ offsetX: 101 }))).toEqual(['tools.crop.errors.offset']);
    expect(validateCrop(opts({ mode: 'x' as never }))).not.toEqual([]);
  });
});

describe('computeCropRect', () => {
  it('crops the largest centred square from a landscape image', () => {
    expect(computeCropRect(src, opts({}))).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it('crops a portrait ratio from a landscape image', () => {
    const rect = computeCropRect(src, opts({ ratio: '9:16' }));
    expect(rect).toEqual({ x: 719, y: 0, width: 563, height: 1000 });
  });

  it('crops height when the image is wider than tall in ratio terms', () => {
    const tall = { width: 1000, height: 2000 };
    expect(computeCropRect(tall, opts({ ratio: '16:9' }))).toEqual({
      x: 0,
      y: 719,
      width: 1000,
      height: 563,
    });
  });

  it('moves the box with the position', () => {
    expect(computeCropRect(src, opts({ offsetX: 0 })).x).toBe(0);
    expect(computeCropRect(src, opts({ offsetX: 100 })).x).toBe(1000);
  });

  it('supports a custom ratio', () => {
    const rect = computeCropRect(src, opts({ ratio: 'custom', ratioWidth: 2, ratioHeight: 1 }));
    expect(rect).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
  });

  it('turns a free box in percent into pixels', () => {
    const o = opts({ mode: 'free', left: 10, top: 20, width: 50, height: 30 });
    expect(computeCropRect(src, o)).toEqual({ x: 200, y: 200, width: 1000, height: 300 });
  });

  it('never leaves the image or goes below 1px', () => {
    const tiny = { width: 3, height: 3 };
    const o = opts({ mode: 'free', left: 99, top: 99, width: 1, height: 1 });
    expect(computeCropRect(tiny, o)).toEqual({ x: 2, y: 2, width: 1, height: 1 });
  });
});

describe('crop tool plugin', () => {
  const bitmap = (width: number, height: number) =>
    ({ width, height, close: vi.fn() }) as unknown as ImageBitmap;
  const setup = (maxPixels = BIG) => {
    const output = bitmap(0, 0);
    const drawImage = vi.fn();
    const canvas = { getContext: () => ({ drawImage }), transferToImageBitmap: () => output };
    const ctx = {
      signal: new AbortController().signal,
      progress: vi.fn(),
      createCanvas: vi.fn(() => canvas as unknown as OffscreenCanvas),
      maxPixels,
    };
    return { output, drawImage, ctx };
  };

  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('crop')).toBe(cropRuntime);
    expect(getToolUIById('crop')).toBe(cropUI);
  });

  it('copies the crop rectangle onto a canvas of that size', async () => {
    const { output, drawImage, ctx } = setup();
    const input = bitmap(2000, 1000);
    expect(await cropRuntime.run(input, cropDefaults, ctx)).toBe(output);
    expect(ctx.createCanvas).toHaveBeenCalledWith(1000, 1000);
    expect(drawImage).toHaveBeenCalledWith(input, 500, 0, 1000, 1000, 0, 0, 1000, 1000);
    expect(ctx.progress).toHaveBeenCalledWith(1);
  });

  it('returns the input when nothing is cut', async () => {
    const { ctx } = setup();
    const input = bitmap(1000, 1000);
    expect(await cropRuntime.run(input, cropDefaults, ctx)).toBe(input);
    expect(ctx.createCanvas).not.toHaveBeenCalled();
  });

  it('applies the memory guard', async () => {
    const { ctx } = setup(250_000);
    await cropRuntime.run(bitmap(2000, 1000), cropDefaults, ctx);
    const [w, h] = ctx.createCanvas.mock.calls[0] as unknown as [number, number];
    expect(w * h).toBeLessThanOrEqual(250_000);
  });
});

describe('crop panel', () => {
  function Harness({ onValue }: { onValue: (value: CropOptions) => void }) {
    const [value, setValue] = useState(cropDefaults);
    return (
      <LocaleContext.Provider value="en">
        <Suspense fallback={null}>
          <Panel
            value={value}
            onChange={(next) => {
              setValue(next);
              onValue(next);
            }}
          />
        </Suspense>
      </LocaleContext.Provider>
    );
  }

  it('picks a ratio and shows custom fields', () => {
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    fireEvent.click(screen.getByRole('radio', { name: '16:9' }));
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ ratio: '16:9' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Ratio width'), { target: { value: '5' } });
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ ratioWidth: 5 }));
  });

  it('edits a free box and reports errors', () => {
    const seen = vi.fn();
    render(<Harness onValue={seen} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Free box' }));
    fireEvent.change(screen.getByLabelText('Left (%)'), { target: { value: '60' } });
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'free', left: 60 }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
