/**
 * The web build's preferences store (0.6.0): the browser's localStorage, also synchronous, so the saved theme
 * shows on the first render like on the phone. A browser that refuses storage (private mode, storage blocked)
 * still runs the app: it just forgets the preferences.
 */
import type { KvStorage } from './kvStorage';

export type { KvStorage } from './kvStorage';

const store = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const kvStorage: KvStorage = {
  getItem: (key) => {
    try {
      return store()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      store()?.setItem(key, value);
    } catch {
      // Full or blocked: the preference lasts until the page is closed.
    }
  },
  removeItem: (key) => {
    try {
      store()?.removeItem(key);
    } catch {
      // Nothing to do.
    }
  },
};
