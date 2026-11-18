import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Language } from '../domain/types';
import { de } from './de';
import { en, type MessageKey } from './en';

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, de };

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export function translator(language: Language): Translate {
  const dict = dictionaries[language];
  return (key, params) =>
    dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? `{${name}}`));
}

export function useT(): Translate {
  const language = useLiveQuery(async () => (await db.settings.get('settings'))?.language) ?? 'en';
  return translator(language);
}
