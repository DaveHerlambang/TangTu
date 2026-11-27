import { BRAND } from '@/constants/brand';
import { addActivity } from '@/db/activityRepository';
import {
  BACKUP_APP,
  backupSummary,
  createBackup,
  hasAnyData,
  replaceAllData,
  validateBackup,
  type BackupFile,
  type BackupSummary,
} from '@/db/backupRepository';
import type { Db } from '@/db/db';
import { DomainError } from '@/db/errors';
import { pickBackupText, safetyCopy, shareBackupFile } from '@/platform/backupFiles';
import { useAppStore, type PersistedPrefs } from '@/store/useAppStore';
import { sanitizePrefs } from '@/utils/sanitizePrefs';

/**
 * Backup, restore and "Undo restore" (§11) — TracKar's design. The format and the data access are in
 * `@/db/backupRepository`; this file adds the safety copy (on the device, of the account's online data) and
 * preferences. Files, the share sheet and where the safety copy is kept differ between the phone and the web
 * (`@/platform/backupFiles`, 0.6.0).
 * Errors are `DomainError`s with `backup.*` codes, shown by the screen in the current language.
 */

/** The preferences a backup carries. Device markers (last backup, bell seen, recap) never travel. */
function currentPrefs(): Partial<PersistedPrefs> {
  const { defaultTheme, language, periodStartDay, devToolsHidden } = useAppStore.getState();
  return { defaultTheme, language, periodStartDay, devToolsHidden };
}

/**
 * Writes everything to a JSON file and shares it (the share sheet; on the web, the browser's share or a
 * download). Android can't tell "saved" from "cancelled", so the caller asks afterwards and records "Last
 * backup" only on a yes.
 */
export async function exportBackup(db: Db, dialogTitle: string): Promise<void> {
  const backup = await createBackup(db, currentPrefs());
  await shareBackupFile(`${BRAND.name}-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup), dialogTitle);
}

/** Lets the user pick a backup file and validates it. Null if they cancel. */
export async function pickBackup(): Promise<{ backup: BackupFile; summary: BackupSummary } | null> {
  const text = await pickBackupText();
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DomainError('backup.notApp');
  }
  const backup = validateBackup(parsed);
  return { backup, summary: backupSummary(backup) };
}

/** Replaces the data, then applies only known, valid preferences, and makes every screen re-read. */
async function applyBackup(db: Db, backup: BackupFile): Promise<void> {
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
 * Signing out (§5): the safety copy is the signed-out account's data, so it goes — "Undo restore" must never put
 * one account's data into the next one signed in on this device.
 */
export const forgetSafetyCopy = () => safetyCopy.remove();

/**
 * Saves the current data before a restore replaces it and checks it reads back; if that fails the
 * restore must not go ahead. With nothing to protect (a fresh install) there's no copy — and an older
 * one is dropped, since "undo" would otherwise wipe the restored data.
 */
async function saveSafetyCopy(db: Db): Promise<boolean> {
  if (!(await hasAnyData(db))) {
    await safetyCopy.remove();
    return false;
  }
  try {
    await safetyCopy.write(JSON.stringify(await createBackup(db, currentPrefs())));
    const text = await safetyCopy.read();
    const back = (text === null ? null : JSON.parse(text)) as Partial<BackupFile> | null;
    if (back?.app !== BACKUP_APP) throw new Error('unreadable');
  } catch {
    await safetyCopy.remove();
    throw new DomainError('backup.safetyCopy');
  }
  return true;
}

/**
 * Replaces everything with the backup — after keeping a safety copy so it can be undone — and says so
 * in the bell (whose history the restore has just cleared).
 */
export async function restoreBackup(db: Db, backup: BackupFile, options: { announce?: boolean } = {}): Promise<void> {
  const kept = await saveSafetyCopy(db);
  try {
    await applyBackup(db, backup);
  } catch (e) {
    // Nothing was replaced (the restore is atomic), so there is nothing to undo either.
    await safetyCopy.remove();
    throw e;
  }
  if (options.announce === false) {
    useAppStore.getState().invalidateData();
    return;
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

async function readSafetyCopy(): Promise<BackupFile | null> {
  try {
    const text = await safetyCopy.read();
    if (text === null) return null;
    const backup = validateBackup(JSON.parse(text));
    if (Date.now() - new Date(backup.exportedAt).getTime() > RESTORE_UNDO_MS) {
      await safetyCopy.remove();
      return null;
    }
    return backup;
  } catch {
    // Damaged or unreadable: it isn't offered.
    await safetyCopy.remove();
    return null;
  }
}

/** What "Undo restore" would bring back, or null when there's nothing to undo (or it expired). */
export async function getRestoreUndo(): Promise<RestoreUndo | null> {
  const backup = await readSafetyCopy();
  if (!backup) return null;
  const { exportedAt, categories, transactions } = backupSummary(backup);
  return { savedAt: exportedAt, until: new Date(exportedAt.getTime() + RESTORE_UNDO_MS), categories, transactions };
}

/** Puts back the data from before the last restore. One step: afterwards there's nothing left to undo. */
export async function undoRestore(db: Db): Promise<void> {
  const backup = await readSafetyCopy();
  if (!backup) throw new DomainError('backup.nothingToUndo');
  await applyBackup(db, backup);
  await safetyCopy.remove();
  await addActivity(db, 'restore_undone', {}).catch(() => false);
  useAppStore.getState().invalidateData();
}
