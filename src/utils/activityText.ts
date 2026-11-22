/**
 * Writes a bell row out in the current language (§6.5, §8.7): rows store a kind and params, and the
 * words come from the dictionaries at the moment they're shown. Pure (runs under the Node tests).
 */
import { findRelease } from '@/constants/releaseNotes';
import type { Activity, BiggestPurchase, UsualComparison } from '@/db/activityRepository';
import type { Translator } from '@/i18n/core';
import { formatDayMonth, formatDayMonthYear, formatTime } from '@/i18n/dates';
import { categoryName } from '@/utils/categoryNames';
import { formatPeriodName, formatPeriodRange, formatPeriodShort } from '@/utils/format';
import { formatMoney } from '@/utils/money';

export interface ActivityText {
  title: string;
  /** May span several lines. The first line is the preview in the list. */
  body: string;
}

export function describeActivity(a: Activity, translator: Translator): ActivityText {
  const { t, tp, lang } = translator;
  /** "Biggest: Rp 1.200.000 (Flight home)" — the note when there is one, else the category. */
  const biggest = (b: BiggestPurchase | null | undefined, money: (n: number) => string) =>
    b ? t('activity.recap.biggest', { amount: money(b.amount), what: b.note.trim() || categoryName(b.category, lang) }) : null;
  switch (a.kind) {
    case 'recap': {
      const p = a.params;
      const money = (n: number) => formatMoney(n, p.currency);
      // Without income, "left" would only be minus the spending: show the spending alone (§5, as on Home).
      const lines: (string | null)[] = [
        p.income > 0
          ? t('activity.recap.totals', { spent: money(p.spent), income: money(p.income), left: money(p.left) })
          : t('activity.recap.spentOnly', { spent: money(p.spent) }),
        tp('count.transactions', p.count),
      ];
      if (p.top.length > 0) {
        lines.push(t('activity.recap.top', { list: p.top.map((c) => `${categoryName(c, lang)} ${money(c.spent)}`).join(' · ') }));
      }
      lines.push(biggest(p.biggest, money));
      const names = (dir: UsualComparison['direction']) =>
        (p.compare ?? [])
          .filter((c) => c.direction === dir)
          .map((c) => categoryName(c, lang))
          .join(', ');
      if (names('up')) lines.push(t('activity.recap.higher', { list: names('up') }));
      if (names('down')) lines.push(t('activity.recap.lower', { list: names('down') }));
      lines.push(formatPeriodRange(p.period, p.startDay, lang));
      return { title: t('activity.recap.title', { period: formatPeriodName(p.period, lang) }), body: lines.filter(Boolean).join('\n') };
    }
    case 'tanggal_tua': {
      const p = a.params;
      const money = (n: number) => formatMoney(n, p.currency);
      return {
        title: t('activity.tanggalTua.title'),
        body: [
          t('activity.tanggalTua.body', {
            days: tp('count.days', p.daysLeft),
            period: formatPeriodName(p.period, lang),
            left: money(p.left),
            perDay: money(p.perDay),
          }),
          formatPeriodRange(p.period, p.startDay, lang),
        ].join('\n'),
      };
    }
    case 'year_recap': {
      const p = a.params;
      const money = (n: number) => formatMoney(n, p.currency);
      const month = (m: { period: string; spent: number }) => `${formatPeriodShort(m.period, lang)} ${money(m.spent)}`;
      const lines: (string | null)[] = [
        p.income > 0
          ? t('activity.yearRecap.totals', { spent: money(p.spent), income: money(p.income) })
          : t('activity.recap.spentOnly', { spent: money(p.spent) }),
        tp('count.transactions', p.count),
        p.top.length > 0 ? t('activity.recap.top', { list: p.top.map((c) => `${categoryName(c, lang)} ${money(c.spent)}`).join(' · ') }) : null,
        p.highest ? t('activity.yearRecap.highest', { month: month(p.highest) }) : null,
        p.lowest ? t('activity.yearRecap.lowest', { month: month(p.lowest) }) : null,
        biggest(p.biggest, money),
      ];
      return { title: t('activity.yearRecap.title', { year: String(p.year) }), body: lines.filter(Boolean).join('\n') };
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
