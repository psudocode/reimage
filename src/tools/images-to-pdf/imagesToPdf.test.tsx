import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildPipeline } from '../../app/workspace/pipeline.ts';
import { LocaleContext } from '../../i18n/index.ts';
import { getToolRuntimeById } from '../runtimeRegistry.ts';
import { getToolUIById } from '../uiRegistry.ts';
import { imagesToPdfDefaults, toOutputSettings, validateImagesToPdf } from './options.ts';
import Panel from './Panel.tsx';
import { imagesToPdfRuntime } from './runtime.ts';

describe('images to pdf options', () => {
  it('accepts the defaults', () => {
    expect(validateImagesToPdf(imagesToPdfDefaults)).toEqual([]);
  });

  it('rejects bad values', () => {
    const errors = validateImagesToPdf({
      pageSize: 'a0' as never,
      margin: 'huge' as never,
      quality: 0,
    });
    expect(errors).toEqual([
      'tools.imagesToPdf.errors.pageSize',
      'tools.imagesToPdf.errors.margin',
      'tools.imagesToPdf.errors.quality',
    ]);
  });

  it('always encodes pages as JPEG', () => {
    expect(toOutputSettings({ ...imagesToPdfDefaults, quality: 70.4 })).toEqual({
      format: 'jpeg',
      quality: 70,
    });
    expect(buildPipeline('images-to-pdf', imagesToPdfDefaults).output.format).toBe('jpeg');
  });
});

describe('images to pdf runtime', () => {
  it('is a many-to-one tool registered on both sides', () => {
    expect(getToolRuntimeById('images-to-pdf')).toBe(imagesToPdfRuntime);
    expect(imagesToPdfRuntime.kind).toBe('many-to-one');
    expect(getToolUIById('images-to-pdf')?.category).toBe('export');
  });

  it('combines pages into one PDF blob', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
    const pdf = await imagesToPdfRuntime.combine!(
      [
        { blob: jpeg, width: 4, height: 4 },
        { blob: jpeg, width: 8, height: 4 },
      ],
      imagesToPdfDefaults,
    );
    expect(pdf.type).toBe('application/pdf');
    const text = new TextDecoder('latin1').decode(await pdf.arrayBuffer());
    expect(text).toContain('/Count 2');
  });
});

describe('images to pdf panel', () => {
  it('reports page size, margin and quality changes', async () => {
    const onChange = vi.fn();
    render(
      <LocaleContext.Provider value="en">
        <Suspense fallback={null}>
          <Panel value={imagesToPdfDefaults} onChange={onChange} />
        </Suspense>
      </LocaleContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText('Page size'), { target: { value: 'letter' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...imagesToPdfDefaults, pageSize: 'letter' });
    fireEvent.change(screen.getByLabelText('Margin'), { target: { value: 'large' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...imagesToPdfDefaults, margin: 'large' });
    fireEvent.change(screen.getByLabelText('Image quality'), { target: { value: '60' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...imagesToPdfDefaults, quality: 60 });
  });
});
