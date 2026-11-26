/**
 * The offline version's database on this phone (0.1.0–0.4.x, `tangtu.db`), read only: 0.5.0 never changes or
 * deletes it (§11). Signed in, the app offers to move its rows to the account through the same all-or-nothing
 * restore as a backup file. App only (expo-sqlite, expo-file-system).
 */
import { File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { makeBackup, type BackupFile, type BackupRow } from '@/db/backupRepository';

/** The file the offline version kept its data in; never renamed (it may still be on phones). */
export const LEGACY_DATABASE_NAME = 'tangtu.db';

export interface LegacyData {
  categories: number;
  transactions: number;
  /** As a backup file with no preferences (this phone's are already in use). */
  backup: BackupFile;
}

/** expo-sqlite keeps databases in `<documents>/SQLite/`. */
const legacyFile = () => new File(Paths.document, 'SQLite', LEGACY_DATABASE_NAME);

/** The offline data on this phone, or null when there is none (a new install, the web, an empty database). */
export async function readLegacyData(): Promise<LegacyData | null> {
  if (Platform.OS === 'web') return null;
  try {
    // Checked first: opening a database that isn't there would create an empty one.
    if (!legacyFile().exists) return null;
  } catch {
    return null;
  }
  const db = await openDatabaseAsync(LEGACY_DATABASE_NAME, { useNewConnection: true });
  try {
    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Categories', 'Transactions')`,
    );
    if (tables.length < 2) return null;
    const Categories = await db.getAllAsync<BackupRow>('SELECT * FROM Categories ORDER BY id');
    const Transactions = await db.getAllAsync<BackupRow>('SELECT * FROM Transactions ORDER BY id');
    if (Categories.length === 0 && Transactions.length === 0) return null;
    return { categories: Categories.length, transactions: Transactions.length, backup: makeBackup({ Categories, Transactions }, {}) };
  } finally {
    await db.closeAsync();
  }
}
