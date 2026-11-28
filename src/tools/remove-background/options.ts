import type { OutputOverrides } from '../types.ts';

export interface RemoveBackgroundOptions {
  /** Keep the model's soft edge (hair, fur). Off = a hard cut-out at 50%. */
  softEdges: boolean;
}

export const removeBackgroundDefaults: RemoveBackgroundOptions = { softEdges: true };

/** Always valid: a boolean cannot be out of range. */
export function validateRemoveBackground(): string[] {
  return [];
}

/** Transparency needs an alpha channel, so the result is always PNG. */
export function toOutputSettings(): OutputOverrides {
  return { format: 'png' };
}
