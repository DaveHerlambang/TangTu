/**
 * Writes a bell row out in the current language (§6.5, §8.7): rows store a kind and params, and the
 * words come from the dictionaries at the moment they're shown. Pure (runs under the Node tests).
 */
import { findRelease } from '@/constants/releaseNotes';
import type { Activity } from '@/db/activityRepository';
import type { Translator } from '@/i18n/core';
import { formatDayMonth, formatDayMonthYear, formatTime } from '@/i18n/dates';
import { categoryName } from '@/utils/categoryNames';
import { formatPeriodName, formatPeriodRange } from '@/utils/format';
import { formatMoney } from '@/utils/money';

export interface ActivityText {
  title: string;
  /** May span several lines. The first line is the preview in the list. */
  body: string;
}

export function describeActivity(a: Activity, translator: Translator): ActivityText {
  const { t, tp, lang } = translator;
  switch (a.kind) {
    case 'recap': {
      const p = a.params;
      const money = (n: number) => formatMoney(n, p.currency);
      const lines = [
        t('activity.recap.totals', { spent: money(p.spent), income: money(p.income), left: money(p.left) }),
        tp('count.transactions', p.count),
      ];
      if (p.top.length > 0) {
        lines.push(t('activity.recap.top', { list: p.top.map((c) => `${categoryName(c, lang)} ${money(c.spent)}`).join(' · ') }));
      }
      lines.push(formatPeriodRange(p.period, p.startDay, lang));
      return { title: t('activity.recap.title', { period: formatPeriodName(p.period, lang) }), body: lines.join('\n') };
    }
    case 'restore': {
      const p = a.params;
      const body = t('activity.restore.body', {
        date: formatDayMonthYear(new Date(p.exportedAt), lang),
        categories: tp('count.categories', p.categories),
        transactions: tp('count.transactions', p.transactions),
      });
      const undo = p.undoUntil ? t('activity.restore.undo', { date: formatDayMonthYear(new Date(p.undoUntil), lang) }) : null;
      return { title: t('activity.restore.title'), body: undo ? `${body}\n${undo}` : body };
    }
    case 'restore_undone':
      return { title: t('activity.restoreUndone.title'), body: t('activity.restoreUndone.body') };
    case 'whats_new': {
      const release = findRelease(a.params.version);
      return { title: t('activity.whatsNew.title', { version: a.params.version }), body: release ? release[lang].summary : '' };
    }
  }
}

/** "6 Oct, 14:05" — the time a row was written, in its detail sheet. */
export const formatActivityTime = (iso: string, lang: Translator['lang']): string => {
  const d = new Date(iso);
  return `${formatDayMonth(d, lang)}, ${formatTime(d)}`;
};
