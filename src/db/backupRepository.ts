/**
 * The backup file format and its data access (§11). Files, the share sheet, the safety copy and preferences
 * live in `@/services/backup`.
 *
 * A backup is JSON with the tables' rows by column name, the same `format: 1` since 0.1.0: a backup from the
 * offline version restores into an account, and one account's backup into another. `user_id` is never in a
 * file; a restore gives every row a new id and keeps the references (`replace_all_data`, supabase/migrations).
 */
import type { Json } from '@/db/database.types';
import { fetchAll, isConnectionFailure, isSignedOutFailure, type Db } from '@/db/db';
import { DomainError } from '@/db/errors';
import type { PersistedPrefs } from '@/store/useAppStore';

/**
 * The file's marker. A fixed string, not `BRAND.name`: renaming the app must not orphan old backups.
 */
export const BACKUP_APP = 'TangTu';
export const BACKUP_FORMAT = 1;
/**
 * The shape of the rows this version writes. 3 was the offline schema's `PRAGMA user_version`; 4 (0.5.0) has
 * the same columns with UUID ids, which the offline version could not store, so it refuses such a file as
 * "from a newer version" instead of failing halfway. This version reads 1-4. It goes up when the rows change.
 */
export const BACKUP_SCHEMA_VERSION = 4;

/** Insert order (parents before children). The bell is never backed up. */
export const BACKUP_TABLES = ['Categories', 'Transactions'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupRow = Record<string, string | number | null>;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  /** The rows' shape (`BACKUP_SCHEMA_VERSION`; before 0.5.0 the database's `PRAGMA user_version`). */
  schemaVersion: number;
  /** ISO UTC. */
  exportedAt: string;
  /** Untrusted on the way in: always passed through `sanitizePrefs`. Device markers never travel. */
  prefs: Partial<PersistedPrefs>;
  tables: Partial<Record<BackupTable, BackupRow[]>>;
}

export interface BackupSummary {
  exportedAt: Date;
  categories: number;
  transactions: number;
}

export const backupSummary = (backup: BackupFile): BackupSummary => ({
  exportedAt: new Date(backup.exportedAt),
  categories: backup.tables.Categories?.length ?? 0,
  transactions: backup.tables.Transactions?.length ?? 0,
});

const CATEGORY_COLUMNS = 'id, name, template_key, kind, icon, tint, position, archived_at, created_at';
const TRANSACTION_COLUMNS = 'id, kind, amount, currency, category_id, note, occurred_at, created_at, updated_at';
const isoDate = (v: unknown) => (typeof v === 'string' ? new Date(v).toISOString() : v);
const DATE_COLUMNS = new Set(['archived_at', 'created_at', 'occurred_at', 'updated_at']);

/** Dates in `toISOString()` form, as the offline version wrote them. */
function asFileRow(row: Record<string, unknown>): BackupRow {
  const out: BackupRow = {};
  for (const [k, v] of Object.entries(row)) out[k] = (DATE_COLUMNS.has(k) ? isoDate(v) : v) as BackupRow[string];
  return out;
}

/** A file from rows already read (the offline database, or the account). Pure. */
export function makeBackup(tables: BackupFile['tables'], prefs: Partial<PersistedPrefs>, now: Date = new Date()): BackupFile {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), prefs, tables };
}

/** All of the signed-in account's categories and transactions, plus the given preferences. */
export async function createBackup(db: Db, prefs: Partial<PersistedPrefs>, now: Date = new Date()): Promise<BackupFile> {
  const categories = await fetchAll((from, to) => db.from('categories').select(CATEGORY_COLUMNS).order('created_at').order('id').range(from, to));
  const transactions = await fetchAll((from, to) => db.from('transactions').select(TRANSACTION_COLUMNS).order('created_at').order('id').range(from, to));
  return makeBackup({ Categories: categories.map(asFileRow), Transactions: transactions.map(asFileRow) }, prefs, now);
}

