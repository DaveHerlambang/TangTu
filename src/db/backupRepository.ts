/**
 * The backup file format and all of its SQL (§11). No React Native imports: the tests run this against
 * real SQLite. Files, the share sheet, the safety copy and preferences live in `@/services/backup`.
 *
 * A backup is JSON, not the raw .db: restore maps columns by name, so a backup from an older schema
 * restores into a newer one (new columns take their defaults).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { DomainError } from '@/db/errors';
import type { PersistedPrefs } from '@/store/useAppStore';

/**
 * The file's marker. A fixed string, not `BRAND.name`: renaming the app must not orphan old backups.
 */
export const BACKUP_APP = 'TangTu';
export const BACKUP_FORMAT = 1;

/** Insert order (parents before children); deletion runs in reverse. Activity is never backed up. */
export const BACKUP_TABLES = ['Categories', 'Transactions'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupRow = Record<string, string | number | null>;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  /** `PRAGMA user_version` of the database that wrote it. */
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

export async function readSchemaVersion(db: SQLiteDatabase): Promise<number> {
  return (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}

export const backupSummary = (backup: BackupFile): BackupSummary => ({
  exportedAt: new Date(backup.exportedAt),
  categories: backup.tables.Categories?.length ?? 0,
  transactions: backup.tables.Transactions?.length ?? 0,
});

/** Every table (each row with all its columns, currency included) plus the given preferences. */
export async function createBackup(db: SQLiteDatabase, prefs: Partial<PersistedPrefs>, now: Date = new Date()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const table of BACKUP_TABLES) tables[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table} ORDER BY id`);
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schemaVersion: await readSchemaVersion(db),
    exportedAt: now.toISOString(),
    prefs,
    tables,
  };
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
export function validateBackup(parsed: unknown, currentSchemaVersion: number): BackupFile {
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
  // Restoring replaces everything, so an empty file would silently wipe the app.
  if (BACKUP_TABLES.every((table) => (b.tables![table]?.length ?? 0) === 0)) throw new DomainError('backup.empty');
  return { ...b, prefs: b.prefs && typeof b.prefs === 'object' ? b.prefs : {} } as BackupFile;
}

export async function hasAnyData(db: SQLiteDatabase): Promise<boolean> {
  for (const table of BACKUP_TABLES) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    if ((row?.n ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Replaces every backed-up table with the backup's rows, atomically: if any row is refused (a CHECK,
 * a transaction pointing at a missing category, a kind that doesn't match its category), nothing
 * changes and `backup.damaged` is thrown. Columns are matched by name; unknown ones are ignored.
 */
export async function replaceAllData(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const table of [...BACKUP_TABLES].reverse()) await txn.runAsync(`DELETE FROM ${table}`);
      // The bell's history isn't backed up and may point at data that's gone: cleared on restore (§3).
      await txn.runAsync('DELETE FROM Activity');

      for (const table of BACKUP_TABLES) {
        const rows = backup.tables[table] ?? [];
        if (rows.length === 0) continue;
        const known = new Set((await txn.getAllAsync<{ name: string }>(`SELECT name FROM pragma_table_info('${table}')`)).map((c) => c.name));
        for (const row of rows) {
          const cols = Object.keys(row).filter((col) => known.has(col));
          if (cols.length === 0) throw new DomainError('backup.damaged');
          await txn.runAsync(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((col) => row[col] ?? null));
        }
      }

      // The app never writes these; a hand-edited file could. Refuse rather than show nonsense totals.
      const mismatch = await txn.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM Transactions t JOIN Categories c ON c.id = t.category_id WHERE t.kind <> c.kind',
      );
      if ((mismatch?.n ?? 0) > 0) throw new DomainError('backup.damaged');
    });
  } catch (e) {
    throw e instanceof DomainError ? e : new DomainError('backup.damaged');
  }
}
