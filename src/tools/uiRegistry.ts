import { compressUI } from './compress/ui.ts';
import { convertUI } from './convert/ui.ts';
import { cropUI } from './crop/ui.ts';
import { resizeUI } from './resize/ui.ts';
import type { ToolUI } from './types.ts';

// Main-thread side; the counterpart of `runtimeRegistry.ts`. Keep both in the
// same order so the tool list reads the same everywhere.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registeredUIs: ToolUI<any>[] = [compressUI, convertUI, resizeUI, cropUI];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRegisteredUIs(): readonly ToolUI<any>[] {
  return registeredUIs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getToolUIById(id: string): ToolUI<any> | undefined {
  return registeredUIs.find((tool) => tool.id === id);
}
