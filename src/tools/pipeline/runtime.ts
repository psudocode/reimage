import type { ToolContext, ToolRuntime } from '../types.ts';
import {
  mergeStepOutputs,
  PIPELINE_TOOL_ID,
  pipelineDefaults,
  validatePipelineSteps,
  type PipelineToolOptions,
  type ToolLookup,
} from './options.ts';

/**
 * Pipelines, worker side: one tool that runs a saved list of other tools in
 * order. It is a tool like any other, so the worker, the live preview and the
 * memory guards need no special case. `getTool` is injected because the
 * registry that holds this runtime is also where steps are looked up.
 */
export function createPipelineRuntime(getTool: ToolLookup): ToolRuntime<PipelineToolOptions> {
  return {
    id: PIPELINE_TOOL_ID,
    defaults: pipelineDefaults,
    validate: (options) => validatePipelineSteps(options, getTool),
    toOutput: (options) => mergeStepOutputs(options, getTool),
    async run(input, options, ctx) {
      const count = options.steps.length;
      let current = input;
      try {
        for (const [index, step] of options.steps.entries()) {
          const tool = getTool(step.toolId)!;
          const stepContext: ToolContext = {
            ...ctx,
            progress: (fraction) =>
              ctx.progress((index + Math.min(1, Math.max(0, fraction))) / count),
          };
          const next = await tool.run(current, step.options, stepContext);
          // The caller owns the original input; only our own intermediates are closed.
          if (next !== current && current !== input) current.close();
          current = next;
        }
      } catch (error) {
        if (current !== input) current.close();
        throw error;
      }
      ctx.progress(1);
      return current;
    },
  };
}
