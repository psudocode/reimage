import type { Env } from '../core/pipeline/types.ts';
import { compressRuntime } from './compress/runtime.ts';
import { convertRuntime } from './convert/runtime.ts';
import { cropRuntime } from './crop/runtime.ts';
import { resizeRuntime } from './resize/runtime.ts';
import { stripMetadataRuntime } from './strip-metadata/runtime.ts';
import type { ToolRuntime } from './types.ts';

// Worker side. Register a new tool's runtime here AND its UI in `uiRegistry.ts`
// (see technical.md, "Adding a new tool"). Never import React from this file or
// from any runtime module: `registry.test.ts` and ESLint both guard that.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registeredRuntimes: ToolRuntime<any>[] = [
  compressRuntime,
  convertRuntime,
  resizeRuntime,
  cropRuntime,
  stripMetadataRuntime,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRegisteredRuntimes(): readonly ToolRuntime<any>[] {
  return registeredRuntimes;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getToolRuntimeById(id: string): ToolRuntime<any> | undefined {
  return registeredRuntimes.find((tool) => tool.id === id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupportedRuntimes(env: Env): ToolRuntime<any>[] {
  return registeredRuntimes.filter((tool) => (tool.supports ? tool.supports(env) : true));
}
