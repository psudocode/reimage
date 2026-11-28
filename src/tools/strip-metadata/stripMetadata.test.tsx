import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildPipeline } from '../../app/workspace/pipeline.ts';
import { LocaleContext } from '../../i18n/index.ts';
import type { ToolContext } from '../types.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import { stripMetadataDefaults, toOutputSettings, validateStripMetadata } from './options.ts';
import Panel from './Panel.tsx';
import { stripMetadataRuntime } from './runtime.ts';

describe('strip metadata options', () => {
  it('accepts the defaults', () => {
    expect(validateStripMetadata(stripMetadataDefaults)).toEqual([]);
  });

  it.each([0, 101, Number.NaN])('rejects quality %s', (quality) => {
    expect(validateStripMetadata({ quality })).toEqual(['tools.stripMetadata.errors.quality']);
  });

  it('maps to a rounded output quality and keeps the original format', () => {
    expect(toOutputSettings({ quality: 87.6 })).toEqual({ quality: 88 });
    const pipeline = buildPipeline('strip-metadata', { quality: 90 });
    expect(pipeline.output).toMatchObject({ format: 'original', quality: 90 });
  });
});

describe('strip metadata runtime', () => {
  it('passes the pixels through untouched', async () => {
    const input = { width: 4, height: 3 } as ImageBitmap;
    const progress = vi.fn();
    const ctx = { progress } as unknown as ToolContext;
    await expect(stripMetadataRuntime.run(input, stripMetadataDefaults, ctx)).resolves.toBe(input);
    expect(progress).toHaveBeenCalledWith(1);
  });

  it('is registered on both sides', () => {
    expect(getToolRuntimeById('strip-metadata')).toBe(stripMetadataRuntime);
    expect(getToolUIById('strip-metadata')?.category).toBe('export');
  });
});

describe('strip metadata panel', () => {
  it('explains what is removed and reports quality changes', async () => {
    const onChange = vi.fn();
    render(
      <LocaleContext.Provider value="en">
        <Suspense fallback={null}>
          <Panel value={stripMetadataDefaults} onChange={onChange} />
        </Suspense>
      </LocaleContext.Provider>,
    );
    expect(screen.getByText(/GPS/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quality'), { target: { value: '70' } });
    expect(onChange).toHaveBeenCalledWith({ quality: 70 });
  });
});
