import type { IconName } from '../ui/iconNames.ts';

/**
 * The groups tools are filed under in the editor rail. A tool picks one in its
 * `ToolUI`; the rail and the tool panel are built from the registry, so adding a
 * tool never touches layout code. Add a category here only when none fits.
 */
export const TOOL_CATEGORIES = [
  { id: 'transform', labelKey: 'categories.transform', icon: 'transform' },
  { id: 'export', labelKey: 'categories.export', icon: 'export' },
  { id: 'automate', labelKey: 'categories.automate', icon: 'pipeline' },
] as const satisfies readonly { id: string; labelKey: string; icon: IconName }[];

export type ToolCategoryId = (typeof TOOL_CATEGORIES)[number]['id'];
