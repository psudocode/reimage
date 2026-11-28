import { lazy } from 'react';
import type { ToolUI } from '../types.ts';
import { PIPELINE_TOOL_ID, type PipelineToolOptions } from './options.ts';

/** Pipelines, main-thread side. The Panel is lazy so it only loads when shown. */
export const pipelineUI: ToolUI<PipelineToolOptions> = {
  id: PIPELINE_TOOL_ID,
  labelKey: 'tools.pipeline.label',
  category: 'automate',
  icon: 'pipeline',
  Panel: lazy(() => import('./Panel.tsx')),
};
