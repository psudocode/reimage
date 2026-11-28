import type { ToolRuntime } from '../types.ts';
import {
  stripMetadataDefaults,
  toOutputSettings,
  validateStripMetadata,
  type StripMetadataOptions,
} from './options.ts';

/**
 * Strip metadata (EXIF & GPS), worker side.
 * Re-encoding the decoded ImageBitmap drops all EXIF, GPS, camera metadata,
 * timestamps, and thumbnails, preserving only the clean raster pixels.
 * Adheres to ToolRuntime interface, worker pool, and memory limits.
 */
export const stripMetadataRuntime: ToolRuntime<StripMetadataOptions> = {
  id: 'strip-metadata',
  defaults: stripMetadataDefaults,
  validate: validateStripMetadata,
  toOutput: toOutputSettings,
  async run(input, _options, ctx) {
    if (input.width * input.height > ctx.maxPixels) {
      throw new Error(`Image exceeds memory limit of ${ctx.maxPixels} pixels`);
    }
    ctx.progress(1);
    return input;
  },
};
