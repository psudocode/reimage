import { describe, expect, it } from 'vitest';
import { messages, translate } from './index.ts';

function keys(tree: unknown, prefix = ''): string[] {
  if (typeof tree !== 'object' || tree === null) return [prefix];
  return Object.entries(tree).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('resolves dotted keys per locale', () => {
    expect(translate('en', 'tools.compress.label')).toBe('Compress');
    expect(translate('id', 'tools.compress.label')).toBe('Kompres');
  });

  it('falls back to the key when missing everywhere', () => {
    expect(translate('id', 'nope.missing')).toBe('nope.missing');
  });

  it('keeps en and id in sync (no untranslated keys)', () => {
    expect(keys(messages.id).sort()).toEqual(keys(messages.en).sort());
  });
});
