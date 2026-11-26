/**
 * All data access for `transactions` (§3), over Supabase since 0.5.0. Totals are not computed here but by
 * `summarize` (`@/utils/summary`), the one function every screen uses, over the rows these return.
 */
import { CATEGORY_COLUMNS, getCategory, toCategory, type CategoryRow } from '@/db/categoriesRepository';
import type { Database } from '@/db/database.types';
import { fetchAll, iso, isId, must, type Db } from '@/db/db';
import { DomainError } from '@/db/errors';
import type { Category, CategoryKind, Id, Transaction, TransactionWithCategory } from '@/types/models';
import { DEFAULT_CURRENCY, isCurrency, type Currency } from '@/utils/money';

export interface TransactionInput {
  kind: CategoryKind;
  amount: number;
  currency: Currency;
  categoryId: Id;
  note: string;
  /** ISO UTC. */
  occurredAt: string;
}

export const NOTE_MAX_LENGTH = 200;

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type JoinedRow = Omit<TransactionRow, 'user_id'> & { category: Omit<CategoryRow, 'user_id'> | null };

export const toTransaction = (r: Omit<TransactionRow, 'user_id'>): Transaction => ({
  id: r.id,
  kind: r.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
  amount: Number(r.amount),
  // A currency this version doesn't know (e.g. from a newer backup) can't be formatted; show it as the default.
  currency: isCurrency(r.currency) ? r.currency : DEFAULT_CURRENCY,
  category_id: r.category_id,
  note: r.note,
  occurred_at: iso(r.occurred_at),
  created_at: iso(r.created_at),
  updated_at: iso(r.updated_at),
});

const toJoined = (r: JoinedRow): TransactionWithCategory | null => (r.category ? { ...toTransaction(r), category: toCategory(r.category) } : null);
const joined = (rows: readonly JoinedRow[]) => rows.map(toJoined).filter((r): r is TransactionWithCategory => r !== null);

const T_COLUMNS = 'id, kind, amount, currency, category_id, note, occurred_at, created_at, updated_at';
/** A transaction with its category embedded (through the one foreign key between them). */
const JOINED = `${T_COLUMNS}, category:categories!transactions_category_fkey(${CATEGORY_COLUMNS})`;

/**
 * The rules the app checks before writing (the schema checks them again): a whole amount above zero, a known
 * currency, a category of the same kind (the sign comes from `kind`). Returns the cleaned note.
 */
export function cleanTransaction(input: TransactionInput, category: Pick<Category, 'kind'> | null): { note: string } {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new DomainError('transaction.amount');
  if (!isCurrency(input.currency)) throw new DomainError('transaction.amount');
  if (!category || category.kind !== input.kind) throw new DomainError('transaction.category');
  return { note: input.note.trim().replace(/\s+/g, ' ').slice(0, NOTE_MAX_LENGTH) };
}

