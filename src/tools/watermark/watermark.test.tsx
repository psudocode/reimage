import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import {
  computeFontSize,
  computeLogoSize,
  placeWatermark,
  validateWatermark,
  watermarkDefaults,
  WATERMARK_POSITIONS,
  type WatermarkOptions,
} from './options.ts';
import Panel from './Panel.tsx';
import { watermarkRuntime } from './runtime.ts';
import { watermarkUI } from './ui.ts';

const opts = (patch: Partial<WatermarkOptions>): WatermarkOptions => ({
  ...watermarkDefaults,
  text: '© me',
  ...patch,
});
const png = new Blob(['x'], { type: 'image/png' });

describe('watermark validation', () => {
  it('needs text in text mode, and rejects blank or too long text', () => {
    expect(validateWatermark(watermarkDefaults)).toEqual(['tools.watermark.errors.text']);
    expect(validateWatermark(opts({ text: '   ' }))).toEqual(['tools.watermark.errors.text']);
    expect(validateWatermark(opts({ text: 'a'.repeat(201) }))).toEqual([
      'tools.watermark.errors.text',
    ]);
    expect(validateWatermark(opts({}))).toEqual([]);
  });

  it('needs an image file in image mode', () => {
    expect(validateWatermark(opts({ mode: 'image' }))).toEqual(['tools.watermark.errors.logo']);
    const text = new Blob(['x'], { type: 'text/plain' });
    expect(validateWatermark(opts({ mode: 'image', logo: text }))).not.toEqual([]);
    expect(validateWatermark(opts({ mode: 'image', logo: png }))).toEqual([]);
  });

  it('checks color, ranges, position and mode', () => {
    expect(validateWatermark(opts({ color: 'red' }))).toEqual(['tools.watermark.errors.color']);
    expect(validateWatermark(opts({ size: 0 }))).toEqual(['tools.watermark.errors.size']);
    expect(validateWatermark(opts({ opacity: 101 }))).toEqual(['tools.watermark.errors.opacity']);
    expect(validateWatermark(opts({ opacity: Number.NaN }))).not.toEqual([]);
    expect(validateWatermark(opts({ margin: 26 }))).toEqual(['tools.watermark.errors.margin']);
    expect(validateWatermark(opts({ position: 'x' as never }))).toEqual([
      'tools.watermark.errors.position',
    ]);
    expect(validateWatermark(opts({ mode: 'x' as never }))).toContain(
      'tools.watermark.errors.mode',
    );
  });
});

