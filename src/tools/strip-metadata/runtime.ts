import type { ToolRuntime } from '../types.ts';
import {
  stripMetadataDefaults,
  toOutputSettings,
  validateStripMetadata,
  type StripMetadataOptions,
} from './options.ts';

/**
 * Strip metadata, worker side. The pixels are not touched: metadata is dropped
 * when the pipeline decodes the file and encodes it again (see
 * `core/image/encode.ts`), so `run` is a pass-through. EXIF orientation is
 * already applied by the decoder, so photos stay upright without the tag.
 */
export const stripMetadataRuntime: ToolRuntime<StripMetadataOptions> = {
  id: 'strip-metadata',
  defaults: stripMetadataDefaults,
  validate: validateStripMetadata,
  toOutput: toOutputSettings,
  async run(input, _options, ctx) {
    ctx.progress(1);
    return input;
  },
};
