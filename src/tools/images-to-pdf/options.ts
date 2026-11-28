import type { OutputSettings } from '../../core/pipeline/types.ts';
import type { PdfMargin, PdfPageSize } from '../../core/pdf/writePdf.ts';

export interface ImagesToPdfOptions {
  pageSize: PdfPageSize;
  margin: PdfMargin;
  /** 1-100. Every page is stored as a JPEG, so this sets size against sharpness. */
  quality: number;
}

export const PAGE_SIZES: readonly PdfPageSize[] = ['fit', 'a4', 'letter'];
export const MARGINS: readonly PdfMargin[] = ['none', 'small', 'large'];

export const imagesToPdfDefaults: ImagesToPdfOptions = {
  pageSize: 'fit',
  margin: 'none',
  quality: 85,
};

/** Returns i18n error keys; empty array means valid. */
export function validateImagesToPdf(options: ImagesToPdfOptions): string[] {
  const errors: string[] = [];
  if (!PAGE_SIZES.includes(options.pageSize)) errors.push('tools.imagesToPdf.errors.pageSize');
  if (!MARGINS.includes(options.margin)) errors.push('tools.imagesToPdf.errors.margin');
  if (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100) {
    errors.push('tools.imagesToPdf.errors.quality');
  }
  return errors;
}

/** PDF pages are JPEG (`DCTDecode`), so every image is encoded as JPEG first. */
export function toOutputSettings(
  options: ImagesToPdfOptions,
): Pick<OutputSettings, 'format' | 'quality'> {
  return { format: 'jpeg', quality: Math.round(options.quality) };
}
