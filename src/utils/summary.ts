/**
 * The one place totals are computed (§3): Home, Charts and the category screens all call
 * `summarize`, so their numbers can never disagree. Pure (runs under the Node tests).
 *
 * Currencies (§14.1): totals, "left", the top category and the daily average count only the
 * default currency. Transactions in other currencies are listed per currency in `others`
 * ("not in totals") until conversion exists.
 */
import type { Category, TransactionWithCategory } from '@/types/models';
import { localDayKey, periodKey, periodLastDay, periodStart, shiftPeriodKey } from '@/utils/format';
import { CURRENCIES, type Currency } from '@/utils/money';

export interface CurrencyTotals {
  currency: Currency;
  spent: number;
  income: number;
  count: number;
}

export interface CategoryTotal {
  category: Category;
  spent: number;
}

export interface PeriodSummary {
  currency: Currency;
  /** Σ EXPENSE in the default currency. */
  spent: number;
  /** Σ INCOME in the default currency. */
  income: number;
  /** income − spent (may be negative). */
  left: number;
  /** Every transaction in the period, any currency. */
  count: number;
  /** Other currencies used in the period, in `CURRENCIES` order. Not in the totals above. */
  others: CurrencyTotals[];
  /** Expense categories by spending (default currency), largest first; ties by the user's order. */
  byCategory: CategoryTotal[];
  /** spent ÷ days counted (rounded); 0 when no day has started yet. */
  dailyAverage: number;
  /** Days the average divides by: the days so far in the current period, all of them in a past one. */
  daysCounted: number;
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

/** Days of period `key` up to and including `now` (all of them once it's over; 0 before it starts). */
export function daysCounted(key: string, startDay: number, now: Date = new Date()): number {
  const first = periodStart(key, startDay);
  const last = periodLastDay(key, startDay);
  if (now < first) return 0;
  const until = now > last ? last : now;
  return daysBetween(first, until) + 1;
}

/** Spent, income and count per currency, for any set of rows (a period, a search). `summarize` builds on it. */
export function totalsByCurrency(rows: readonly TransactionWithCategory[]): Map<Currency, CurrencyTotals> {
  const totals = new Map<Currency, CurrencyTotals>();
  for (const r of rows) {
    const t = totals.get(r.currency) ?? { currency: r.currency, spent: 0, income: 0, count: 0 };
    t.count += 1;
    if (r.kind === 'EXPENSE') t.spent += r.amount;
    else t.income += r.amount;
    totals.set(r.currency, t);
  }
  return totals;
}

export function summarize(
  rows: readonly TransactionWithCategory[],
  currency: Currency,
  period: { key: string; startDay: number; now?: Date },
): PeriodSummary {
  const totals = totalsByCurrency(rows);
  const perCategory = new Map<number, CategoryTotal>();
  for (const r of rows) {
    if (r.kind === 'EXPENSE' && r.currency === currency) {
      const c = perCategory.get(r.category_id) ?? { category: r.category, spent: 0 };
      c.spent += r.amount;
      perCategory.set(r.category_id, c);
    }
  }
  const main = totals.get(currency) ?? { currency, spent: 0, income: 0, count: 0 };
  const days = daysCounted(period.key, period.startDay, period.now);
  return {
    currency,
    spent: main.spent,
    income: main.income,
    left: main.income - main.spent,
    count: rows.length,
    others: CURRENCIES.filter((c) => c !== currency && totals.has(c)).map((c) => totals.get(c)!),
    byCategory: [...perCategory.values()].sort((a, b) => b.spent - a.spent || a.category.position - b.category.position),
    dailyAverage: days > 0 ? Math.round(main.spent / days) : 0,
    daysCounted: days,
  };
}

export interface DayGroup {
  /** Local date "YYYY-MM-DD". */
  key: string;
  /** 00:00 local of that day. */
  date: Date;
  items: TransactionWithCategory[];
  /** Σ EXPENSE that day in the default currency (the header's figure). */
  spent: number;
  /** Σ INCOME that day in the default currency (shown when nothing was spent). */
  income: number;
}

/** Newest-first rows → day groups (newest day first), each with its day total (§4). */
export function groupByDay(rows: readonly TransactionWithCategory[], currency: Currency): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const r of rows) {
    const date = startOfDay(new Date(r.occurred_at));
    const key = localDayKey(date);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, date, items: [], spent: 0, income: 0 };
      groups.push(g);
    }
    g.items.push(r);
    if (r.currency === currency) {
      if (r.kind === 'EXPENSE') g.spent += r.amount;
      else g.income += r.amount;
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Charts (§9). Every figure below comes from `summarize`'s rules: EXPENSE in the default currency.

export interface CategoryShare extends CategoryTotal {
  /** spent ÷ the period's spent, 0–1. */
  share: number;
}

export interface CategoryRanking {
  /** The largest categories, largest first. */
  top: CategoryShare[];
  /** The rest, folded into "Other" (empty when nothing is folded). */
  rest: CategoryShare[];
  /** Σ spent of `rest`. */
  restSpent: number;
}

/**
 * Ranked category bars: the top `limit` categories plus "Other". "Other" is only used when it would
 * hold at least two categories — folding a single one would just hide its name.
 */
export function rankCategories(summary: PeriodSummary, limit = 7): CategoryRanking {
  const all = summary.byCategory
    .filter((c) => c.spent > 0)
    .map((c) => ({ ...c, share: summary.spent > 0 ? c.spent / summary.spent : 0 }));
  if (all.length <= limit + 1) return { top: all, rest: [], restSpent: 0 };
  const rest = all.slice(limit);
  return { top: all.slice(0, limit), rest, restSpent: rest.reduce((sum, c) => sum + c.spent, 0) };
}

/** A share as a whole percentage: "34%"; "<1%" for a sliver that would round to 0. */
export function formatShare(share: number): string {
  if (share <= 0) return '0%';
  const pct = Math.round(share * 100);
  return pct === 0 ? '<1%' : `${pct}%`;
}

export interface DaySpend {
  /** Local date "YYYY-MM-DD". */
  key: string;
  /** 00:00 local. */
  date: Date;
  /** Σ EXPENSE that day in the default currency. */
  spent: number;
}

/** One entry per day of period `key`, first day first, each with what was spent that day (§9.3). */
export function spendByDay(rows: readonly TransactionWithCategory[], currency: Currency, period: { key: string; startDay: number }): DaySpend[] {
  const byKey = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== 'EXPENSE' || r.currency !== currency) continue;
    const k = localDayKey(new Date(r.occurred_at));
    byKey.set(k, (byKey.get(k) ?? 0) + r.amount);
  }
  const first = periodStart(period.key, period.startDay);
  const last = periodLastDay(period.key, period.startDay);
  const days: DaySpend[] = [];
  for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = localDayKey(d);
    days.push({ key, date: d, spent: byKey.get(key) ?? 0 });
  }
  return days;
}

