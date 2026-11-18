import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'tangtu.db';

/**
 * Ordered list of schema migrations. Index + 1 is the resulting `PRAGMA user_version`.
 * Never edit a shipped migration — append a new one instead (docs/SPEC.md §11).
 *
 * Phase 2 adds the first one (Categories + seed); phase 3 Transactions; phase 6 Activity.
 */
const MIGRATIONS: readonly string[] = [];

/** The schema version this build creates; a backup from a newer schema is refused. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/** Passed to `<SQLiteProvider onInit>`; runs once per app launch before any screen queries. */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  // Connection-level pragmas: must be set on every open, not just at migration time.
  await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    const next = version + 1;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration);
      // PRAGMA does not accept bound parameters; `next` is a trusted integer.
      await txn.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

/**
 * DEV ONLY: drops every table and re-runs the migrations, leaving a fresh schema (with the seed).
 * Foreign keys are switched off for the drop so the order doesn't matter; resetting
 * `user_version` makes `initializeDatabase` rebuild from migration 1.
 */
export async function resetDatabase(db: SQLiteDatabase): Promise<void> {
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const { name } of tables) await txn.execAsync(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`);
      await txn.execAsync('PRAGMA user_version = 0');
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
  await initializeDatabase(db);
}
