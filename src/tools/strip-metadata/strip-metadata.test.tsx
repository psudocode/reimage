import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import Panel from './Panel.tsx';
import {
  MAX_QUALITY,
  MIN_QUALITY,
  stripMetadataDefaults,
  toOutputSettings,
  validateStripMetadata,
  type StripMetadataOptions,
} from './options.ts';
import { stripMetadataRuntime } from './runtime.ts';
import { stripMetadataUI } from './ui.ts';

describe('strip-metadata options', () => {
  it('accepts the defaults', () => {
    expect(validateStripMetadata(stripMetadataDefaults)).toEqual([]);
  });

  it.each([0, 101, -10, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid quality %s',
    (quality) => {
      expect(validateStripMetadata({ quality })).toEqual(['tools.stripMetadata.errors.quality']);
    },
  );

  it.each([MIN_QUALITY, 50, 90, MAX_QUALITY])('accepts valid quality %s', (quality) => {
    expect(validateStripMetadata({ quality })).toEqual([]);
  });

  it('maps to output settings with stripMetadata enabled and rounded quality', () => {
    expect(toOutputSettings({ quality: 85.6 })).toEqual({
      stripMetadata: true,
      quality: 86,
    });
  });
});

describe('strip-metadata tool plugin', () => {
  it('is registered under its id, on both sides', () => {
    expect(getToolRuntimeById('strip-metadata')).toBe(stripMetadataRuntime);
    expect(getToolUIById('strip-metadata')).toBe(stripMetadataUI);
  });

  it('passes the bitmap through untouched and reports progress', async () => {
    const input = { width: 100, height: 100, close: vi.fn() } as unknown as ImageBitmap;
    const progress = vi.fn();
    const out = await stripMetadataRuntime.run(input, stripMetadataDefaults, {
      signal: new AbortController().signal,
      progress,
      createCanvas: vi.fn(),
      maxPixels: 1_000_000,
    });
    expect(out).toBe(input);
    expect(input.close).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith(1);
  });

  it('enforces memory limits against maxPixels', async () => {
    const input = { width: 4000, height: 3000, close: vi.fn() } as unknown as ImageBitmap;
    await expect(
      stripMetadataRuntime.run(input, stripMetadataDefaults, {
        signal: new AbortController().signal,
        progress: vi.fn(),
        createCanvas: vi.fn(),
        maxPixels: 10_000_000, // 4000*3000 = 12M > 10M
      }),
    ).rejects.toThrow(/exceeds memory limit/);
  });
});

function Harness({ initial = stripMetadataDefaults }: { initial?: StripMetadataOptions }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Panel value={value} onChange={setValue} />
      <pre data-testid="state">{JSON.stringify(value)}</pre>
    </>
  );
}
const state = () =>
  JSON.parse(screen.getByTestId('state').textContent ?? '{}') as StripMetadataOptions;

describe('strip-metadata panel', () => {
  it('renders purged items and description', () => {
    render(<Harness />);
    expect(screen.getByText(/Remove EXIF, GPS location, camera details/i)).toBeInTheDocument();
    expect(screen.getByText(/GPS location coordinates/i)).toBeInTheDocument();
    expect(screen.getByText(/Camera make, model/i)).toBeInTheDocument();
  });

  it('updates quality from the slider', () => {
    render(<Harness />);
    const slider = screen.getByLabelText('Quality');
    fireEvent.change(slider, { target: { value: '75' } });
    expect(state().quality).toBe(75);
  });

  it('renders in Indonesian', () => {
    render(
      <LocaleContext.Provider value="id">
        <Harness />
      </LocaleContext.Provider>,
    );
    expect(screen.getByText(/Hapus EXIF, lokasi GPS, detail kamera/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Kualitas')).toBeInTheDocument();
    expect(screen.getByText(/Koordinat lokasi GPS/i)).toBeInTheDocument();
  });

  it('loads lazily through the tool plugin', async () => {
    const Lazy = stripMetadataUI.Panel;
    render(
      <Suspense fallback={<span>loading</span>}>
        <Lazy value={stripMetadataDefaults} onChange={() => {}} />
      </Suspense>,
    );
    expect(await screen.findByLabelText('Quality')).toBeInTheDocument();
  });
});