export async function createTransaction(db: Db, input: TransactionInput): Promise<Id> {
  const { note } = cleanTransaction(input, await getCategory(db, input.categoryId));
  const now = new Date().toISOString();
  const row = must(
    await db
      .from('transactions')
      .insert({
        kind: input.kind,
        amount: input.amount,
        currency: input.currency,
        category_id: input.categoryId,
        note,
        occurred_at: input.occurredAt,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single(),
  );
  if (!row) throw new Error('insert returned no row');
  return row.id;
}

export async function updateTransaction(db: Db, id: Id, input: TransactionInput): Promise<void> {
  if (!(await getTransaction(db, id))) throw new DomainError('transaction.notFound');
  const { note } = cleanTransaction(input, await getCategory(db, input.categoryId));
  must(
    await db
      .from('transactions')
      .update({
        kind: input.kind,
        amount: input.amount,
        currency: input.currency,
        category_id: input.categoryId,
        note,
        occurred_at: input.occurredAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id),
  );
}

export async function getTransaction(db: Db, id: Id): Promise<TransactionWithCategory | null> {
  if (!isId(id)) return null;
  const row = must(await db.from('transactions').select(JOINED).eq('id', id).maybeSingle());
  return row ? toJoined(row as JoinedRow) : null;
}

/** Transactions with `start <= occurred_at < end` (ISO UTC), newest first; only `categoryId`'s if given. */
export async function listTransactions(db: Db, range: { start: string; end: string; categoryId?: Id }): Promise<TransactionWithCategory[]> {
  if (range.categoryId !== undefined && !isId(range.categoryId)) return [];
  const rows = await fetchAll((from, to) => {
    let q = db.from('transactions').select(JOINED).gte('occurred_at', range.start).lt('occurred_at', range.end);
    if (range.categoryId !== undefined) q = q.eq('category_id', range.categoryId);
    return q.order('occurred_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
  });
  return joined(rows as JoinedRow[]);
}

/** When the oldest transaction happened (ISO UTC) — overall, or in one category; null when there is none. Trends start there. */
export async function firstTransactionAt(db: Db, categoryId?: Id): Promise<string | null> {
  if (categoryId !== undefined && !isId(categoryId)) return null;
  let q = db.from('transactions').select('occurred_at');
  if (categoryId !== undefined) q = q.eq('category_id', categoryId);
  const row = must(await q.order('occurred_at', { ascending: true }).limit(1).maybeSingle());
  return row ? iso(row.occurred_at) : null;
}

export const SEARCH_LIMIT = 200;

/**
 * Search (§4): transactions whose note contains `text` (taken literally, any case), or whose category is one
 * of `nameMatchIds` (categories whose *shown* name matches — worked out by the caller, since an untouched
 * template's name lives in the dictionary). `categoryIds` narrows to those categories (the filter chips).
 * Newest first, at most `limit`.
 */
export async function searchTransactions(
  db: Db,
  query: {
    text: string;
    nameMatchIds: readonly Id[];
    categoryIds: readonly Id[];
    /** [start, end) as ISO UTC strings (a period range, or picked days); absent = all time. */
    range?: { start: string; end: string };
    limit?: number;
  },
): Promise<TransactionWithCategory[]> {
  const rows = must(
    await db
      .rpc('search_transactions', {
        p_text: query.text,
        p_name_ids: [...query.nameMatchIds],
        p_category_ids: [...query.categoryIds],
        p_start: query.range?.start ?? null,
        p_end: query.range?.end ?? null,
        p_limit: query.limit ?? SEARCH_LIMIT,
      })
      .select(JOINED),
  );
  return joined((rows ?? []) as JoinedRow[]);
}

/** Every category that has transactions (archived ones too — they're in history): the search filter chips. Expense first, then income, in the user's order. */
export async function listUsedCategories(db: Db): Promise<Category[]> {
  const rows = must(await db.rpc('used_categories').select(CATEGORY_COLUMNS));
  return (rows ?? []).map(toCategory);
}

/** Deletes and returns the row, so the Undo toast can put it back with `putTransaction`. */
export async function deleteTransaction(db: Db, id: Id): Promise<Transaction> {
  const existing = await getTransaction(db, id);
  if (!existing) throw new DomainError('transaction.notFound');
  must(await db.from('transactions').delete().eq('id', id));
  const { category: _category, ...row } = existing;
  return row;
}

/** Writes a transaction back exactly as it was (same id and dates) — Undo after an edit or a delete. */
export async function putTransaction(db: Db, t: Transaction): Promise<void> {
  must(
    await db.from('transactions').upsert(
      {
        id: t.id,
        kind: t.kind,
        amount: t.amount,
        currency: t.currency,
        category_id: t.category_id,
        note: t.note,
        occurred_at: t.occurred_at,
        created_at: t.created_at,
        updated_at: t.updated_at,
      },
      { onConflict: 'id' },
    ),
  );
}

/** Whether the account has logged anything at all. */
export async function hasAnyTransactions(db: Db): Promise<boolean> {
  const row = must(await db.from('transactions').select('id').limit(1).maybeSingle());
  return row !== null;
}
