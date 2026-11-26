import type { ToolRuntime } from '../types.ts';
import {
  convertDefaults,
  toOutputSettings,
  validateConvert,
  type ConvertOptions,
} from './options.ts';

/**
 * Convert, worker side. The target format is applied when the pipeline's output
 * is encoded (see `core/image/encode.ts`), so `run` is a pass-through.
 */
export const convertRuntime: ToolRuntime<ConvertOptions> = {
  id: 'convert',
  defaults: convertDefaults,
  validate: validateConvert,
  toOutput: toOutputSettings,
  async run(input, _options, ctx) {
    ctx.progress(1);
    return input;
  },
};
