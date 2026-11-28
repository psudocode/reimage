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

const opts = (patch: Partial<CropOptions>): CropOptions => ({ ...cropDefaults, ...patch });
const src = { width: 2000, height: 1000 };

describe('crop validation', () => {
  it('accepts the defaults', () => {
    expect(validateCrop(cropDefaults)).toEqual([]);
  });

  it('checks the custom ratio', () => {
    const base = opts({ ratio: 'custom' });
    expect(validateCrop(base)).toEqual([]);
    expect(validateCrop({ ...base, customWidth: 0 })).toEqual(['tools.crop.errors.customRatio']);
    expect(validateCrop({ ...base, customHeight: 1.5 })).toEqual(['tools.crop.errors.customRatio']);
    expect(validateCrop({ ...base, customWidth: Number.NaN })).toEqual([
      'tools.crop.errors.customRatio',
    ]);
  });

  it('rejects an unknown ratio, mode or position', () => {
    expect(validateCrop(opts({ ratio: 'x' as never }))).toEqual(['tools.crop.errors.ratio']);
    expect(validateCrop(opts({ mode: 'x' as never }))).toEqual(['tools.crop.errors.mode']);
    expect(validateCrop(opts({ positionX: 101 }))).toEqual(['tools.crop.errors.position']);
  });

  it('needs part of the image to remain in free mode', () => {
    const free = opts({ mode: 'free' });
    expect(validateCrop(free)).toEqual([]);
    expect(validateCrop({ ...free, left: 50, right: 49 })).toEqual([]);
    expect(validateCrop({ ...free, left: 50, right: 50 })).toEqual(['tools.crop.errors.edges']);
    expect(validateCrop({ ...free, top: -1 })).toEqual(['tools.crop.errors.edges']);
    expect(validateCrop({ ...free, bottom: Number.NaN })).toEqual(['tools.crop.errors.edges']);
  });
});

describe('computeCropRect', () => {
  it('takes the largest centred box of the ratio', () => {
    expect(computeCropRect(src, opts({ ratio: '1:1' }))).toEqual({
      x: 500,
      y: 0,
      width: 1000,
      height: 1000,
    });
    expect(computeCropRect(src, opts({ ratio: '9:16' }))).toEqual({
      x: 719,
      y: 0,
      width: 563,
      height: 1000,
    });
  });

  it('keeps the whole image when it already has the ratio', () => {
    expect(
      computeCropRect(src, opts({ ratio: 'custom', customWidth: 2, customHeight: 1 })),
    ).toEqual({
      x: 0,
      y: 0,
      width: 2000,
      height: 1000,
    });
  });

  it('moves the box with the position', () => {
    expect(computeCropRect(src, opts({ positionX: 0 })).x).toBe(0);
    expect(computeCropRect(src, opts({ positionX: 100 })).x).toBe(1000);
    const tall = { width: 1000, height: 2000 };
    expect(computeCropRect(tall, opts({ positionY: 100 }))).toMatchObject({
      y: 1000,
      height: 1000,
    });
  });

  it('trims the edges by percent in free mode', () => {
    const rect = computeCropRect(
      src,
      opts({ mode: 'free', left: 10, right: 20, top: 5, bottom: 5 }),
    );
    expect(rect).toEqual({ x: 200, y: 50, width: 1400, height: 900 });
  });

  it('never returns an empty or out-of-bounds rect', () => {
    const tiny = { width: 3, height: 2 };
    const rect = computeCropRect(
      tiny,
      opts({ mode: 'free', left: 99, right: 0, top: 0, bottom: 99 }),
    );
    expect(rect.width).toBeGreaterThanOrEqual(1);
    expect(rect.height).toBeGreaterThanOrEqual(1);
    expect(rect.x + rect.width).toBeLessThanOrEqual(tiny.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(tiny.height);
  });
});

describe('crop tool plugin', () => {
  const bitmap = (width: number, height: number) =>
    ({ width, height, close: vi.fn() }) as unknown as ImageBitmap;
  const setup = (aborted = false) => {
    const output = bitmap(0, 0);
    const drawImage = vi.fn();
    const canvas = { getContext: () => ({ drawImage }), transferToImageBitmap: () => output };
    const controller = new AbortController();
    if (aborted) controller.abort();
    const ctx = {
      signal: controller.signal,
      progress: vi.fn(),
      createCanvas: vi.fn(() => canvas as unknown as OffscreenCanvas),
      maxPixels: 100_000_000,
    };
    return { output, drawImage, ctx };
  };

  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('crop')).toBe(cropRuntime);
    expect(getToolUIById('crop')).toBe(cropUI);
  });

  it('copies the region to a canvas of that size', async () => {
    const { output, drawImage, ctx } = setup();
    const input = bitmap(2000, 1000);
    const result = await cropRuntime.run(input, cropDefaults, ctx);
    expect(result).toBe(output);
    expect(ctx.createCanvas).toHaveBeenCalledWith(1000, 1000);
    expect(drawImage).toHaveBeenCalledWith(input, 500, 0, 1000, 1000, 0, 0, 1000, 1000);
    expect(ctx.progress).toHaveBeenCalledWith(1);
  });

  it('returns the input when nothing is cropped', async () => {
    const { ctx } = setup();
    const input = bitmap(1000, 1000);
    expect(await cropRuntime.run(input, cropDefaults, ctx)).toBe(input);
    expect(ctx.createCanvas).not.toHaveBeenCalled();
  });

  it('stops when cancelled', async () => {
    const { ctx } = setup(true);
    await expect(cropRuntime.run(bitmap(2000, 1000), cropDefaults, ctx)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

function Harness({ initial = cropDefaults }: { initial?: CropOptions }) {
  const [value, setValue] = useState(initial);
  return <Panel value={value} onChange={setValue} />;
}

describe('crop panel', () => {
  it('picks a ratio', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: '1:1' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '16:9' }));
    expect(screen.getByRole('radio', { name: '16:9' })).toBeChecked();
  });

  it('shows custom ratio fields and flags bad values', () => {
    render(<Harness />);
    expect(screen.queryByLabelText('Ratio width')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Ratio width'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent('whole numbers');
    fireEvent.change(screen.getByLabelText('Ratio width'), { target: { value: '5' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves the position slider', () => {
    render(<Harness />);
    const slider = screen.getByLabelText(/Horizontal position/);
    fireEvent.change(slider, { target: { value: '20' } });
    expect(slider).toHaveValue('20');
  });

  it('trims edges in free mode and shows errors', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Free' }));
    fireEvent.change(screen.getByLabelText('Trim left (%)'), { target: { value: '60' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Trim right (%)'), { target: { value: '60' } });
    expect(screen.getByRole('alert')).toHaveTextContent('opposite edges');
  });

  it('is translated', () => {
    render(
      <LocaleContext.Provider value="id">
        <Harness />
      </LocaleContext.Provider>,
    );
    expect(screen.getByRole('radio', { name: 'Bebas' })).toBeInTheDocument();
  });

  it('loads lazily through the tool plugin', async () => {
    const Lazy = cropUI.Panel;
    render(
      <Suspense fallback={<span>loading</span>}>
        <Lazy value={cropDefaults} onChange={() => {}} />
      </Suspense>,
    );
    expect(await screen.findByRole('radio', { name: 'Fixed ratio' })).toBeInTheDocument();
  });
});
