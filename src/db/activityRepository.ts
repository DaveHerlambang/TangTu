/**
 * The bell's history (§8.7) — all of its SQL. No React Native imports: the tests run this against real
 * SQLite. Rows store *what happened* (a kind and JSON params), never sentences: `describeActivity`
 * (`@/utils/activityText`) writes them out in the current language when shown. Not backed up.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { listTransactions } from '@/db/transactionsRepository';
import type { TemplateKey } from '@/constants/categories';
import { periodRange } from '@/utils/format';
import type { Currency } from '@/utils/money';
import { summarize } from '@/utils/summary';

/** A category as it was when the message was written (it may be renamed or deleted later). */
export interface CategorySnapshot {
  id: number;
  name: string | null;
  template_key: TemplateKey | null;
}

export interface ActivityParams {
  /** A period ended: its totals (default currency at the time) and top 3 categories. */
  recap: { period: string; startDay: number; currency: Currency; spent: number; income: number; left: number; count: number; top: (CategorySnapshot & { spent: number })[] };
  /** A backup was restored; `undoUntil` null when there was nothing to keep a safety copy of. */
  restore: { exportedAt: string; categories: number; transactions: number; undoUntil: string | null };
  /** "Undo restore" put the earlier data back. */
  restore_undone: Record<string, never>;
  /** First launch of a new version. */
  whats_new: { version: string };
}
export type ActivityKind = keyof ActivityParams;
export const ACTIVITY_KINDS: readonly ActivityKind[] = ['recap', 'restore', 'restore_undone', 'whats_new'];

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

/**
 * The recap of period `period` (§8.7): spent, income, left and the top 3 categories, from `summarize`
 * so it matches Home. Null when nothing was logged in it (no recap for an empty period).
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
  return {
    period,
    startDay,
    currency,
    spent: s.spent,
    income: s.income,
    left: s.left,
    count: s.count,
    top: s.byCategory
      .filter((c) => c.spent > 0)
      .slice(0, 3)
      .map((c) => ({ id: c.category.id, name: c.category.name, template_key: c.category.template_key, spent: c.spent })),
  };
}
