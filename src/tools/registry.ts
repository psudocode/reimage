import type { Env } from '../core/pipeline/types.ts';
import type { ImageTool } from './types.ts';

// Tool plugins will be registered here as they are implemented in Phase 1+.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registeredTools: ImageTool<any>[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRegisteredTools(): readonly ImageTool<any>[] {
  return registeredTools;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getToolById(id: string): ImageTool<any> | undefined {
  return registeredTools.find((tool) => tool.id === id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupportedTools(env: Env): ImageTool<any>[] {
  return registeredTools.filter((tool) => (tool.supports ? tool.supports(env) : true));
}
