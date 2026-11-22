/**
 * The bell's history (§8.7) — all of its SQL. No React Native imports: the tests run this against real
 * SQLite. Rows store *what happened* (a kind and JSON params), never sentences: `describeActivity`
 * (`@/utils/activityText`) writes them out in the current language when shown. Not backed up.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { listTransactions } from '@/db/transactionsRepository';
import type { TemplateKey } from '@/constants/categories';
import type { Category, TransactionWithCategory } from '@/types/models';
import { periodEnd, periodKey, periodLastDay, periodRange, periodStart, shiftPeriodKey } from '@/utils/format';
import type { Currency } from '@/utils/money';
import { summarize, trendPoints } from '@/utils/summary';

/** A category as it was when the message was written (it may be renamed or deleted later). */
export interface CategorySnapshot {
  id: number;
  name: string | null;
  template_key: TemplateKey | null;
}

/** The biggest single purchase of a period or year. */
export interface BiggestPurchase {
  amount: number;
  note: string;
  occurred_at: string;
  category: CategorySnapshot;
}

/** A top category that was clearly above or below its usual (the average of the 3 periods before). */
export interface UsualComparison extends CategorySnapshot {
  direction: 'up' | 'down';
}

export interface ActivityParams {
  /**
   * A period ended: its totals, top 3 categories, and (since 0.3.0, absent in older rows) its biggest
   * purchase and how the top categories compare with usual.
   */
  recap: {
    period: string;
    startDay: number;
    currency: Currency;
    spent: number;
    income: number;
    left: number;
    count: number;
    top: (CategorySnapshot & { spent: number })[];
    biggest?: BiggestPurchase | null;
    compare?: UsualComparison[];
  };
  /** The last days of a period began ("tanggal tua"): what's left and about how much per day. */
  tanggal_tua: { period: string; startDay: number; currency: Currency; daysLeft: number; left: number; perDay: number };
  /** A year of periods ended (keys YYYY-01…YYYY-12): totals, top categories, biggest and quietest month, biggest purchase. */
  year_recap: {
    year: number;
    startDay: number;
    currency: Currency;
    spent: number;
    income: number;
    count: number;
    top: (CategorySnapshot & { spent: number })[];
    highest: { period: string; spent: number } | null;
    lowest: { period: string; spent: number } | null;
    biggest: BiggestPurchase | null;
  };
  /** A backup was restored; `undoUntil` null when there was nothing to keep a safety copy of. */
  restore: { exportedAt: string; categories: number; transactions: number; undoUntil: string | null };
  /** "Undo restore" put the earlier data back. */
  restore_undone: Record<string, never>;
  /** First launch of a new version. */
  whats_new: { version: string };
}
export type ActivityKind = keyof ActivityParams;
export const ACTIVITY_KINDS: readonly ActivityKind[] = ['recap', 'tanggal_tua', 'year_recap', 'restore', 'restore_undone', 'whats_new'];

export type Activity = {
  [K in ActivityKind]: { id: number; kind: K; params: ActivityParams[K]; created_at: string };
}[ActivityKind];

/** The history keeps whichever is smaller: the newest N rows, or the last D days. */
export const ACTIVITY_MAX_ROWS = 50;
export const ACTIVITY_MAX_DAYS = 60;

/** Adds a row and trims old ones. Returns false when `dedupeKey` already exists. */
export async function addActivity<K extends ActivityKind>(
  db: SQLiteDatabase,
  kind: K,
  params: ActivityParams[K],
  options: { dedupeKey?: string; now?: Date } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO Activity (kind, params, dedupe_key, created_at) VALUES (?, ?, ?, ?)',
    kind,
    JSON.stringify(params),
    options.dedupeKey ?? null,
    now.toISOString(),
  );
  if (result.changes === 0) return false;
  const cutoff = new Date(now.getTime() - ACTIVITY_MAX_DAYS * 86_400_000).toISOString();
  await db.runAsync(
    'DELETE FROM Activity WHERE created_at < ? OR id NOT IN (SELECT id FROM Activity ORDER BY created_at DESC, id DESC LIMIT ?)',
    cutoff,
    ACTIVITY_MAX_ROWS,
  );
  return true;
}

