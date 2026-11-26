import type { ToolRuntime } from '../types.ts';
import {
  compressDefaults,
  toOutputSettings,
  validateCompress,
  type CompressOptions,
} from './options.ts';

/**
 * Compress, worker side. Quality / target-size encoding itself happens at the
 * end of the pipeline (see `core/image/encode.ts` and `targetSize.ts`), so `run`
 * is a pass-through. The options live in `options.ts` and the Panel in `ui.ts`,
 * so this module imports no React.
 */
export const compressRuntime: ToolRuntime<CompressOptions> = {
  id: 'compress',
  defaults: compressDefaults,
  validate: validateCompress,
  toOutput: toOutputSettings,
  async run(input, _options, ctx) {
    ctx.progress(1);
    return input;
  },
};
