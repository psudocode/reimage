import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import {
  computeExpandLayout,
  expandDefaults,
  validateExpand,
  type ExpandOptions,
} from './options.ts';
import Panel from './Panel.tsx';
import { expandRuntime } from './runtime.ts';
import { expandUI } from './ui.ts';

const opts = (patch: Partial<ExpandOptions>): ExpandOptions => ({ ...expandDefaults, ...patch });
const src = { width: 200, height: 100 };

describe('expand validation', () => {
  it('accepts the defaults', () => {
    expect(validateExpand(expandDefaults)).toEqual([]);
  });

  it('rejects bad padding', () => {
    expect(validateExpand(opts({ all: -1 }))).toEqual(['tools.expand.errors.padding']);
    expect(validateExpand(opts({ all: 1.5 }))).toEqual(['tools.expand.errors.padding']);
    expect(validateExpand(opts({ all: 9000 }))).toEqual(['tools.expand.errors.padding']);
    expect(validateExpand(opts({ all: Number.NaN }))).toEqual(['tools.expand.errors.padding']);
    expect(validateExpand(opts({ mode: 'sides', left: -2 }))).toEqual([
      'tools.expand.errors.padding',
    ]);
  });

  it('needs some padding', () => {
    expect(validateExpand(opts({ all: 0 }))).toEqual(['tools.expand.errors.empty']);
    expect(validateExpand(opts({ mode: 'sides', top: 0, right: 0, bottom: 0, left: 0 }))).toEqual([
      'tools.expand.errors.empty',
    ]);
    expect(validateExpand(opts({ mode: 'sides', top: 0, right: 0, bottom: 0, left: 5 }))).toEqual(
      [],
    );
  });

  it('checks the mode, background and colour', () => {
    expect(validateExpand(opts({ mode: 'x' as never }))).toEqual(['tools.expand.errors.mode']);
    expect(validateExpand(opts({ background: 'x' as never }))).toEqual([
      'tools.expand.errors.background',
    ]);
    expect(validateExpand(opts({ color: 'red' }))).toEqual(['tools.expand.errors.color']);
    expect(validateExpand(opts({ background: 'transparent', color: 'red' }))).toEqual([]);
  });
});

describe('computeExpandLayout', () => {
  it('pads every side equally', () => {
    expect(computeExpandLayout(src, opts({ all: 10 }), 1e9)).toEqual({
      canvas: { width: 220, height: 120 },
      image: { x: 10, y: 10, width: 200, height: 100 },
    });
  });

  it('pads each side on its own', () => {
    const layout = computeExpandLayout(
      src,
      opts({ mode: 'sides', top: 1, right: 2, bottom: 3, left: 4 }),
      1e9,
    );
    expect(layout.canvas).toEqual({ width: 206, height: 104 });
    expect(layout.image).toEqual({ x: 4, y: 1, width: 200, height: 100 });
  });

  it('scales everything down to fit the memory guard', () => {
    const layout = computeExpandLayout(src, opts({ all: 100 }), 10_000);
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(10_000);
    expect(layout.image.x + layout.image.width).toBeLessThanOrEqual(layout.canvas.width);
    expect(layout.image.y + layout.image.height).toBeLessThanOrEqual(layout.canvas.height);
    expect(layout.image.x).toBeGreaterThan(0);
  });
});

describe('expand runtime', () => {
  function setup(signal = new AbortController().signal) {
    const output = { width: 220, height: 120 } as unknown as ImageBitmap;
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const canvas = { getContext: () => context, transferToImageBitmap: () => output };
    const ctx = {
      signal,
      progress: vi.fn(),
      createCanvas: vi.fn(() => canvas as unknown as OffscreenCanvas),
      maxPixels: 1e9,
    };
    const input = { width: 200, height: 100 } as unknown as ImageBitmap;
    return { output, context, ctx, input };
  }

  it('fills the background and draws the image inside the padding', async () => {
    const { output, context, ctx, input } = setup();
    const result = await expandRuntime.run(input, opts({ all: 10, color: '#112233' }), ctx);
    expect(result).toBe(output);
    expect(ctx.createCanvas).toHaveBeenCalledWith(220, 120);
    expect(context.fillStyle).toBe('#112233');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 220, 120);
    expect(context.drawImage).toHaveBeenCalledWith(input, 10, 10, 200, 100);
    expect(ctx.progress).toHaveBeenCalledWith(1);
  });

  it('leaves the padding transparent', async () => {
    const { context, ctx, input } = setup();
    await expandRuntime.run(input, opts({ all: 10, background: 'transparent' }), ctx);
    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it('stops when cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const { ctx, input } = setup(controller.signal);
    await expect(expandRuntime.run(input, expandDefaults, ctx)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('expand registration', () => {
  it('registers a runtime and a UI under the same id', () => {
    expect(getToolRuntimeById('expand')).toBe(expandRuntime);
    expect(getToolUIById('expand')).toBe(expandUI);
    expect(expandRuntime.defaults).toEqual(expandDefaults);
  });
});

describe('expand panel', () => {
  function Harness({ locale = 'en' as const }) {
    const [value, setValue] = useState(expandDefaults);
    return (
      <LocaleContext.Provider value={locale}>
        <Suspense fallback={null}>
          <Panel value={value} onChange={setValue} />
        </Suspense>
        <output data-testid="value">{JSON.stringify(value)}</output>
      </LocaleContext.Provider>
    );
  }
  const current = () => JSON.parse(screen.getByTestId('value').textContent!) as ExpandOptions;

  it('edits the padding and switches to per-side inputs', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Padding (px)'), { target: { value: '20' } });
    expect(current().all).toBe(20);
    fireEvent.click(screen.getByRole('radio', { name: 'Per side' }));
    fireEvent.change(screen.getByLabelText('Left (px)'), { target: { value: '7' } });
    expect(current()).toMatchObject({ mode: 'sides', left: 7 });
  });

  it('switches to transparent and shows the JPEG hint', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Transparent' }));
    expect(current().background).toBe('transparent');
    expect(screen.getByText(/JPEG has no transparency/)).toBeInTheDocument();
  });

  it('changes the colour and shows validation errors', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Fill colour'), { target: { value: '#ff0000' } });
    expect(current().color).toBe('#ff0000');
    fireEvent.change(screen.getByLabelText('Padding (px)'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Padding must be a whole number');
  });
});
