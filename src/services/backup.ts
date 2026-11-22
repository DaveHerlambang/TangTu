import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { BRAND } from '@/constants/brand';
import { addActivity } from '@/db/activityRepository';
import {
  BACKUP_APP,
  backupSummary,
  createBackup,
  hasAnyData,
  readSchemaVersion,
  replaceAllData,
  validateBackup,
  type BackupFile,
  type BackupSummary,
} from '@/db/backupRepository';
import { DomainError } from '@/db/errors';
import { useAppStore, type PersistedPrefs } from '@/store/useAppStore';
import { sanitizePrefs } from '@/utils/sanitizePrefs';

/**
 * Backup, restore and "Undo restore" (§11) — TracKar's design. The format and the SQL are in
 * `@/db/backupRepository`; this file adds files, the share sheet, the safety copy and preferences.
 * Errors are `DomainError`s with `backup.*` codes, shown by the screen in the current language.
 */

/** The preferences a backup carries. Device markers (last backup, bell seen, recap) never travel. */
function currentPrefs(): Partial<PersistedPrefs> {
  const { defaultTheme, language, periodStartDay, devToolsHidden } = useAppStore.getState();
  return { defaultTheme, language, periodStartDay, devToolsHidden };
}

async function writeJson(file: File, value: unknown): Promise<void> {
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(value));
}

/**
 * Writes everything to a JSON file and opens the share sheet (Drive, Files…). Android can't tell
 * "saved" from "cancelled", so the caller asks afterwards and records "Last backup" only on a yes.
 */
export async function exportBackup(db: SQLiteDatabase, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new DomainError('backup.noSharing');
  const backup = await createBackup(db, currentPrefs());
  const file = new File(Paths.cache, `${BRAND.name}-backup-${backup.exportedAt.slice(0, 10)}.json`);
  await writeJson(file, backup);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
}

/** Lets the user pick a backup file and validates it. Null if they cancel. */
export async function pickBackup(db: SQLiteDatabase): Promise<{ backup: BackupFile; summary: BackupSummary } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await new File(result.assets[0].uri).text());
  } catch {
    throw new DomainError('backup.notApp');
  }
  const backup = validateBackup(parsed, await readSchemaVersion(db));
  return { backup, summary: backupSummary(backup) };
}

/** Replaces the data, then applies only known, valid preferences, and makes every screen re-read. */
async function applyBackup(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  await replaceAllData(db, backup);
  useAppStore.getState().applyPrefs(sanitizePrefs(backup.prefs));
  useAppStore.getState().setSelectedPeriod(null);
  useAppStore.getState().invalidateData();
}

// ---------------------------------------------------------------------------
// Safety copy + "Undo restore"

/** How long the safety copy stays available after a restore. */
export const RESTORE_UNDO_DAYS = 7;
const RESTORE_UNDO_MS = RESTORE_UNDO_DAYS * 24 * 60 * 60 * 1000;

/**
 * In the document directory (not the cache, which Android may clear). One copy only: the data from
 * just before the *latest* restore.
 */
const safetyFile = () => new File(Paths.document, 'pre-restore-backup.json');

function removeSafetyCopy() {
  try {
    const file = safetyFile();
    if (file.exists) file.delete();
  } catch {
    // Nothing useful to do; the next restore overwrites it.
  }
}

/**
 * Saves the current data before a restore replaces it and checks it reads back; if that fails the
 * restore must not go ahead. With nothing to protect (a fresh install) there's no copy — and an older
 * one is dropped, since "undo" would otherwise wipe the restored data.
 */
async function saveSafetyCopy(db: SQLiteDatabase): Promise<boolean> {
  if (!(await hasAnyData(db))) {
    removeSafetyCopy();
    return false;
  }
  try {
    const file = safetyFile();
    await writeJson(file, await createBackup(db, currentPrefs()));
    const back = JSON.parse(await file.text()) as Partial<BackupFile>;
    if (back?.app !== BACKUP_APP) throw new Error('unreadable');
  } catch {
    removeSafetyCopy();
    throw new DomainError('backup.safetyCopy');
  }
  return true;
}

/**
 * Replaces everything with the backup — after keeping a safety copy so it can be undone — and says so
 * in the bell (whose history the restore has just cleared).
 */
export async function restoreBackup(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  const kept = await saveSafetyCopy(db);
  try {
    await applyBackup(db, backup);
  } catch (e) {
    // Nothing was replaced (the restore is atomic), so there is nothing to undo either.
    removeSafetyCopy();
    throw e;
  }
  const { exportedAt, categories, transactions } = backupSummary(backup);
  await addActivity(db, 'restore', {
    exportedAt: exportedAt.toISOString(),
    categories,
    transactions,
    undoUntil: kept ? new Date(Date.now() + RESTORE_UNDO_MS).toISOString() : null,
  }).catch(() => false);
  useAppStore.getState().invalidateData();
}

export interface RestoreUndo {
  /** When the data that would come back was saved (just before the restore). */
  savedAt: Date;
  /** The last moment "Undo restore" is offered. */
  until: Date;
  categories: number;
  transactions: number;
}

async function readSafetyCopy(db: SQLiteDatabase): Promise<BackupFile | null> {
  try {
    const file = safetyFile();
    if (!file.exists) return null;
    const backup = validateBackup(JSON.parse(await file.text()), await readSchemaVersion(db));
    if (Date.now() - new Date(backup.exportedAt).getTime() > RESTORE_UNDO_MS) {
      removeSafetyCopy();
      return null;
    }
    return backup;
  } catch {
    // Damaged or unreadable: it isn't offered.
    removeSafetyCopy();
    return null;
  }
}

/** What "Undo restore" would bring back, or null when there's nothing to undo (or it expired). */
export async function getRestoreUndo(db: SQLiteDatabase): Promise<RestoreUndo | null> {
  const backup = await readSafetyCopy(db);
  if (!backup) return null;
  const { exportedAt, categories, transactions } = backupSummary(backup);
  return { savedAt: exportedAt, until: new Date(exportedAt.getTime() + RESTORE_UNDO_MS), categories, transactions };
}

/** Puts back the data from before the last restore. One step: afterwards there's nothing left to undo. */
export async function undoRestore(db: SQLiteDatabase): Promise<void> {
  const backup = await readSafetyCopy(db);
  if (!backup) throw new DomainError('backup.nothingToUndo');
  await applyBackup(db, backup);
  removeSafetyCopy();
  await addActivity(db, 'restore_undone', {}).catch(() => false);
  useAppStore.getState().invalidateData();
}
