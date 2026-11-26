/**
 * All data access for `categories` (§3, §7), over Supabase since 0.5.0. Row level security keeps every call
 * to the signed-in account's rows; the schema also refuses what the app never writes (supabase/migrations).
 *
 * Rules enforced here:
 * - Active names are unique per kind, in every language an untouched template name can show in
 *   (`findNameClash`, pure; the database only knows typed names).
 * - A category with transactions is never deleted, only archived (and can be restored).
 * - Icon and tint fall back to safe values if a row holds one this version doesn't know.
 */
import { FALLBACK_ICON, isCategoryIcon, isTemplateKey, type CategoryIcon, type TemplateKey } from '@/constants/categories';
import type { Database } from '@/db/database.types';
import { fetchAll, iso, isId, isoOrNull, must, type Db } from '@/db/db';
import { DomainError } from '@/db/errors';
import { TINT_ORDER, type TintKey } from '@/theme/themes';
import type { Category, CategoryKind, Id } from '@/types/models';
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

export type CategoryRow = Database['public']['Tables']['categories']['Row'];

const isTint = (v: string): v is TintKey => (TINT_ORDER as readonly string[]).includes(v);
const isKind = (v: string): v is CategoryKind => v === 'EXPENSE' || v === 'INCOME';

export const toCategory = (r: Omit<CategoryRow, 'user_id'>): Category => ({
  id: r.id,
  name: r.name,
  template_key: isTemplateKey(r.template_key) ? r.template_key : null,
  kind: isKind(r.kind) ? r.kind : 'EXPENSE',
  icon: isCategoryIcon(r.icon) ? r.icon : FALLBACK_ICON,
  tint: isTint(r.tint) ? r.tint : 'slate',
  position: r.position,
  archived_at: isoOrNull(r.archived_at),
  created_at: iso(r.created_at),
});

/** Every column but `user_id`, which the app never needs (row level security already scopes it). */
export const CATEGORY_COLUMNS = 'id, name, template_key, kind, icon, tint, position, archived_at, created_at';

const DAY_MS = 86_400_000;

/**
 * Active categories of `kind` for the add-transaction grid (§4): most used in the 60 days before
 * `now` first, then the user's order.
 */
export async function listCategoriesByUse(db: Db, kind: CategoryKind, now: Date = new Date()): Promise<Category[]> {
  const rows = must(
    await db.rpc('categories_by_use', { p_kind: kind, p_since: new Date(now.getTime() - 60 * DAY_MS).toISOString(), p_until: now.toISOString() }),
  );
  return (rows ?? []).map(toCategory);
}

/** Active categories of `kind`, in the user's order. */
export async function listCategories(db: Db, kind: CategoryKind): Promise<Category[]> {
  const rows = await fetchAll((from, to) =>
    db.from('categories').select(CATEGORY_COLUMNS).eq('kind', kind).is('archived_at', null).order('position').order('created_at').order('id').range(from, to),
  );
  return rows.map(toCategory);
}

/** Archived categories of `kind`, most recently archived first. */
export async function listArchivedCategories(db: Db, kind: CategoryKind): Promise<Category[]> {
  const rows = await fetchAll((from, to) =>
    db
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .eq('kind', kind)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  );
  return rows.map(toCategory);
}

export async function getCategory(db: Db, id: Id): Promise<Category | null> {
  if (!isId(id)) return null;
  const row = must(await db.from('categories').select(CATEGORY_COLUMNS).eq('id', id).maybeSingle());
  return row ? toCategory(row) : null;
}

async function requireCategory(db: Db, id: Id): Promise<Category> {
  const category = await getCategory(db, id);
  if (!category) throw new DomainError('category.notFound');
  return category;
}

/**
 * The active category (other than `exceptId`) that can show under one of `candidate`'s names, in any language,
 * or null. Pure: the rule of §3 "active names unique per kind" as the app sees names.
 */
export function findNameClash(candidate: Pick<Category, 'name' | 'template_key'>, others: readonly Category[], exceptId?: Id): Category | null {
  const wanted = shownNames(candidate);
  return others.find((other) => other.id !== exceptId && [...shownNames(other)].some((n) => wanted.has(n))) ?? null;
}

/**
 * Throws `category.nameTaken` if another active category of `kind` can show under any of the same
 * names. The error carries the other category's stored `name` / `template` so the screen can name
 * it in the current language (see `errorAlert`).
 */
async function assertNameFree(db: Db, kind: CategoryKind, candidate: Pick<Category, 'name' | 'template_key'>, exceptId?: Id) {
  const other = findNameClash(candidate, await listCategories(db, kind), exceptId);
  if (other) throw new DomainError('category.nameTaken', { name: other.name ?? '', template: other.template_key ?? '' });
}

