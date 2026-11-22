/**
 * All SQL for `Transactions` (§3). No React Native imports: the tests run this against real SQLite.
 * Totals are not computed here but by `summarize` (`@/utils/summary`), the one function every screen uses.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { getCategory, toCategory, type CategoryRow } from '@/db/categoriesRepository';
import { DomainError } from '@/db/errors';
import type { Category, CategoryKind, Transaction, TransactionWithCategory } from '@/types/models';
import { DEFAULT_CURRENCY, isCurrency, type Currency } from '@/utils/money';

export interface TransactionInput {
  kind: CategoryKind;
  amount: number;
  currency: Currency;
  categoryId: number;
  note: string;
  /** ISO UTC. */
  occurredAt: string;
}

export const NOTE_MAX_LENGTH = 200;

interface TransactionRow {
  id: number;
  kind: CategoryKind;
  amount: number;
  currency: string;
  category_id: number;
  note: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  kind: r.kind,
  amount: r.amount,
  // A currency this version doesn't know (e.g. from a newer backup) can't be formatted; show it as the default.
  currency: isCurrency(r.currency) ? r.currency : DEFAULT_CURRENCY,
  category_id: r.category_id,
  note: r.note,
  occurred_at: r.occurred_at,
  created_at: r.created_at,
  updated_at: r.updated_at,
});

const T_COLUMNS = 't.id, t.kind, t.amount, t.currency, t.category_id, t.note, t.occurred_at, t.created_at, t.updated_at';
const C_COLUMNS =
  'c.id AS c_id, c.name AS c_name, c.template_key AS c_template_key, c.kind AS c_kind, c.icon AS c_icon, c.tint AS c_tint, c.position AS c_position, c.archived_at AS c_archived_at, c.created_at AS c_created_at';

type JoinedRow = TransactionRow & { [K in keyof CategoryRow as `c_${K}`]: CategoryRow[K] };

const toJoined = (r: JoinedRow): TransactionWithCategory => ({
  ...toTransaction(r),
  category: toCategory({
    id: r.c_id,
    name: r.c_name,
    template_key: r.c_template_key,
    kind: r.c_kind,
    icon: r.c_icon,
    tint: r.c_tint,
    position: r.c_position,
    archived_at: r.c_archived_at,
    created_at: r.c_created_at,
  }),
});

async function validate(db: SQLiteDatabase, input: TransactionInput) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new DomainError('transaction.amount');
  if (!isCurrency(input.currency)) throw new DomainError('transaction.amount');
  const category = await getCategory(db, input.categoryId);
  // The sign comes from `kind`, so it must match the category's (an Income category can't hold spending).
  if (!category || category.kind !== input.kind) throw new DomainError('transaction.category');
  return { note: input.note.trim().replace(/\s+/g, ' ').slice(0, NOTE_MAX_LENGTH) };
}

