import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import {
  CONVERT_FORMATS,
  convertDefaults,
  isLossyFormat,
  toOutputSettings,
  validateConvert,
  type ConvertOptions,
} from './options.ts';
import Panel from './Panel.tsx';
import { convertRuntime } from './runtime.ts';
import { convertUI } from './ui.ts';

describe('convert options', () => {
  it('accepts the defaults', () => {
    expect(validateConvert(convertDefaults)).toEqual([]);
  });

  it.each(CONVERT_FORMATS)('accepts %s', (format) => {
    expect(validateConvert({ ...convertDefaults, format })).toEqual([]);
  });

  it('rejects an unknown format', () => {
    expect(validateConvert({ ...convertDefaults, format: 'gif' as never })).toEqual([
      'tools.convert.errors.format',
    ]);
  });

  it.each([0, 101, -5, Number.NaN])('rejects quality %s for lossy formats', (quality) => {
    expect(validateConvert({ format: 'webp', quality })).toEqual(['tools.convert.errors.quality']);
  });

  it('ignores quality for PNG, which is lossless', () => {
    expect(validateConvert({ format: 'png', quality: 0 })).toEqual([]);
    expect(isLossyFormat('png')).toBe(false);
    expect(isLossyFormat('jpeg')).toBe(true);
  });

  it('maps the options to output settings', () => {
    expect(toOutputSettings({ format: 'jpeg', quality: 79.6 })).toEqual({
      format: 'jpeg',
      quality: 80,
      targetBytes: undefined,
    });
    expect(toOutputSettings({ format: 'png', quality: 50 })).toEqual({
      format: 'png',
      quality: undefined,
      targetBytes: undefined,
    });
  });
});

describe('convert tool plugin', () => {
  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('convert')).toBe(convertRuntime);
    expect(getToolUIById('convert')).toBe(convertUI);
  });

  it('exposes its output settings to the pipeline builder', () => {
    expect(convertRuntime.toOutput?.({ format: 'avif', quality: 40 })).toMatchObject({
      format: 'avif',
      quality: 40,
    });
  });

  it('passes the bitmap through untouched and reports progress', async () => {
    const input = { width: 4, height: 4, close: vi.fn() } as unknown as ImageBitmap;
    const progress = vi.fn();
    const out = await convertRuntime.run(input, convertDefaults, {
      signal: new AbortController().signal,
      progress,
      createCanvas: vi.fn(),
    });
    expect(out).toBe(input);
    expect(input.close).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith(1);
  });
});

function Harness({ initial = convertDefaults }: { initial?: ConvertOptions }) {
  const [value, setValue] = useState(initial);
  return <Panel value={value} onChange={setValue} />;
}

describe('convert panel', () => {
  it('picks a format and shows its hint', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'WebP' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'JPEG' }));
    expect(screen.getByRole('radio', { name: 'JPEG' })).toBeChecked();
    expect(screen.getByText(/transparent areas turn white/)).toBeInTheDocument();
  });

  it('shows the quality slider for lossy formats and updates the value', () => {
    render(<Harness />);
    const slider = screen.getByLabelText('Quality');
    fireEvent.change(slider, { target: { value: '55' } });
    expect(slider).toHaveValue('55');
    expect(screen.getByRole('status')).toHaveTextContent('55');
  });

  it('swaps the slider for a note on PNG', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }));
    expect(screen.queryByLabelText('Quality')).not.toBeInTheDocument();
    expect(screen.getByText(/PNG is lossless/)).toBeInTheDocument();
  });

  it('is translated', () => {
    render(
      <LocaleContext.Provider value="id">
        <Harness />
      </LocaleContext.Provider>,
    );
    expect(screen.getByText('Ubah ke')).toBeInTheDocument();
    expect(screen.getByLabelText('Kualitas')).toBeInTheDocument();
  });

  it('loads lazily through the tool plugin', async () => {
    const Lazy = convertUI.Panel;
    render(
      <Suspense fallback={<span>loading</span>}>
        <Lazy value={convertDefaults} onChange={() => {}} />
      </Suspense>,
    );
    expect(await screen.findByRole('radio', { name: 'AVIF' })).toBeInTheDocument();
  });
});
