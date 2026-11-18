/**
 * Money, periods and relative dates. Pure functions (no React Native imports) so the tests can run
 * them under Node. Words come from a `Translator` and month/weekday names from `@/i18n/dates`.
 */
import type { Language, Translator } from '@/i18n/core';
import { formatDayMonth, formatDayMonthYear, formatMonthYear } from '@/i18n/dates';

// ---------------------------------------------------------------------------
// Money
// TODO(phase 3): the currency is selectable (rupiah default, §14). Until the currency setting is
// built, every amount is rupiah.

/** The currency symbol shown before amounts and in amount fields. Same in both languages. */
export const CURRENCY_SYMBOL = 'Rp';

/**
 * Formats as "Rp 3.000.000" (or "-Rp 15.000" for negatives).
 * Done by hand rather than Intl so output is identical across Hermes builds/locales.
 */
export const formatRupiah = (amount: number): string =>
  `${amount < 0 ? '-' : ''}${CURRENCY_SYMBOL} ${formatThousands(Math.abs(amount))}`;

/** "+Rp 25.000" for income, "-Rp 15.000" for negatives. */
export const formatSignedRupiah = (amount: number): string =>
  amount > 0 ? `+${formatRupiah(amount)}` : formatRupiah(amount);

/**
 * The same amount with every digit dotted out, keeping the shape: 4500000 → "Rp •.•••.•••".
 * A round dot sits on the middle of the line (Nunito's "*" floats up like an exponent).
 */
export const maskRupiah = (amount: number): string => formatRupiah(amount).replace(/\d/g, '•');

/** Indonesian digit grouping with dots: 5000000 → "5.000.000". */
export const formatThousands = (value: number): string =>
  Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Strips everything but digits: "5.000.000" → 5000000, "" → null. */
export const parseDigits = (text: string): number | null => {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
};

// ---------------------------------------------------------------------------
// Periods (§3)
//
// A period is a month that starts on a user-chosen day (default 1). With start day 25, "October"
// runs 25 Sep – 24 Oct. A period is identified by the month it *ends* in ("2026-10"), TracKar's
// convention. Start days 29–31 clamp to the month's last day (start day 31 in February = 28/29 Feb).
// Changing the start day re-buckets everything; nothing is stored per period.

export const DEFAULT_PERIOD_START_DAY = 1;

const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

/** The period boundary inside calendar month `monthIndex` (may be out of 0–11; Date normalises it). */
const boundary = (year: number, monthIndex: number, startDay: number): Date => {
  const first = new Date(year, monthIndex, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  return new Date(y, m, Math.min(startDay, daysInMonth(y, m)));
};

/** With start day 1 a period starts in its own month; otherwise in the month before. */
const startOffset = (startDay: number) => (startDay === 1 ? 0 : 1);

const keyOf = (year: number, monthIndex: number): string => {
  const d = new Date(year, monthIndex, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const parseKey = (key: string): [number, number] => {
  const [y, m] = key.split('-').map(Number);
  return [y, m - 1];
};

/** Period key of the date `ref`, e.g. "2026-10" for any day from 25 Sep to 24 Oct (start day 25). */
export const periodKey = (ref: Date = new Date(), startDay: number = DEFAULT_PERIOD_START_DAY): string => {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const startedThisMonth = ref.getDate() >= boundary(y, m, startDay).getDate();
  return keyOf(y, m + (startedThisMonth ? 0 : -1) + startOffset(startDay));
};

/** First day (00:00 local) of the period `key`. */
export const periodStart = (key: string, startDay: number = DEFAULT_PERIOD_START_DAY): Date => {
  const [y, m] = parseKey(key);
  return boundary(y, m - startOffset(startDay), startDay);
};

/** First day of the *next* period (00:00 local) — the exclusive end of `key`. */
export const periodEnd = (key: string, startDay: number = DEFAULT_PERIOD_START_DAY): Date => {
  const [y, m] = parseKey(key);
  return boundary(y, m + 1 - startOffset(startDay), startDay);
};

/** Last day (00:00 local) the period `key` covers. */
export const periodLastDay = (key: string, startDay: number = DEFAULT_PERIOD_START_DAY): Date => {
  const end = periodEnd(key, startDay);
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
};

/** [start, end) of the period `key`, as ISO UTC strings — for SQL range queries on `occurred_at`. */
export const periodRange = (key: string, startDay: number = DEFAULT_PERIOD_START_DAY): { start: string; end: string } => ({
  start: periodStart(key, startDay).toISOString(),
  end: periodEnd(key, startDay).toISOString(),
});

/** Moves a key by whole months: keys are monthly whatever the start day. */
export const shiftPeriodKey = (key: string, delta: number): string => {
  const [y, m] = parseKey(key);
  return keyOf(y, m + delta);
};

/** The UI says "month" when periods are calendar months, "period" otherwise. */
export const periodWord = (startDay: number): 'month' | 'period' => (startDay === 1 ? 'month' : 'period');

/** "October 2026" / "Oktober 2026" — the period's name is the month it ends in. */
export const formatPeriodName = (key: string, lang: Language): string => {
  const [y, m] = parseKey(key);
  return formatMonthYear(y, m, lang);
};

/** The dates a period covers, e.g. "25 Sep – 24 Oct". */
export const formatPeriodRange = (key: string, startDay: number, lang: Language): string =>
  `${formatDayMonth(periodStart(key, startDay), lang)} – ${formatDayMonth(periodLastDay(key, startDay), lang)}`;

// ---------------------------------------------------------------------------
// Relative dates

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Calendar days between two dates (not 24-hour blocks); rounding absorbs DST shifts. */
const calendarDays = (from: Date, to: Date) => Math.round((startOfDay(to) - startOfDay(from)) / 86400000);

/** "Just now", "12 min ago", "3 h ago", "Yesterday", or "5 Oct" — for the bell's history. */
export const formatAgo = (iso: string, { t, lang }: Translator, now: Date = new Date()): string => {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return t('ago.justNow');
  if (minutes < 60) return t('ago.minutes', { n: minutes });
  const days = calendarDays(then, now);
  if (days === 0) return t('ago.hours', { n: Math.floor(minutes / 60) });
  if (days === 1) return t('common.yesterday');
  return formatDayMonth(then, lang);
};

/** For "Last backup: …": calendar days; older than ~2 months shows the date. */
export const formatBackupAge = (iso: string | null, { t, lang }: Translator, now: Date = new Date()): string => {
  if (!iso) return t('backupAge.never');
  const then = new Date(iso);
  const days = calendarDays(then, now);
  if (days <= 0) return t('backupAge.today');
  if (days === 1) return t('backupAge.yesterday');
  if (days < 60) return t('backupAge.days', { n: days });
  return t('backupAge.on', { date: formatDayMonthYear(then, lang) });
};
