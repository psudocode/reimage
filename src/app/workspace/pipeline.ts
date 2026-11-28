import type { Pipeline } from '../../core/pipeline/types.ts';
import { getToolRuntimeById } from '../../tools/runtimeRegistry.ts';

/** Base name of the file a many-to-one tool (merge) produces. */
export const COMBINED_NAME = 'merged';

export const FILE_NAME_PATTERN = '{name}-reimage.{ext}';

/**
 * Builds a one-step pipeline for a tool: the step carries the tool's options (so
 * they are validated in the worker) and the tool's `toOutput` decides how the
 * result is encoded. Tools without `toOutput` keep each image's original format.
 */
export function buildPipeline(toolId: string, options: unknown): Pipeline {
  const tool = getToolRuntimeById(toolId);
  if (!tool) throw new Error(`Unknown tool "${toolId}"`);
  return {
    version: 1,
    steps: [{ toolId, options }],
    output: {
      format: 'original',
      stripMetadata: true,
      fileNamePattern: FILE_NAME_PATTERN,
      ...tool.toOutput?.(options),
    },
  };
}