export async function createTransaction(db: SQLiteDatabase, input: TransactionInput): Promise<number> {
  const { note } = await validate(db, input);
  const now = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO Transactions (kind, amount, currency, category_id, note, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    input.kind,
    input.amount,
    input.currency,
    input.categoryId,
    note,
    input.occurredAt,
    now,
    now,
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(db: SQLiteDatabase, id: number, input: TransactionInput): Promise<void> {
  if (!(await getTransaction(db, id))) throw new DomainError('transaction.notFound');
  const { note } = await validate(db, input);
  await db.runAsync(
    'UPDATE Transactions SET kind = ?, amount = ?, currency = ?, category_id = ?, note = ?, occurred_at = ?, updated_at = ? WHERE id = ?',
    input.kind,
    input.amount,
    input.currency,
    input.categoryId,
    note,
    input.occurredAt,
    new Date().toISOString(),
    id,
  );
}

export async function getTransaction(db: SQLiteDatabase, id: number): Promise<TransactionWithCategory | null> {
  const row = await db.getFirstAsync<JoinedRow>(
    `SELECT ${T_COLUMNS}, ${C_COLUMNS} FROM Transactions t JOIN Categories c ON c.id = t.category_id WHERE t.id = ?`,
    id,
  );
  return row ? toJoined(row) : null;
}

/** Transactions with `start <= occurred_at < end` (ISO UTC), newest first; only `categoryId`'s if given. */
export async function listTransactions(
  db: SQLiteDatabase,
  range: { start: string; end: string; categoryId?: number },
): Promise<TransactionWithCategory[]> {
  const byCategory = range.categoryId !== undefined;
  const params = [range.start, range.end, ...(byCategory ? [range.categoryId!] : [])];
  const rows = await db.getAllAsync<JoinedRow>(
    `SELECT ${T_COLUMNS}, ${C_COLUMNS}
       FROM Transactions t JOIN Categories c ON c.id = t.category_id
      WHERE t.occurred_at >= ? AND t.occurred_at < ?${byCategory ? ' AND t.category_id = ?' : ''}
      ORDER BY t.occurred_at DESC, t.id DESC`,
    ...params,
  );
  return rows.map(toJoined);
}

/** When the oldest transaction happened (ISO UTC) — overall, or in one category; null when there is none. Trends start there. */
export async function firstTransactionAt(db: SQLiteDatabase, categoryId?: number): Promise<string | null> {
  const row =
    categoryId === undefined
      ? await db.getFirstAsync<{ first: string | null }>('SELECT MIN(occurred_at) AS first FROM Transactions')
      : await db.getFirstAsync<{ first: string | null }>('SELECT MIN(occurred_at) AS first FROM Transactions WHERE category_id = ?', categoryId);
  return row?.first ?? null;
}

export const SEARCH_LIMIT = 200;

/**
 * Search (§5): transactions whose note contains `text`, or whose category is one of `nameMatchIds`
 * (categories whose *shown* name matches — worked out by the caller, since an untouched template's
 * name lives in the dictionary, not in SQL). `categoryIds` narrows to those categories (the filter
 * chips). Newest first, at most `limit`.
 */
export async function searchTransactions(
  db: SQLiteDatabase,
  query: {
    text: string;
    nameMatchIds: readonly number[];
    categoryIds: readonly number[];
    /** [start, end) as ISO UTC strings (a period range, or picked days); absent = all time. */
    range?: { start: string; end: string };
    limit?: number;
  },
): Promise<TransactionWithCategory[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.range) {
    where.push('t.occurred_at >= ? AND t.occurred_at < ?');
    params.push(query.range.start, query.range.end);
  }
  const text = query.text.trim();
  if (text) {
    // `!` escapes LIKE's wildcards, so "50%" or "a_b" match literally.
    const like = `%${text.replace(/[!%_]/g, (ch) => `!${ch}`)}%`;
    const byName = query.nameMatchIds.length ? ` OR t.category_id IN (${query.nameMatchIds.map(() => '?').join(', ')})` : '';
    where.push(`(t.note LIKE ? ESCAPE '!'${byName})`);
    params.push(like, ...query.nameMatchIds);
  }
  if (query.categoryIds.length) {
    where.push(`t.category_id IN (${query.categoryIds.map(() => '?').join(', ')})`);
    params.push(...query.categoryIds);
  }
  const rows = await db.getAllAsync<JoinedRow>(
    `SELECT ${T_COLUMNS}, ${C_COLUMNS}
       FROM Transactions t JOIN Categories c ON c.id = t.category_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY t.occurred_at DESC, t.id DESC
      LIMIT ?`,
    ...params,
    query.limit ?? SEARCH_LIMIT,
  );
  return rows.map(toJoined);
}

/** Every category that has transactions (archived ones too — they're in history): the search filter chips. Expense first, then income, in the user's order. */
export async function listUsedCategories(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT c.* FROM Categories c
      WHERE EXISTS (SELECT 1 FROM Transactions t WHERE t.category_id = c.id)
      ORDER BY CASE c.kind WHEN 'EXPENSE' THEN 0 ELSE 1 END, c.archived_at IS NOT NULL, c.position, c.id`,
  );
  return rows.map(toCategory);
}

/** Deletes and returns the row, so the Undo toast can put it back with `putTransaction`. */
export async function deleteTransaction(db: SQLiteDatabase, id: number): Promise<Transaction> {
  const existing = await getTransaction(db, id);
  if (!existing) throw new DomainError('transaction.notFound');
  await db.runAsync('DELETE FROM Transactions WHERE id = ?', id);
  const { category: _category, ...row } = existing;
  return row;
}

/** Writes a transaction back exactly as it was (same id and dates) — Undo after an edit or a delete. */
export async function putTransaction(db: SQLiteDatabase, t: Transaction): Promise<void> {
  const exists = await db.getFirstAsync<{ id: number }>('SELECT id FROM Transactions WHERE id = ?', t.id);
  const values = [t.kind, t.amount, t.currency, t.category_id, t.note, t.occurred_at, t.created_at, t.updated_at] as const;
  if (exists) {
    await db.runAsync(
      'UPDATE Transactions SET kind = ?, amount = ?, currency = ?, category_id = ?, note = ?, occurred_at = ?, created_at = ?, updated_at = ? WHERE id = ?',
      ...values,
      t.id,
    );
  } else {
    await db.runAsync(
      'INSERT INTO Transactions (id, kind, amount, currency, category_id, note, occurred_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      t.id,
      ...values,
    );
  }
}
