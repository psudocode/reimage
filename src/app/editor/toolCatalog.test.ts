import { describe, expect, it } from 'vitest';
import { getRegisteredUIs } from '../../tools/uiRegistry.ts';
import { translate } from '../../i18n/index.ts';
import { filterTools, groupToolsByCategory } from './toolCatalog.ts';

const t = (key: string) => translate('en', key);

describe('groupToolsByCategory', () => {
  it('groups the registered tools by their declared category', () => {
    const groups = groupToolsByCategory(getRegisteredUIs());
    expect(groups.map((g) => [g.id, g.tools.map((tool) => tool.id)])).toEqual([
      ['transform', ['resize', 'crop', 'rotate']],
      ['export', ['compress', 'convert']],
    ]);
  });

  it('drops categories without tools', () => {
    const onlyCrop = getRegisteredUIs().filter((tool) => tool.id === 'crop');
    expect(groupToolsByCategory(onlyCrop).map((g) => g.id)).toEqual(['transform']);
  });
});

describe('filterTools', () => {
  it('matches the translated label, ignoring case and spaces around the query', () => {
    const ids = filterTools(getRegisteredUIs(), '  CO ', t).map((tool) => tool.id);
    expect(ids).toEqual(['compress', 'convert']);
  });

  it('returns every tool for a blank query and none for no match', () => {
    expect(filterTools(getRegisteredUIs(), '', t)).toHaveLength(5);
    expect(filterTools(getRegisteredUIs(), 'zzz', t)).toEqual([]);
  });

  it('searches in the active language', () => {
    const id = (key: string) => translate('id', key);
    expect(filterTools(getRegisteredUIs(), 'kompres', id).map((tool) => tool.id)).toEqual([
      'compress',
    ]);
  });
});
