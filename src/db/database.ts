import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'tangtu.db';

/**
 * Ordered list of schema migrations. Index + 1 is the resulting `PRAGMA user_version`.
 * Never edit a shipped migration — append a new one instead (docs/SPEC.md §11).
 *
 * v1 Categories (phase 2), v2 Transactions (phase 3), v3 Activity (phase 6).
 */
export const MIGRATIONS: readonly string[] = [
  // v1: user-defined categories (§3, §7). No seed rows: the §7.3 templates live in code and are only
  // offered when the user creates a category. `name` NULL = an untouched template category, named from
  // the dictionary so it follows the language. Icon and tint are validated in code (not CHECKs), so a
  // later version can add icons or tints without rebuilding the table.
  `
  CREATE TABLE IF NOT EXISTS Categories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    CHECK (name IS NULL OR length(trim(name)) > 0),
    template_key TEXT,
    kind         TEXT    NOT NULL CHECK (kind IN ('EXPENSE', 'INCOME')),
    icon         TEXT    NOT NULL CHECK (length(icon) > 0),
    tint         TEXT    NOT NULL CHECK (length(tint) > 0),
    position     INTEGER NOT NULL DEFAULT 0,
    archived_at  TEXT,
    created_at   TEXT    NOT NULL,
    CHECK (name IS NOT NULL OR template_key IS NOT NULL)
  );
  CREATE INDEX IF NOT EXISTS idx_categories_kind ON Categories (kind, archived_at, position);
  `,
  // v2: transactions (§3). `amount` is a positive integer in the smallest unit of `currency` (rupiah,
  // yen; cents of USD/EUR/SGD) — the sign comes from `kind`. Each row keeps its own currency, so
  // changing the default currency never touches history. A category with transactions can't be
  // deleted (RESTRICT), only archived.
  `
  CREATE TABLE IF NOT EXISTS Transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT    NOT NULL CHECK (kind IN ('EXPENSE', 'INCOME')),
    amount      INTEGER NOT NULL CHECK (amount > 0),
    currency    TEXT    NOT NULL CHECK (length(currency) = 3),
    category_id INTEGER NOT NULL REFERENCES Categories (id) ON DELETE RESTRICT,
    note        TEXT    NOT NULL DEFAULT '',
    occurred_at TEXT    NOT NULL,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON Transactions (occurred_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON Transactions (category_id, occurred_at);
  `,
  // v3: the bell's history (§8.7). Rows store *what happened* — a kind plus JSON params — never
  // sentences, so they are written out in the current language when shown (§6.5). Not backed up;
  // cleared on restore. `dedupe_key` keeps one-off messages (a recap per period) from repeating.
  `
  CREATE TABLE IF NOT EXISTS Activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,
    params     TEXT NOT NULL DEFAULT '{}',
    ref_type   TEXT,
    ref_id     TEXT,
    dedupe_key TEXT UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_created ON Activity (created_at);
  `,
];

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
 * DEV ONLY: drops every table and re-runs the migrations, leaving a fresh, empty schema.
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
