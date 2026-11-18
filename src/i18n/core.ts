/**
 * The translation core: pure functions with no React Native imports, so the tests can run them
 * under plain Node. Components use `useT()` from `@/i18n` instead of calling these directly.
 */
import { en, type MessageKey, type Messages } from './en';
import { id } from './id';

export type Language = 'en' | 'id';
/** The Settings choice: `system` follows the phone. */
export type LanguagePref = 'system' | Language;

export const LANGUAGES: readonly Language[] = ['en', 'id'];
export const LANGUAGE_PREFS: readonly LanguagePref[] = ['system', 'en', 'id'];

const DICTIONARIES: Record<Language, Messages> = { en, id };

/** "Follow phone" picks Indonesian when the phone's first language is Indonesian, English otherwise. */
export function resolveLanguage(pref: LanguagePref, phoneLanguageCode: string | null | undefined): Language {
  if (pref === 'en' || pref === 'id') return pref;
  // "in" is the legacy ISO code some Android versions still report for Indonesian.
  const code = (phoneLanguageCode ?? '').toLowerCase();
  return code === 'id' || code === 'in' ? 'id' : 'en';
}

export type Params = Record<string, string | number>;

/** Plural bases: keys that exist as `<base>.one` (and `<base>.other`, checked by the tests). */
export type PluralBase = { [K in MessageKey]: K extends `${infer B}.one` ? B : never }[MessageKey];

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Fills `{name}` placeholders. `{Name}` (capitalised) is filled with the capitalised value of
 * `name`, for sentences that start with a word that's lowercase elsewhere ("Bulan sebelumnya").
 */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (name in params) return String(params[name]);
    const lower = name[0].toLowerCase() + name.slice(1);
    if (lower !== name && lower in params) return capitalize(String(params[lower]));
    return match;
  });
}

export function translate(lang: Language, key: MessageKey, params?: Params): string {
  return interpolate(DICTIONARIES[lang][key] ?? en[key], params);
}

/** English picks `.one` for exactly 1; Indonesian has no plural forms (both entries are the same). */
export function translatePlural(lang: Language, base: PluralBase, count: number, params?: Params): string {
  const form = lang === 'en' && count === 1 ? 'one' : 'other';
  return translate(lang, `${base}.${form}` as MessageKey, { count, ...params });
}

export interface Translator {
  lang: Language;
  t: (key: MessageKey, params?: Params) => string;
  tp: (base: PluralBase, count: number, params?: Params) => string;
}

export function makeTranslator(lang: Language): Translator {
  return {
    lang,
    t: (key, params) => translate(lang, key, params),
    tp: (base, count, params) => translatePlural(lang, base, count, params),
  };
}
