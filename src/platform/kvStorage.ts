/**
 * Where the preferences and device markers (`useAppStore`) are kept. On the phone: expo-sqlite's key-value
 * store. Its sync API lets zustand hydrate before the first render, so the saved theme shows immediately
 * instead of flashing the default. The web build uses `kvStorage.web.ts` (the browser's localStorage).
 */
import Storage from 'expo-sqlite/kv-store';

export interface KvStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const kvStorage: KvStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
};
