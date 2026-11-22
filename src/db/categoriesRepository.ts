/**
 * All SQL for `Categories` (§3, §7). No React Native imports: the tests run this against real SQLite.
 *
 * Rules enforced here:
 * - Active names are unique per kind, in every language an untouched template name can show in.
 * - A category with transactions is never deleted, only archived (and can be restored).
 * - Icon and tint fall back to safe values if a row holds one this version doesn't know.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { FALLBACK_ICON, isCategoryIcon, isTemplateKey, type CategoryIcon, type TemplateKey } from '@/constants/categories';
import { DomainError } from '@/db/errors';
import { TINT_ORDER, type TintKey } from '@/theme/themes';
import type { Category, CategoryKind } from '@/types/models';
import { shownNames } from '@/utils/categoryNames';

export interface CategoryInput {
  kind: CategoryKind;
  /** As stored: NULL keeps an untouched template name (see `storedName`). */
  name: string | null;
  templateKey: TemplateKey | null;
  icon: CategoryIcon;
  tint: TintKey;
}

/** What can change on an existing category (its kind is fixed: moving it would flip its transactions). */
export type CategoryPatch = Pick<CategoryInput, 'name' | 'icon' | 'tint'>;

export interface CategoryRow {
  id: number;
  name: string | null;
  template_key: string | null;
  kind: CategoryKind;
  icon: string;
  tint: string;
  position: number;
  archived_at: string | null;
  created_at: string;
}

const isTint = (v: string): v is TintKey => (TINT_ORDER as readonly string[]).includes(v);

export const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  template_key: isTemplateKey(r.template_key) ? r.template_key : null,
  kind: r.kind,
  icon: isCategoryIcon(r.icon) ? r.icon : FALLBACK_ICON,
  tint: isTint(r.tint) ? r.tint : 'slate',
  position: r.position,
  archived_at: r.archived_at,
  created_at: r.created_at,
});

const COLUMNS = 'id, name, template_key, kind, icon, tint, position, archived_at, created_at';

/**
 * Active categories of `kind` for the add-transaction grid (§4): most used in the 60 days before
 * `now` first, then the user's order.
 */
export async function listCategoriesByUse(db: SQLiteDatabase, kind: CategoryKind, now: Date = new Date()): Promise<Category[]> {
  const since = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT c.id, c.name, c.template_key, c.kind, c.icon, c.tint, c.position, c.archived_at, c.created_at
       FROM Categories c
       LEFT JOIN Transactions t ON t.category_id = c.id AND t.occurred_at >= ? AND t.occurred_at <= ?
      WHERE c.kind = ? AND c.archived_at IS NULL
      GROUP BY c.id
      ORDER BY COUNT(t.id) DESC, c.position, c.id`,
    since,
    now.toISOString(),
    kind,
  );
  return rows.map(toCategory);
}

/** Active categories of `kind`, in the user's order. */
export async function listCategories(db: SQLiteDatabase, kind: CategoryKind): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT ${COLUMNS} FROM Categories WHERE kind = ? AND archived_at IS NULL ORDER BY position, id`,
    kind,
  );
  return rows.map(toCategory);
}

