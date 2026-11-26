import { createContext, useContext } from 'react';
import en from './en.json';
import id from './id.json';

export type Locale = 'en' | 'id';
export const messages = { en, id } as const;

export const LocaleContext = createContext<Locale>('en');

/** Resolves a dotted key (`tools.compress.label`) with fallback to English, then the key itself. */
export function translate(locale: Locale, key: string): string {
  const lookup = (tree: unknown): string | undefined => {
    let node: unknown = tree;
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null) return undefined;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? node : undefined;
  };
  return lookup(messages[locale]) ?? lookup(messages.en) ?? key;
}

export function useT(): (key: string) => string {
  const locale = useContext(LocaleContext);
  return (key) => translate(locale, key);
}
