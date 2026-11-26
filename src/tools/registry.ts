import type { Env } from '../core/pipeline/types.ts';
import { compress } from './compress/index.ts';
import type { ImageTool } from './types.ts';

// Register new tool plugins here (see technical.md, "Adding a new tool").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registeredTools: ImageTool<any>[] = [compress];

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