export interface TrendPoint {
  /** Period key. */
  key: string;
  /** `summarize(...).spent` for that period. */
  spent: number;
  /** `summarize(...).income` for that period. */
  income: number;
}

/**
 * The periods a trend shows (§9.2): up to `count` periods ending at the shown one (or the current
 * one, if a future period is shown), starting no earlier than the first period with data.
 * `firstKey` null (no data at all) → none.
 */
export function trendKeys(shown: string, current: string, firstKey: string | null, count = 6): string[] {
  if (!firstKey) return [];
  const last = shown < current ? shown : current;
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const k = shiftPeriodKey(last, -i);
    if (k >= firstKey) keys.push(k);
  }
  return keys;
}

/** Each period's spent and income, from rows covering all of `keys` — through `summarize`, so they match Home. */
export function trendPoints(rows: readonly TransactionWithCategory[], currency: Currency, keys: readonly string[], startDay: number): TrendPoint[] {
  const buckets = new Map<string, TransactionWithCategory[]>(keys.map((k) => [k, []]));
  for (const r of rows) buckets.get(periodKey(new Date(r.occurred_at), startDay))?.push(r);
  return keys.map((key) => {
    const s = summarize(buckets.get(key)!, currency, { key, startDay });
    return { key, spent: s.spent, income: s.income };
  });
}
