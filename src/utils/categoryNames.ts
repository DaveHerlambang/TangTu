/**
 * Category names (§6.5): a typed name is shown as typed; an untouched template category is named
 * from the dictionary, so it follows the language. Pure (runs under the Node tests).
 */
import { isTemplateKey, type CategoryIcon, type IconGroupKey, type TemplateKey } from '@/constants/categories';
import { LANGUAGES, translate, type Language } from '@/i18n/core';
import type { MessageKey } from '@/i18n/en';
import type { TintKey } from '@/theme/themes';
import type { Category } from '@/types/models';

export const templateLabelKey = (key: TemplateKey) => `template.${key}` as const satisfies MessageKey;
export const iconLabelKey = (icon: CategoryIcon) => `icon.${icon}` as const satisfies MessageKey;
export const iconGroupLabelKey = (group: IconGroupKey) => `icons.group.${group}` as const satisfies MessageKey;
export const tintLabelKey = (tint: TintKey) => `tint.${tint}` as const satisfies MessageKey;

type Named = Pick<Category, 'name' | 'template_key'>;

/** The name to show for a category in `lang`. */
export function categoryName(category: Named, lang: Language): string {
  if (category.name) return category.name;
  if (isTemplateKey(category.template_key)) return translate(lang, templateLabelKey(category.template_key));
  return translate(lang, 'category.unnamed');
}

/** Comparison form of a name: trimmed, case- and space-insensitive. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * Every name a category can be shown under: its typed name, or its template's name in each
 * language. Two active categories of one kind may not share any (§3: "active names unique per kind").
 */
export function shownNames(category: Named): Set<string> {
  if (category.name) return new Set([nameKey(category.name)]);
  return new Set(LANGUAGES.map((lang) => nameKey(categoryName(category, lang))));
}

/**
 * What to store as `name` for a category made from `template`: NULL while the typed text is still
 * the template's name (in any language), so it keeps following the language; otherwise the text.
 */
export function storedName(typed: string, template: TemplateKey | null): string | null {
  const clean = typed.trim().replace(/\s+/g, ' ');
  if (!template) return clean || null;
  if (!clean) return null;
  const isTemplateName = LANGUAGES.some((lang) => nameKey(translate(lang, templateLabelKey(template))) === nameKey(clean));
  return isTemplateName ? null : clean;
}

/**
 * Search (§5): does the category's shown name contain `text`? Checks every name it can show under
 * (both languages for an untouched template), case- and space-insensitive.
 */
export function nameMatches(category: Named, text: string): boolean {
  const q = nameKey(text);
  if (!q) return false;
  return [...shownNames(category)].some((n) => n.includes(q));
}
