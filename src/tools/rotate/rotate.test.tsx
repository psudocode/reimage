import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import {
  isIdentity,
  rotatedSize,
  rotateDefaults,
  rotateMatrix,
  validateRotate,
  type RotateOptions,
} from './options.ts';
import Panel from './Panel.tsx';
import { rotateRuntime } from './runtime.ts';
import { rotateUI } from './ui.ts';

const opts = (patch: Partial<RotateOptions>): RotateOptions => ({ ...rotateDefaults, ...patch });
const src = { width: 4, height: 2 };

/** Where the matrix sends a source point. */
function map(m: number[], x: number, y: number): [number, number] {
  return [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
}

describe('rotate options', () => {
  it('accepts the defaults and rejects other angles', () => {
    expect(validateRotate(rotateDefaults)).toEqual([]);
    expect(validateRotate(opts({ rotation: 45 as never }))).toEqual([
      'tools.rotate.errors.rotation',
    ]);
  });

  it('knows when nothing changes', () => {
    expect(isIdentity(opts({ rotation: 0 }))).toBe(true);
    expect(isIdentity(opts({ rotation: 0, flipH: true }))).toBe(false);
    expect(isIdentity(rotateDefaults)).toBe(false);
  });

  it('swaps the sides on a quarter turn only', () => {
    expect(rotatedSize(src, 90)).toEqual({ width: 2, height: 4 });
    expect(rotatedSize(src, 270)).toEqual({ width: 2, height: 4 });
    expect(rotatedSize(src, 180)).toEqual(src);
    expect(rotatedSize(src, 0)).toEqual(src);
  });

  it('turns the top-left corner clockwise', () => {
    // 4x2 source rotated 90° cw becomes 2x4; top-left goes to top-right.
    expect(map(rotateMatrix(src, opts({ rotation: 90 })), 0, 0)).toEqual([2, 0]);
    expect(map(rotateMatrix(src, opts({ rotation: 180 })), 0, 0)).toEqual([4, 2]);
    expect(map(rotateMatrix(src, opts({ rotation: 270 })), 0, 0)).toEqual([0, 4]);
  });

  it('mirrors before turning', () => {
    expect(map(rotateMatrix(src, opts({ rotation: 0, flipH: true })), 0, 0)).toEqual([4, 0]);
    expect(map(rotateMatrix(src, opts({ rotation: 0, flipV: true })), 0, 0)).toEqual([0, 2]);
    // flipH then 90° cw: top-left -> top-right -> bottom-right of the 2x4 canvas.
    expect(map(rotateMatrix(src, opts({ rotation: 90, flipH: true })), 0, 0)).toEqual([2, 4]);
  });

  it('keeps every corner inside the output canvas', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      for (const flipH of [false, true]) {
        for (const flipV of [false, true]) {
          const o = { rotation, flipH, flipV };
          const size = rotatedSize(src, rotation);
          const m = rotateMatrix(src, o);
          for (const [x, y] of [
            [0, 0],
            [4, 0],
            [0, 2],
            [4, 2],
          ] as const) {
            const [px, py] = map(m, x, y);
            expect(px).toBeGreaterThanOrEqual(0);
            expect(px).toBeLessThanOrEqual(size.width);
            expect(py).toBeGreaterThanOrEqual(0);
            expect(py).toBeLessThanOrEqual(size.height);
          }
        }
      }
    }
  });
});

describe('rotate tool plugin', () => {
  const bitmap = (width: number, height: number) =>
    ({ width, height, close: vi.fn() }) as unknown as ImageBitmap;
  const setup = (aborted = false) => {
    const output = bitmap(0, 0);
    const drawImage = vi.fn();
    const setTransform = vi.fn();
    const canvas = {
      getContext: () => ({ drawImage, setTransform }),
      transferToImageBitmap: () => output,
    };
    const controller = new AbortController();
    if (aborted) controller.abort();
    const ctx = {
      signal: controller.signal,
      progress: vi.fn(),
      createCanvas: vi.fn(() => canvas as unknown as OffscreenCanvas),
      maxPixels: 100_000_000,
    };
    return { output, drawImage, setTransform, ctx };
  };

  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('rotate')).toBe(rotateRuntime);
    expect(getToolUIById('rotate')).toBe(rotateUI);
  });

  it('draws onto a canvas with swapped sides', async () => {
    const { output, drawImage, setTransform, ctx } = setup();
    const input = bitmap(2000, 1000);
    expect(await rotateRuntime.run(input, rotateDefaults, ctx)).toBe(output);
    expect(ctx.createCanvas).toHaveBeenCalledWith(1000, 2000);
    expect(setTransform).toHaveBeenCalledWith(...rotateMatrix(input, rotateDefaults));
    expect(drawImage).toHaveBeenCalledWith(input, 0, 0);
    expect(ctx.progress).toHaveBeenCalledWith(1);
  });

  it('returns the input when nothing changes', async () => {
    const { ctx } = setup();
    const input = bitmap(2000, 1000);
    expect(await rotateRuntime.run(input, opts({ rotation: 0 }), ctx)).toBe(input);
    expect(ctx.createCanvas).not.toHaveBeenCalled();
  });

  it('stops when cancelled', async () => {
    const { ctx } = setup(true);
    await expect(rotateRuntime.run(bitmap(2, 1), rotateDefaults, ctx)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

function Harness({ locale = 'en' }: { locale?: 'en' | 'id' }) {
  const [value, setValue] = useState(rotateDefaults);
  return (
    <LocaleContext.Provider value={locale}>
      <Panel value={value} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </LocaleContext.Provider>
  );
}

describe('rotate panel', () => {
  it('picks a rotation and toggles flips', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Rotate 90 degrees' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Rotate 270 degrees' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flip horizontally' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flip vertically' }));
    expect(JSON.parse(screen.getByTestId('value').textContent!)).toEqual({
      rotation: 270,
      flipH: true,
      flipV: true,
    });
  });

  it('is translated to Indonesian', () => {
    render(<Harness locale="id" />);
    expect(screen.getByRole('radio', { name: 'Putar 90 derajat' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Balik horizontal' })).toBeInTheDocument();
  });
});
