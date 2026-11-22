import { isTemplateKey } from '@/constants/categories';
import { DomainError } from '@/db/errors';
import type { Translator } from '@/i18n/core';
import { categoryName } from '@/utils/categoryNames';

/**
 * Title and message for an error shown to the user: a `DomainError` becomes its `error.<code>` text in
 * the current language; anything else is an unexpected failure.
 */
export function errorAlert(e: unknown, { t, lang }: Translator): { title: string; message: string } {
  if (e instanceof DomainError) {
    const params = { ...e.params };
    if (e.code === 'category.nameTaken') {
      const template = isTemplateKey(params.template) ? params.template : null;
      params.name = categoryName({ name: String(params.name) || null, template_key: template }, lang);
    }
    return { title: t('common.holdOn'), message: t(`error.${e.code}`, params) };
  }
  return { title: t('common.somethingWrong'), message: e instanceof Error ? e.message : String(e) };
}