export function normalizeName(input: { name: string | null; templateKey: TemplateKey | null }) {
  const name = input.name?.trim().replace(/\s+/g, ' ') || null;
  if (!name && !input.templateKey) throw new DomainError('category.nameEmpty');
  return { name, template_key: input.templateKey };
}

/** The highest `position` among `kind`'s categories (active ones only, or all), or -1. */
async function lastPosition(db: Db, kind: CategoryKind, activeOnly: boolean): Promise<number> {
  let q = db.from('categories').select('position').eq('kind', kind);
  if (activeOnly) q = q.is('archived_at', null);
  const row = must(await q.order('position', { ascending: false }).limit(1).maybeSingle());
  return row?.position ?? -1;
}

/** Creates a category at the end of its kind's list; returns its id. */
export async function createCategory(db: Db, input: CategoryInput): Promise<Id> {
  const named = normalizeName(input);
  await assertNameFree(db, input.kind, named);
  const row = must(
    await db
      .from('categories')
      .insert({
        name: named.name,
        template_key: named.template_key,
        kind: input.kind,
        icon: input.icon,
        tint: input.tint,
        position: (await lastPosition(db, input.kind, false)) + 1,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single(),
  );
  if (!row) throw new Error('insert returned no row');
  return row.id;
}

/** Changes name, icon and tint. Icon and tint are identity: they change everywhere, history included (§3). */
export async function updateCategory(db: Db, id: Id, patch: CategoryPatch): Promise<void> {
  const current = await requireCategory(db, id);
  const named = normalizeName({ name: patch.name, templateKey: current.template_key });
  if (!current.archived_at) await assertNameFree(db, current.kind, named, id);
  must(await db.from('categories').update({ name: named.name, icon: patch.icon, tint: patch.tint }).eq('id', id));
}

/** New order for the active categories of `kind` (ids top to bottom). */
export async function reorderCategories(db: Db, kind: CategoryKind, ids: readonly Id[]): Promise<void> {
  for (const [position, id] of ids.entries()) {
    must(await db.from('categories').update({ position }).eq('id', id).eq('kind', kind));
  }
}

export async function archiveCategory(db: Db, id: Id): Promise<void> {
  await requireCategory(db, id);
  must(await db.from('categories').update({ archived_at: new Date().toISOString() }).eq('id', id).is('archived_at', null));
}

/** Back into the pickers, at the end of the list. Refused if an active category took its name meanwhile. */
export async function restoreCategory(db: Db, id: Id): Promise<void> {
  const category = await requireCategory(db, id);
  if (!category.archived_at) return;
  await assertNameFree(db, category.kind, category, id);
  const position = (await lastPosition(db, category.kind, true)) + 1;
  must(await db.from('categories').update({ archived_at: null, position }).eq('id', id));
}

/** How many transactions use the category. A used category can only be archived, never deleted. */
export async function categoryUsage(db: Db, id: Id): Promise<number> {
  const { count, error, status } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id);
  must({ data: null, error, status });
  return count ?? 0;
}

/**
 * Deletes an unused category and returns it, so the Undo toast can put it back with
 * `putCategory`. Throws `category.inUse` for a category with transactions (archive it instead).
 */
export async function deleteCategory(db: Db, id: Id): Promise<Category> {
  const category = await requireCategory(db, id);
  const uses = await categoryUsage(db, id);
  if (uses > 0) throw new DomainError('category.inUse', { count: uses });
  must(await db.from('categories').delete().eq('id', id));
  return category;
}

/**
 * Writes a category back exactly as it was (same id, position, dates) — for Undo after an edit or a delete.
 * An upsert updates in place (never a delete + insert, which the transactions' foreign key would refuse).
 */
export async function putCategory(db: Db, c: Category): Promise<void> {
  must(
    await db.from('categories').upsert(
      {
        id: c.id,
        name: c.name,
        template_key: c.template_key,
        kind: c.kind,
        icon: c.icon,
        tint: c.tint,
        position: c.position,
        archived_at: c.archived_at,
        created_at: c.created_at,
      },
      { onConflict: 'id' },
    ),
  );
}

/** Tint for a blank new category: the one after the last active category's, so neighbours differ (§7.4). */
export async function nextTint(db: Db, kind: CategoryKind): Promise<TintKey> {
  const last = must(
    await db
      .from('categories')
      .select('tint')
      .eq('kind', kind)
      .is('archived_at', null)
      .order('position', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  return tintAfter(last?.tint ?? null);
}

/** The tint after `tint` in the preset order (the first one when there is none). Pure. */
export function tintAfter(tint: string | null): TintKey {
  if (!tint || !isTint(tint)) return TINT_ORDER[0];
  return TINT_ORDER[(TINT_ORDER.indexOf(tint) + 1) % TINT_ORDER.length];
}
