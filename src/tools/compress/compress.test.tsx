import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import Panel from './Panel.tsx';
import { compressRuntime } from './runtime.ts';
import { compressUI } from './ui.ts';
import {
  compressDefaults,
  toOutputSettings,
  validateCompress,
  type CompressOptions,
} from './options.ts';

describe('compress options', () => {
  it('accepts the defaults', () => {
    expect(validateCompress(compressDefaults)).toEqual([]);
  });

  it.each([0, 101, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects quality %s', (quality) => {
    expect(validateCompress({ ...compressDefaults, quality })).toEqual([
      'tools.compress.errors.quality',
    ]);
  });

  it.each([0, 0.5, -1, Number.NaN, 100_001])('rejects target %s KB', (targetKb) => {
    expect(validateCompress({ ...compressDefaults, mode: 'targetSize', targetKb })).toEqual([
      'tools.compress.errors.target',
    ]);
  });

  it('only validates the field for the active mode', () => {
    expect(validateCompress({ mode: 'quality', quality: 50, targetKb: Number.NaN })).toEqual([]);
    expect(validateCompress({ mode: 'targetSize', quality: 0, targetKb: 200 })).toEqual([]);
  });

  it('maps quality mode to output settings without a target', () => {
    expect(toOutputSettings({ mode: 'quality', quality: 80.4, targetKb: 200 })).toEqual({
      quality: 80,
      targetBytes: undefined,
    });
  });

  it('maps target mode to bytes (1 KB = 1000 B) without a fixed quality', () => {
    expect(toOutputSettings({ mode: 'targetSize', quality: 80, targetKb: 200 })).toEqual({
      quality: undefined,
      targetBytes: 200_000,
    });
  });
});

describe('compress tool plugin', () => {
  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('compress')).toBe(compressRuntime);
    expect(getToolUIById('compress')).toBe(compressUI);
  });

  it('passes the bitmap through untouched and reports progress', async () => {
    const input = { width: 4, height: 4, close: vi.fn() } as unknown as ImageBitmap;
    const progress = vi.fn();
    const out = await compressRuntime.run(input, compressDefaults, {
      signal: new AbortController().signal,
      progress,
      createCanvas: vi.fn(),
      maxPixels: 1_000_000,
    });
    expect(out).toBe(input);
    expect(input.close).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith(1);
  });
});

function Harness({ initial = compressDefaults }: { initial?: CompressOptions }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Panel value={value} onChange={setValue} />
      <pre data-testid="state">{JSON.stringify(value)}</pre>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as CompressOptions;

describe('Compress panel', () => {
  it('updates quality from the slider', () => {
    render(<Harness />);
    const slider = screen.getByLabelText('Quality');
    fireEvent.change(slider, { target: { value: '42' } });
    expect(state().quality).toBe(42);
  });

  it('switches to target size and edits KB', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Target file size'));
    expect(state().mode).toBe('targetSize');
    expect(screen.queryByLabelText('Quality')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Keep each file under (KB)'), {
      target: { value: '150' },
    });
    expect(state().targetKb).toBe(150);
  });

  it('shows an error for an invalid target and clears it when fixed', () => {
    render(<Harness initial={{ ...compressDefaults, mode: 'targetSize', targetKb: 200 }} />);
    const input = screen.getByLabelText('Keep each file under (KB)');
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByRole('alert')).toHaveTextContent('at least 1 KB');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(input, { target: { value: '10' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats an emptied number field as invalid instead of crashing', () => {
    render(<Harness initial={{ ...compressDefaults, mode: 'targetSize' }} />);
    fireEvent.change(screen.getByLabelText('Keep each file under (KB)'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders in Indonesian', () => {
    render(
      <LocaleContext.Provider value="id">
        <Harness />
      </LocaleContext.Provider>,
    );
    expect(screen.getByLabelText('Kualitas')).toBeInTheDocument();
  });

  it('loads lazily through the tool plugin', async () => {
    const Lazy = compressUI.Panel;
    render(
      <Suspense fallback={<span>loading</span>}>
        <Lazy value={compressDefaults} onChange={() => {}} />
      </Suspense>,
    );
    expect(await screen.findByLabelText('Quality')).toBeInTheDocument();
  });
});