const isCell = (v: unknown) => v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
const isRow = (r: unknown): r is BackupRow => !!r && typeof r === 'object' && !Array.isArray(r) && Object.values(r).every(isCell);
/** Money is a positive whole number in the smallest unit (§3). */
const isAmount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;
/** Dates are ISO UTC strings, as `toISOString()` writes them (§3). */
const isIsoDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Backup files are untrusted input: refuse anything that isn't a sound, non-empty TangTu backup this
 * version can read. Throws `DomainError` (`backup.*`).
 */
export function validateBackup(parsed: unknown, currentSchemaVersion: number = BACKUP_SCHEMA_VERSION): BackupFile {
  const b = parsed as Partial<BackupFile> | null;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP || !b.tables || typeof b.tables !== 'object' || Array.isArray(b.tables)) {
    throw new DomainError('backup.notApp');
  }
  if (typeof b.format !== 'number' || typeof b.schemaVersion !== 'number' || typeof b.exportedAt !== 'string') {
    throw new DomainError('backup.damaged');
  }
  if (b.format > BACKUP_FORMAT || b.schemaVersion > currentSchemaVersion) throw new DomainError('backup.newer');
  if (Number.isNaN(new Date(b.exportedAt).getTime())) throw new DomainError('backup.damaged');
  // Every table present must be a list of flat rows; anything else means the file is damaged.
  for (const table of BACKUP_TABLES) {
    const rows: unknown = b.tables[table];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || !rows.every(isRow)) throw new DomainError('backup.damaged');
  }
  // The app always writes whole amounts and ISO dates; a hand-edited file might not. Such a row would break
  // the totals or land outside every period, so the file is refused (0.4.1). Only what is surely broken:
  // a currency other than rupiah from 0.1.x is fine.
  for (const row of b.tables.Transactions ?? []) {
    if (!isAmount(row.amount) || !isIsoDate(row.occurred_at)) throw new DomainError('backup.damaged');
  }
  // Restoring replaces everything, so an empty file would silently wipe the account.
  if (BACKUP_TABLES.every((table) => (b.tables![table]?.length ?? 0) === 0)) throw new DomainError('backup.empty');
  return { ...b, prefs: b.prefs && typeof b.prefs === 'object' ? b.prefs : {} } as BackupFile;
}

/** Whether the signed-in account has any categories or transactions. */
export async function hasAnyData(db: Db): Promise<boolean> {
  for (const table of ['categories', 'transactions'] as const) {
    const { count, error, status } = await db.from(table).select('id', { count: 'exact', head: true });
    if (error) throw restoreError(error, status);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

function restoreError(error: { message: string; code?: string }, status?: number): Error {
  if (isConnectionFailure(error, status)) return new DomainError('connection');
  if (isSignedOutFailure(error, status)) return new DomainError('auth.signedOut');
  return new DomainError('backup.damaged');
}

/**
 * Replaces all of the signed-in account's data with the backup's rows, in one database call: if any row is
 * refused (a check, a transaction pointing at a missing category, a kind that doesn't match its category),
 * nothing changes and `backup.damaged` is thrown. The bell is cleared (§3). Unknown columns are ignored.
 */
export async function replaceAllData(db: Db, backup: BackupFile): Promise<void> {
  const { error, status } = await db.rpc('replace_all_data', {
    p_categories: (backup.tables.Categories ?? []) as unknown as Json,
    p_transactions: (backup.tables.Transactions ?? []) as unknown as Json,
  });
  if (error) throw restoreError(error, status);
}

/** DEV ONLY (the dev gear's "Nuke", §12): empties the signed-in account — every category, transaction and bell message. */
export async function deleteAllData(db: Db): Promise<void> {
  const { error, status } = await db.rpc('replace_all_data', { p_categories: [], p_transactions: [] });
  if (error) throw restoreError(error, status);
}