describe('placeWatermark', () => {
  const image = { width: 1000, height: 500 };
  const mark = { width: 100, height: 50 };
  // margin 10% of the shorter side (500) = 50px

  it.each([
    ['top-left', 50, 50],
    ['top-center', 450, 50],
    ['top-right', 850, 50],
    ['middle-left', 50, 225],
    ['center', 450, 225],
    ['middle-right', 850, 225],
    ['bottom-left', 50, 400],
    ['bottom-center', 450, 400],
    ['bottom-right', 850, 400],
  ] as const)('%s', (position, x, y) => {
    expect(placeWatermark(image, mark, position, 10)).toEqual({ x, y });
  });

  it('covers every position', () => {
    expect(WATERMARK_POSITIONS).toHaveLength(9);
  });

  it('never goes negative when the mark is bigger than the image', () => {
    expect(placeWatermark(image, { width: 2000, height: 900 }, 'bottom-right', 5)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('sizes', () => {
  it('scales the logo by image width and keeps its ratio', () => {
    expect(computeLogoSize({ width: 1000, height: 800 }, { width: 200, height: 100 }, 20)).toEqual({
      width: 200,
      height: 100,
    });
    expect(computeLogoSize({ width: 10, height: 10 }, { width: 1, height: 1000 }, 1)).toEqual({
      width: 1,
      height: 1000,
    });
  });

  it('derives the font size from the image width', () => {
    expect(computeFontSize(2000, 5)).toBe(100);
    expect(computeFontSize(10, 1)).toBe(1);
  });
});

describe('watermark runtime', () => {
  function fakeCanvas(textWidth = 100) {
    const context = {
      drawImage: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: textWidth })),
      font: '',
      fillStyle: '',
      globalAlpha: 1,
      textBaseline: '',
    };
    const output = {} as ImageBitmap;
    const canvas = {
      getContext: vi.fn(() => context),
      transferToImageBitmap: vi.fn(() => output),
    };
    return { context, output, canvas };
  }
  const input = { width: 1000, height: 500 } as ImageBitmap;
  const makeCtx = (canvas: unknown, signal = new AbortController().signal) => ({
    signal,
    progress: vi.fn(),
    createCanvas: vi.fn(() => canvas as OffscreenCanvas),
    maxPixels: 1e8,
  });

  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('watermark')).toBe(watermarkRuntime);
    expect(getToolUIById('watermark')).toBe(watermarkUI);
  });

  it('draws the image, then the text with the chosen opacity and color', async () => {
    const { context, output, canvas } = fakeCanvas();
    const ctx = makeCtx(canvas);
    const result = await watermarkRuntime.run(
      input,
      opts({ opacity: 40, color: '#ff0000', size: 10, margin: 0 }),
      ctx,
    );
    expect(result).toBe(output);
    expect(ctx.createCanvas).toHaveBeenCalledWith(1000, 500);
    expect(context.drawImage).toHaveBeenCalledWith(input, 0, 0);
    expect(context.globalAlpha).toBe(0.4);
    expect(context.fillStyle).toBe('#ff0000');
    expect(context.font).toContain('100px');
    // bottom-right, margin 0: x = 1000 - 100, y = 500 - 100
    expect(context.fillText).toHaveBeenCalledWith('© me', 900, 400);
    expect(ctx.progress).toHaveBeenCalledWith(1);
  });

  it('shrinks text that is wider than the image', async () => {
    const { context, canvas } = fakeCanvas(2000);
    await watermarkRuntime.run(input, opts({ size: 10 }), makeCtx(canvas));
    expect(context.font).toContain('50px');
  });

  it('draws a logo and closes it', async () => {
    const logo = { width: 200, height: 100, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(logo));
    const { context, canvas } = fakeCanvas();
    await watermarkRuntime.run(
      input,
      opts({ mode: 'image', logo: png, size: 20, margin: 0, position: 'top-left' }),
      makeCtx(canvas),
    );
    expect(context.drawImage).toHaveBeenLastCalledWith(logo, 0, 0, 200, 100);
    expect(logo.close).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('stops when cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const { canvas } = fakeCanvas();
    await expect(
      watermarkRuntime.run(input, opts({}), makeCtx(canvas, controller.signal)),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

function Harness({ initial = watermarkDefaults }: { initial?: WatermarkOptions }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Panel value={value} onChange={setValue} />
      <output data-testid="state">{JSON.stringify({ ...value, logo: value.logo?.type })}</output>
    </>
  );
}

describe('watermark panel', () => {
  it('edits text and shows an error until text is entered', () => {
    render(<Harness />);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a text');
    fireEvent.change(screen.getByLabelText('Watermark text'), { target: { value: 'hi' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('picks a position and changes opacity', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Top left' }));
    fireEvent.change(screen.getByLabelText('Opacity'), { target: { value: '30' } });
    const state = JSON.parse(screen.getByTestId('state').textContent!);
    expect(state).toMatchObject({ position: 'top-left', opacity: 30 });
  });

  it('switches to logo mode and takes a file', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Logo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('image file');
    fireEvent.change(screen.getByLabelText('Logo image'), {
      target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('state').textContent!).logo).toBe('image/png');
  });

  it('is translated', () => {
    render(
      <LocaleContext.Provider value="id">
        <Harness />
      </LocaleContext.Provider>,
    );
    expect(screen.getByLabelText('Teks watermark')).toBeInTheDocument();
  });

  it('loads lazily through the tool plugin', async () => {
    const Lazy = watermarkUI.Panel;
    render(
      <Suspense fallback={<span>loading</span>}>
        <Lazy value={watermarkDefaults} onChange={() => {}} />
      </Suspense>,
    );
    expect(await screen.findByLabelText('Watermark text')).toBeInTheDocument();
  });
});