/** Newest first. Rows of a kind this version doesn't know, or with unreadable params, are skipped. */
export async function listActivity(db: SQLiteDatabase): Promise<Activity[]> {
  const rows = await db.getAllAsync<{ id: number; kind: string; params: string; created_at: string }>(
    'SELECT id, kind, params, created_at FROM Activity ORDER BY created_at DESC, id DESC',
  );
  const out: Activity[] = [];
  for (const r of rows) {
    if (!(ACTIVITY_KINDS as readonly string[]).includes(r.kind)) continue;
    try {
      const params: unknown = JSON.parse(r.params);
      if (params && typeof params === 'object') out.push({ id: r.id, kind: r.kind, params, created_at: r.created_at } as Activity);
    } catch {
      // Unreadable: leave it out.
    }
  }
  return out;
}

/** Whether a row with this `dedupeKey` exists — lets the launch checks skip work already done. */
export async function hasActivity(db: SQLiteDatabase, dedupeKey: string): Promise<boolean> {
  return !!(await db.getFirstAsync<{ one: number }>('SELECT 1 AS one FROM Activity WHERE dedupe_key = ? LIMIT 1', dedupeKey));
}

/** How many rows arrived after `seenAt` (the last time the bell was opened); null = never opened. */
export async function countUnreadActivity(db: SQLiteDatabase, seenAt: string | null): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM Activity WHERE ? IS NULL OR created_at > ?', seenAt, seenAt);
  return row?.n ?? 0;
}

export async function clearActivity(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM Activity');
}

export async function hasAnyTransactions(db: SQLiteDatabase): Promise<boolean> {
  return !!(await db.getFirstAsync<{ one: number }>('SELECT 1 AS one FROM Transactions LIMIT 1'));
}

const DAY_MS = 86_400_000;
/** "Tanggal tua" starts when this many days (today included) are left in the period. */
export const TANGGAL_TUA_DAYS = 7;
/** A top category counts as above / below usual from this ratio to its 3-period average. */
const USUAL_UP = 1.25;
const USUAL_DOWN = 0.75;

const snapshot = (c: Category): CategorySnapshot => ({ id: c.id, name: c.name, template_key: c.template_key });

const topCategories = (s: ReturnType<typeof summarize>) =>
  s.byCategory
    .filter((c) => c.spent > 0)
    .slice(0, 3)
    .map((c) => ({ ...snapshot(c.category), spent: c.spent }));

/** The biggest expense in `currency` (the earliest one on a tie), or null. */
function biggestPurchase(rows: readonly TransactionWithCategory[], currency: Currency): BiggestPurchase | null {
  let best: TransactionWithCategory | null = null;
  for (const r of rows) {
    if (r.kind !== 'EXPENSE' || r.currency !== currency) continue;
    if (!best || r.amount > best.amount || (r.amount === best.amount && r.occurred_at < best.occurred_at)) best = r;
  }
  return best && { amount: best.amount, note: best.note, occurred_at: best.occurred_at, category: snapshot(best.category) };
}

/**
 * The top categories of `period` against their usual: the average of the 3 periods before it (zeros count).
 * Only when all 3 have data — otherwise "usual" would be a guess — and never for a category with no history.
 */
