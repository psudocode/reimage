import { writePdf } from '../../core/pdf/writePdf.ts';
import type { ToolRuntime } from '../types.ts';
import {
  imagesToPdfDefaults,
  toOutputSettings,
  validateImagesToPdf,
  type ImagesToPdfOptions,
} from './options.ts';

/**
 * Images to PDF, worker side. Pixels pass through; each image is encoded as a
 * JPEG by the pipeline (`toOutput`), so it runs under the same memory guard and
 * worker pool as every other tool. `combine` then lays the pages out in a PDF.
 * Everything stays in the browser: nothing is uploaded.
 */
export const imagesToPdfRuntime: ToolRuntime<ImagesToPdfOptions> = {
  id: 'images-to-pdf',
  kind: 'many-to-one',
  defaults: imagesToPdfDefaults,
  validate: validateImagesToPdf,
  toOutput: toOutputSettings,
  async run(input, _options, ctx) {
    ctx.progress(1);
    return input;
  },
  async combine(pages, options) {
    const images = await Promise.all(
      pages.map(async (page) => ({
        jpeg: new Uint8Array(await page.blob.arrayBuffer()),
        width: page.width,
        height: page.height,
      })),
    );
    const bytes = writePdf(images, { pageSize: options.pageSize, margin: options.margin });
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
  },
};