/** Archived categories of `kind`, most recently archived first. */
export async function listArchivedCategories(db: SQLiteDatabase, kind: CategoryKind): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT ${COLUMNS} FROM Categories WHERE kind = ? AND archived_at IS NOT NULL ORDER BY archived_at DESC, id DESC`,
    kind,
  );
  return rows.map(toCategory);
}

export async function getCategory(db: SQLiteDatabase, id: number): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>(`SELECT ${COLUMNS} FROM Categories WHERE id = ?`, id);
  return row ? toCategory(row) : null;
}

async function requireCategory(db: SQLiteDatabase, id: number): Promise<Category> {
  const category = await getCategory(db, id);
  if (!category) throw new DomainError('category.notFound');
  return category;
}

/**
 * Throws `category.nameTaken` if another active category of `kind` can show under any of the same
 * names. The error carries the other category's stored `name` / `template` so the screen can name
 * it in the current language (see `domainErrorMessage`).
 */
async function assertNameFree(db: SQLiteDatabase, kind: CategoryKind, candidate: Pick<Category, 'name' | 'template_key'>, exceptId?: number) {
  const wanted = shownNames(candidate);
  for (const other of await listCategories(db, kind)) {
    if (other.id === exceptId) continue;
    if ([...shownNames(other)].some((n) => wanted.has(n))) {
      throw new DomainError('category.nameTaken', { name: other.name ?? '', template: other.template_key ?? '' });
    }
  }
}

function normalize(input: { name: string | null; templateKey: TemplateKey | null }) {
  const name = input.name?.trim().replace(/\s+/g, ' ') || null;
  if (!name && !input.templateKey) throw new DomainError('category.nameEmpty');
  return { name, template_key: input.templateKey };
}

/** Creates a category at the end of its kind's list; returns its id. */
export async function createCategory(db: SQLiteDatabase, input: CategoryInput): Promise<number> {
  const named = normalize(input);
  await assertNameFree(db, input.kind, named);
  const next = await db.getFirstAsync<{ position: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM Categories WHERE kind = ?',
    input.kind,
  );
  const result = await db.runAsync(
    'INSERT INTO Categories (name, template_key, kind, icon, tint, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    named.name,
    named.template_key,
    input.kind,
    input.icon,
    input.tint,
    next?.position ?? 0,
    new Date().toISOString(),
  );
  return result.lastInsertRowId;
}

/** Changes name, icon and tint. Icon and tint are identity: they change everywhere, history included (§3). */
export async function updateCategory(db: SQLiteDatabase, id: number, patch: CategoryPatch): Promise<void> {
  const current = await requireCategory(db, id);
  const named = normalize({ name: patch.name, templateKey: current.template_key });
  if (!current.archived_at) await assertNameFree(db, current.kind, named, id);
  await db.runAsync('UPDATE Categories SET name = ?, icon = ?, tint = ? WHERE id = ?', named.name, patch.icon, patch.tint, id);
}

/** New order for the active categories of `kind` (ids top to bottom). */
export async function reorderCategories(db: SQLiteDatabase, kind: CategoryKind, ids: readonly number[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [position, id] of ids.entries()) {
      await db.runAsync('UPDATE Categories SET position = ? WHERE id = ? AND kind = ?', position, id, kind);
    }
  });
}

export async function archiveCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await requireCategory(db, id);
  await db.runAsync('UPDATE Categories SET archived_at = ? WHERE id = ? AND archived_at IS NULL', new Date().toISOString(), id);
}

/** Back into the pickers, at the end of the list. Refused if an active category took its name meanwhile. */
export async function restoreCategory(db: SQLiteDatabase, id: number): Promise<void> {
  const category = await requireCategory(db, id);
  if (!category.archived_at) return;
  await assertNameFree(db, category.kind, category, id);
  await db.runAsync(
    `UPDATE Categories
        SET archived_at = NULL,
            position = (SELECT COALESCE(MAX(position), -1) + 1 FROM Categories WHERE kind = ? AND archived_at IS NULL)
      WHERE id = ?`,
    category.kind,
    id,
  );
}

/** How many transactions use the category. A used category can only be archived, never deleted. */
export async function categoryUsage(db: SQLiteDatabase, id: number): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM Transactions WHERE category_id = ?', id);
  return row?.n ?? 0;
}

/**
 * Deletes an unused category and returns it, so the Undo toast can put it back with
 * `putCategory`. Throws `category.inUse` for a category with transactions (archive it instead).
 */
export async function deleteCategory(db: SQLiteDatabase, id: number): Promise<Category> {
  const category = await requireCategory(db, id);
  const uses = await categoryUsage(db, id);
  if (uses > 0) throw new DomainError('category.inUse', { count: uses });
  await db.runAsync('DELETE FROM Categories WHERE id = ?', id);
  return category;
}

/**
 * Writes a category back exactly as it was (same id, position, dates) — for Undo after an edit or
 * a delete. Never `INSERT OR REPLACE`: a replace is a delete + insert, which would hit transactions.
 */
export async function putCategory(db: SQLiteDatabase, c: Category): Promise<void> {
  const exists = await db.getFirstAsync<{ id: number }>('SELECT id FROM Categories WHERE id = ?', c.id);
  if (exists) {
    await db.runAsync(
      'UPDATE Categories SET name = ?, template_key = ?, kind = ?, icon = ?, tint = ?, position = ?, archived_at = ?, created_at = ? WHERE id = ?',
      c.name,
      c.template_key,
      c.kind,
      c.icon,
      c.tint,
      c.position,
      c.archived_at,
      c.created_at,
      c.id,
    );
  } else {
    await db.runAsync(
      `INSERT INTO Categories (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      c.id,
      c.name,
      c.template_key,
      c.kind,
      c.icon,
      c.tint,
      c.position,
      c.archived_at,
      c.created_at,
    );
  }
}

/** Tint for a blank new category: the one after the last active category's, so neighbours differ (§7.4). */
export async function nextTint(db: SQLiteDatabase, kind: CategoryKind): Promise<TintKey> {
  const last = await db.getFirstAsync<{ tint: string }>(
    'SELECT tint FROM Categories WHERE kind = ? AND archived_at IS NULL ORDER BY position DESC, id DESC LIMIT 1',
    kind,
  );
  if (!last || !isTint(last.tint)) return TINT_ORDER[0];
  return TINT_ORDER[(TINT_ORDER.indexOf(last.tint) + 1) % TINT_ORDER.length];
}
