import { TOOL_CATEGORIES, type ToolCategoryId } from '../../tools/categories.ts';
import type { ToolUI } from '../../tools/types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolUI = ToolUI<any>;

export interface CategoryGroup {
  id: ToolCategoryId;
  labelKey: string;
  icon: (typeof TOOL_CATEGORIES)[number]['icon'];
  tools: AnyToolUI[];
}

/**
 * Builds the rail from the registry: one entry per category that has tools,
 * in the order of `TOOL_CATEGORIES`. A new tool shows up here with no layout change.
 */
export function groupToolsByCategory(uis: readonly AnyToolUI[]): CategoryGroup[] {
  return TOOL_CATEGORIES.map((category) => ({
    ...category,
    tools: uis.filter((tool) => tool.category === category.id),
  })).filter((group) => group.tools.length > 0);
}

/** Tools whose translated label contains `query` (case-insensitive). Blank = all. */
export function filterTools(
  uis: readonly AnyToolUI[],
  query: string,
  translate: (key: string) => string,
): AnyToolUI[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return [...uis];
  return uis.filter((tool) => translate(tool.labelKey).toLocaleLowerCase().includes(needle));
}
