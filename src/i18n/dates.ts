/**
 * Month and weekday names per language (§6.5). Own tables instead of `Intl`, so every phone shows
 * the same thing (Android's ICU writes "Sept", and some builds ship without Indonesian data).
 * Pure: no React Native imports, so the tests can run it under Node.
 */
import type { Language } from './core';

/** Three letters, always. */
export const MONTHS_SHORT: Record<Language, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
};

export const MONTHS_LONG: Record<Language, readonly string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
};

/** Monday first (the week starts on Monday in both languages). */
export const WEEKDAYS_SHORT: Record<Language, readonly string[]> = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  id: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
};

/** One letter for tight places (calendar headers, the day strip). Monday first. */
export const WEEKDAYS_NARROW: Record<Language, readonly string[]> = {
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  id: ['S', 'S', 'R', 'K', 'J', 'S', 'M'],
};

/** JS `getDay()` is Sunday = 0; the tables are Monday first. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export const weekdayShort = (d: Date, lang: Language) => WEEKDAYS_SHORT[lang][mondayIndex(d)];
export const weekdayNarrow = (d: Date, lang: Language) => WEEKDAYS_NARROW[lang][mondayIndex(d)];

/** "6 Oct" / "6 Okt" */
export const formatDayMonth = (d: Date, lang: Language) => `${d.getDate()} ${MONTHS_SHORT[lang][d.getMonth()]}`;

/** "6 Oct 2026" / "6 Okt 2026" */
export const formatDayMonthYear = (d: Date, lang: Language) => `${formatDayMonth(d, lang)} ${d.getFullYear()}`;

/** "Mon, 6 Oct" / "Sen, 6 Okt" — day headers in lists. */
export const formatWeekdayDayMonth = (d: Date, lang: Language) => `${weekdayShort(d, lang)}, ${formatDayMonth(d, lang)}`;

/** "October 2026" / "Oktober 2026" */
export const formatMonthYear = (year: number, monthIndex: number, lang: Language) => `${MONTHS_LONG[lang][monthIndex]} ${year}`;

/** 24-hour "14:05" in both languages. */
export const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
