import type { Pipeline } from '../../core/pipeline/types.ts';
import { toOutputSettings, type CompressOptions } from '../../tools/compress/options.ts';

export const FILE_NAME_PATTERN = '{name}-reimage.{ext}';

/**
 * Builds the pipeline for the Compress tool: one (pass-through) step so its
 * options are validated, plus output settings derived from them.
 * Convert, Resize and Crop will add their own builders next to this one.
 */
export function buildCompressPipeline(options: CompressOptions): Pipeline {
  return {
    version: 1,
    steps: [{ toolId: 'compress', options }],
    output: {
      format: 'original',
      ...toOutputSettings(options),
      stripMetadata: true,
      fileNamePattern: FILE_NAME_PATTERN,
    },
  };
}
