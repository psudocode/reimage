import { useMemo, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import { getRegisteredUIs, getToolUIById } from '../../tools/uiRegistry.ts';
import { filterTools, groupToolsByCategory } from './toolCatalog.ts';
import { usePreview } from './usePreview.ts';
import type { useWorkspace } from '../workspace/useWorkspace.ts';

export type Workspace = ReturnType<typeof useWorkspace>;

/**
 * Everything the desktop and mobile layouts share: which category and search
 * are showing, the active tool, and the live preview of the selected image.
 */
export function useEditorModel(workspace: Workspace) {
  const t = useT();
  const { toolId, options, errors, running, selected } = workspace;
  const groups = useMemo(() => groupToolsByCategory(getRegisteredUIs()), []);
  const tool = getToolUIById(toolId)!;
  const [browsedCategory, setBrowsedCategory] = useState(tool.category);
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  const visibleTools = searching
    ? filterTools(getRegisteredUIs(), query, t)
    : (groups.find((group) => group.id === browsedCategory)?.tools ?? []);

  const preview = usePreview({
    api: workspace.previewApi,
    item: selected,
    toolId,
    options,
    enabled: !running && errors.length === 0,
  });

  return {
    groups,
    tool,
    query,
    setQuery,
    searching,
    activeCategory: searching ? null : browsedCategory,
    browseCategory: (id: typeof browsedCategory) => {
      setBrowsedCategory(id);
      setQuery('');
    },
    visibleTools,
    preview,
  };
}

export type EditorModel = ReturnType<typeof useEditorModel>;
