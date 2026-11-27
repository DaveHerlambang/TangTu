/**
 * Backup files in the web build (0.6.0, §11): the export is shared through the browser's share sheet where it
 * can share files (the iPhone: Save to Files, Drive…) and downloaded otherwise; a restore picks a file with the
 * browser's file chooser; the safety copy for "Undo restore" lives in this browser's IndexedDB (no size limit
 * worth worrying about, unlike localStorage). Same exports as `backupFiles.ts`.
 */
import { DomainError } from '@/db/errors';

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // The browser has started the download by now; the file stays in memory until the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Share where files can be shared, else download. A share the browser refuses (it can, when building the
 * backup took too long after the tap) falls back to the download; a share the user closes is just closed: the
 * caller asks "Did you save the backup?" either way.
 */
export async function shareBackupFile(name: string, json: string, dialogTitle: string): Promise<void> {
  if (typeof document === 'undefined') throw new DomainError('backup.noSharing');
  const file = new File([json], name, { type: 'application/json' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: dialogTitle });
      return;
    } catch (e) {
      if (isAbort(e)) return;
      // NotAllowedError and the like: download instead.
    }
  }
  download(file);
}

/**
 * The browser's file chooser. Resolves null on cancel: the `cancel` event where the browser has it, and, as a
 * fallback, when the page gets focus back with nothing chosen (so the Restore button never stays busy).
 */
export function pickBackupText(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then(resolve, reject);
    };
    // Focus comes back before `change` in some browsers: wait a moment before calling it a cancel.
    const onFocus = () => setTimeout(() => finish(input.files?.[0] ?? null), 1000);
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// The safety copy, in IndexedDB.

const DB_NAME = 'tangtu';
const STORE = 'files';
const KEY = 'pre-restore-backup';

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openStore();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result as T);
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB'));
    });
  } finally {
    db.close();
  }
}

export const safetyCopy = {
  async write(json: string): Promise<void> {
    await run<IDBValidKey>('readwrite', (store) => store.put(json, KEY));
  },
  /** Null when there is none. */
  async read(): Promise<string | null> {
    const value = await run<unknown>('readonly', (store) => store.get(KEY));
    return typeof value === 'string' ? value : null;
  },
  async remove(): Promise<void> {
    try {
      await run<undefined>('readwrite', (store) => store.delete(KEY));
    } catch {
      // Nothing useful to do; the next restore overwrites it.
    }
  },
};
