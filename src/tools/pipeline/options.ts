import type { PipelineStep } from '../../core/pipeline/types.ts';
import type { OutputOverrides, ToolRuntime } from '../types.ts';

export const PIPELINE_TOOL_ID = 'pipeline';
export const MAX_PIPELINE_STEPS = 10;

export interface PipelineToolOptions {
  steps: PipelineStep[];
}

export const pipelineDefaults: PipelineToolOptions = { steps: [] };

export type ToolLookup = (id: string) => ToolRuntime<unknown> | undefined;

/** Returns i18n error keys; empty array means valid. A step's own errors are passed through. */
export function validatePipelineSteps(options: PipelineToolOptions, getTool: ToolLookup): string[] {
  const { steps } = options;
  if (!Array.isArray(steps) || steps.length === 0) return ['tools.pipeline.errors.empty'];
  if (steps.length > MAX_PIPELINE_STEPS) return ['tools.pipeline.errors.tooMany'];
  const errors: string[] = [];
  for (const step of steps) {
    const tool = step.toolId === PIPELINE_TOOL_ID ? undefined : getTool(step.toolId);
    if (!tool) {
      errors.push('tools.pipeline.errors.unknownTool');
      continue;
    }
    errors.push(...tool.validate(step.options));
  }
  return [...new Set(errors)];
}

/**
 * The encode settings of a chain: each step may set some, a later step wins.
 * (Compress then Convert = Convert's format with Compress's quality.)
 */
export function mergeStepOutputs(
  options: PipelineToolOptions,
  getTool: ToolLookup,
): OutputOverrides {
  return options.steps.reduce<OutputOverrides>(
    (merged, step) => ({ ...merged, ...getTool(step.toolId)?.toOutput?.(step.options) }),
    {},
  );
}