async function compareWithUsual(
  db: SQLiteDatabase,
  period: string,
  startDay: number,
  currency: Currency,
  top: (CategorySnapshot & { spent: number })[],
): Promise<UsualComparison[]> {
  const keys = [1, 2, 3].map((n) => shiftPeriodKey(period, -n));
  const rows = await listTransactions(db, { start: periodStart(keys[2], startDay).toISOString(), end: periodStart(period, startDay).toISOString() });
  const buckets = new Map<string, TransactionWithCategory[]>(keys.map((k) => [k, []]));
  for (const r of rows) buckets.get(periodKey(new Date(r.occurred_at), startDay))?.push(r);
  if ([...buckets.values()].some((b) => b.length === 0)) return [];
  const spentBy = keys.map((k) => summarize(buckets.get(k)!, currency, { key: k, startDay }).byCategory);
  const out: UsualComparison[] = [];
  for (const c of top) {
    const usual = spentBy.reduce((sum, cats) => sum + (cats.find((x) => x.category.id === c.id)?.spent ?? 0), 0) / keys.length;
    if (usual <= 0) continue;
    const ratio = c.spent / usual;
    if (ratio >= USUAL_UP || ratio <= USUAL_DOWN) out.push({ id: c.id, name: c.name, template_key: c.template_key, direction: ratio >= USUAL_UP ? 'up' : 'down' });
  }
  return out;
}

/**
 * The recap of period `period` (§8.7): spent, income, left and the top 3 categories, from `summarize`
 * so it matches Home; its biggest purchase; the top categories against their usual. Null when nothing
 * was logged in it (no recap for an empty period).
 */
export async function buildRecap(
  db: SQLiteDatabase,
  period: string,
  startDay: number,
  currency: Currency,
): Promise<ActivityParams['recap'] | null> {
  const rows = await listTransactions(db, periodRange(period, startDay));
  if (rows.length === 0) return null;
  const s = summarize(rows, currency, { key: period, startDay });
  const top = topCategories(s);
  return {
    period,
    startDay,
    currency,
    spent: s.spent,
    income: s.income,
    left: s.left,
    count: s.count,
    top,
    biggest: biggestPurchase(rows, currency),
    compare: await compareWithUsual(db, period, startDay, currency, top),
  };
}

/**
 * "Tanggal tua" (§8.7): within the last `TANGGAL_TUA_DAYS` days of `period`, what's left and about how much
 * per day. Only when there is income in the period and something left — without income "left" means
 * nothing, and the bell never brings bad news (§5). Null otherwise.
 */
export async function buildTanggalTua(
  db: SQLiteDatabase,
  period: string,
  startDay: number,
  currency: Currency,
  now: Date = new Date(),
): Promise<ActivityParams['tanggal_tua'] | null> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((periodLastDay(period, startDay).getTime() - today.getTime()) / DAY_MS) + 1;
  if (daysLeft < 1 || daysLeft > TANGGAL_TUA_DAYS) return null;
  const s = summarize(await listTransactions(db, periodRange(period, startDay)), currency, { key: period, startDay, now });
  if (s.income <= 0 || s.left <= 0) return null;
  return { period, startDay, currency, daysLeft, left: s.left, perDay: Math.floor(s.left / daysLeft) };
}

/**
 * The year recap (§8.7) for the periods keyed `year`-01 … `year`-12 (so with start day 25 the year runs
 * 25 Dec – 24 Dec): totals, top 3 categories, the biggest and quietest month (of those with spending; the
 * quietest only when there are two), the biggest purchase. Null for a year with nothing logged.
 */
export async function buildYearRecap(db: SQLiteDatabase, year: number, startDay: number, currency: Currency): Promise<ActivityParams['year_recap'] | null> {
  const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const rows = await listTransactions(db, { start: periodStart(keys[0], startDay).toISOString(), end: periodEnd(keys[11], startDay).toISOString() });
  if (rows.length === 0) return null;
  const points = trendPoints(rows, currency, keys, startDay).filter((p) => p.spent > 0);
  const s = summarize(rows, currency, { key: keys[11], startDay });
  const byMost = [...points].sort((a, b) => b.spent - a.spent || a.key.localeCompare(b.key));
  return {
    year,
    startDay,
    currency,
    spent: s.spent,
    income: s.income,
    count: s.count,
    top: topCategories(s),
    highest: byMost[0] ? { period: byMost[0].key, spent: byMost[0].spent } : null,
    lowest: byMost.length >= 2 ? { period: byMost[byMost.length - 1].key, spent: byMost[byMost.length - 1].spent } : null,
    biggest: biggestPurchase(rows, currency),
  };
}
