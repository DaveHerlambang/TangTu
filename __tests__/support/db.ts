/**
 * A real SQLite database for the tests: Node's built-in `node:sqlite`, wrapped in the slice of
 * expo-sqlite's async API the repositories use, migrated by the app's own `initializeDatabase`.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { initializeDatabase } from '@/db/database';

type Params = SQLInputValue[];
const flat = (params: unknown[]): Params => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as Params;
/** node:sqlite returns null-prototype rows; make them plain objects so assertions compare cleanly. */
const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;

export function rawTestDb(): { db: SQLiteDatabase; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const transaction = async (fn: () => Promise<void>) => {
    raw.exec('BEGIN');
    try {
      await fn();
      raw.exec('COMMIT');
    } catch (e) {
      raw.exec('ROLLBACK');
      throw e;
    }
  };
  const db = {
    execAsync: async (sql: string) => void raw.exec(sql),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const r = raw.prepare(sql).run(...flat(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]) => raw.prepare(sql).all(...flat(params)).map((r) => plain<T>(r)),
    getFirstAsync: async <T>(sql: string, ...params: unknown[]) => {
      const row = raw.prepare(sql).get(...flat(params));
      return row ? plain<T>(row) : null;
    },
    withTransactionAsync: (fn: () => Promise<void>) => transaction(fn),
    withExclusiveTransactionAsync: (fn: (txn: unknown) => Promise<void>) => transaction(() => fn(db)),
  };
  return { db: db as unknown as SQLiteDatabase, raw };
}

/** A fresh in-memory database at the current schema. */
export async function testDb(): Promise<SQLiteDatabase> {
  const { db } = rawTestDb();
  await initializeDatabase(db);
  return db;
}
