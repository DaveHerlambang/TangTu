/**
 * Backup files on the phone (§11): the export goes through the share sheet (Drive, Files…), a restore picks a
 * file with the document picker, and the safety copy for "Undo restore" is a file in the app's documents. The
 * web build has its own (`backupFiles.web.ts`); `@/services/backup` uses only these functions.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BRAND } from '@/constants/brand';
import { DomainError } from '@/db/errors';

/** Deletes a file if it's there; a file that can't be removed is left for the system to clear. */
function removeQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // The cache is the app's own, and the system clears it when space runs low.
  }
}

/**
 * Earlier export files in the cache. The newest one stays until the next export: the app the user shared
 * it with may still be reading it after the share sheet closes.
 */
function removeOldExports() {
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && entry.name.startsWith(`${BRAND.name}-backup-`) && entry.name.endsWith('.json')) removeQuietly(entry);
    }
  } catch {
    // Listing failed: nothing is lost, the files only wait for the system to clear them.
  }
}

async function writeText(file: File, text: string): Promise<void> {
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
}

/**
 * Writes the backup to a JSON file and opens the share sheet. Android can't tell "saved" from "cancelled",
 * so the caller asks afterwards.
 */
export async function shareBackupFile(name: string, json: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new DomainError('backup.noSharing');
  removeOldExports();
  const file = new File(Paths.cache, name);
  await writeText(file, json);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
}

/** The text of a file the user picks, or null if they cancel. */
export async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  // The picker copied the file into the cache; once read, that copy of the data isn't needed.
  const picked = new File(result.assets[0].uri);
  try {
    return await picked.text();
  } finally {
    removeQuietly(picked);
  }
}

/**
 * In the document directory (not the cache, which Android may clear). One copy only: the data from
 * just before the *latest* restore.
 */
const safetyFile = () => new File(Paths.document, 'pre-restore-backup.json');

export const safetyCopy = {
  async write(json: string): Promise<void> {
    await writeText(safetyFile(), json);
  },
  /** Null when there is none. */
  async read(): Promise<string | null> {
    const file = safetyFile();
    return file.exists ? file.text() : null;
  },
  async remove(): Promise<void> {
    removeQuietly(safetyFile());
  },
};
