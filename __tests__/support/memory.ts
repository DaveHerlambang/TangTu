/**
 * In-memory categories and transactions for the logic tests (totals, charts, recaps), since 0.5.0 when the data
 * moved online. It applies the same pure rules the repositories apply before writing (`normalizeName`,
 * `findNameClash`, `cleanTransaction`); what the database itself enforces is tested on PGlite (schema.test.ts).
 */
import { DomainError } from '@/db/errors';
import { cleanTransaction, type TransactionInput } from '@/db/transactionsRepository';
import { findNameClash, normalizeName, type CategoryInput } from '@/db/categoriesRepository';
import type { Category, Id, TransactionWithCategory } from '@/types/models';

/** A UUID-shaped id that sorts in creation order (the database's are random; the tests want them readable). */
export const testId = (n: number): Id => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export interface MemoryData {
  categories: Category[];
  transactions: TransactionWithCategory[];
  createCategory(input: CategoryInput): Promise<Id>;
  createTransaction(input: TransactionInput): Promise<Id>;
  /** `start <= occurred_at < end`, newest first; one category's if given (as `listTransactions`). */
  listTransactions(range: { start: string; end: string; categoryId?: Id }): Promise<TransactionWithCategory[]>;
  /** The same, in the shape the recap builders take. */
  rowsIn(range: { start: string; end: string }): Promise<TransactionWithCategory[]>;
  firstTransactionAt(categoryId?: Id): Promise<string | null>;
}

export function memoryData(): MemoryData {
  const categories: Category[] = [];
  const transactions: TransactionWithCategory[] = [];
  const created = '2026-01-01T00:00:00.000Z';

  const listTransactions: MemoryData['listTransactions'] = async ({ start, end, categoryId }) =>
    transactions
      .filter((t) => t.occurred_at >= start && t.occurred_at < end && (categoryId === undefined || t.category_id === categoryId))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));

  return {
    categories,
    transactions,
    async createCategory(input) {
      const named = normalizeName(input);
      const active = categories.filter((c) => c.kind === input.kind && !c.archived_at);
      const other = findNameClash(named, active);
      if (other) throw new DomainError('category.nameTaken', { name: other.name ?? '', template: other.template_key ?? '' });
      const id = testId(categories.length + 1);
      categories.push({
        id,
        name: named.name,
        template_key: named.template_key,
        kind: input.kind,
        icon: input.icon,
        tint: input.tint,
        position: categories.filter((c) => c.kind === input.kind).length,
        archived_at: null,
        created_at: created,
      });
      return id;
    },
    async createTransaction(input) {
      const category = categories.find((c) => c.id === input.categoryId) ?? null;
      const { note } = cleanTransaction(input, category);
      const id = testId(transactions.length + 1);
      transactions.push({
        id,
        kind: input.kind,
        amount: input.amount,
        currency: input.currency,
        category_id: input.categoryId,
        note,
        occurred_at: input.occurredAt,
        created_at: input.occurredAt,
        updated_at: input.occurredAt,
        category: category!,
      });
      return id;
    },
    listTransactions,
    rowsIn: (range) => listTransactions(range),
    async firstTransactionAt(categoryId) {
      const own = transactions.filter((t) => categoryId === undefined || t.category_id === categoryId);
      return own.length ? own.reduce((min, t) => (t.occurred_at < min ? t.occurred_at : min), own[0].occurred_at) : null;
    },
  };
}
