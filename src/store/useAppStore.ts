import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { sanitizePrefs } from '@/utils/sanitizePrefs';
import type { LanguagePref } from '@/i18n/core';
import type { ThemeName } from '@/theme/themes';
import { DEFAULT_PERIOD_START_DAY } from '@/utils/format';

/** Preferences that travel with a backup file (validated by `sanitizePrefs` on the way in). */
export interface PersistedPrefs {
  /** The app's theme (Settings is the only place it's chosen). */
  defaultTheme: ThemeName;
  /** `system` follows the phone's first language (§6.5). */
  language: LanguagePref;
  /** Day of the month a period starts on, 1–31 (§3). 29–31 clamp to short months' last day. */
  periodStartDay: number;
  devToolsHidden: boolean;
}

/**
 * Markers that belong to this phone only and never travel with a backup: what the bell has
 * already shown, which version / period announcements were already made.
 */
export interface DeviceMarkers {
  /** ISO time the bell was last opened; history newer than this shows the red dot. */
  notificationsSeenAt: string | null;
  /** Last app version whose "What's new" was announced in the bell. */
  lastAnnouncedVersion: string | null;
  /** Last period (key) whose recap was written to the bell. */
  lastRecapPeriod: string | null;
  /** ISO time the user confirmed a backup was saved (shown in Settings; never a reminder). */
  lastBackupAt: string | null;
}

type PersistedState = PersistedPrefs & DeviceMarkers;

export const DEFAULT_PREFS: PersistedPrefs = {
  defaultTheme: 'sakura',
  language: 'system',
  periodStartDay: DEFAULT_PERIOD_START_DAY,
  devToolsHidden: false,
};

interface AppState extends PersistedState {
  /**
   * Bumped after data changes (writes, a database reset, an Undo) so every mounted `useDbQuery`
   * re-reads. Not persisted.
   */
  dataVersion: number;
  /** The eye: the Home summary is dotted out unless this is true. Never persisted, so it starts hidden. */
  amountsVisible: boolean;
  /** The period Home and Charts show (§8.5); `null` = the current one. Not persisted: each launch starts on now. */
  selectedPeriod: string | null;
  setSelectedPeriod: (key: string | null) => void;
  /**
   * A category just made from the add-transaction form's "+ New" tile; the form selects it when it
   * regains focus, then clears this. Not persisted.
   */
  pickedCategoryId: number | null;
  setPickedCategoryId: (id: number | null) => void;
  setAmountsVisible: (visible: boolean) => void;
  setDefaultTheme: (name: ThemeName) => void;
  setLanguage: (language: LanguagePref) => void;
  setPeriodStartDay: (day: number) => void;
  setDevToolsHidden: (hidden: boolean) => void;
  /** Applies preferences from a restored backup (already sanitized). */
  applyPrefs: (prefs: Partial<PersistedPrefs>) => void;
  /** The bell was opened: everything in the history counts as seen. */
  markNotificationsSeen: () => void;
  setLastAnnouncedVersion: (version: string) => void;
  setLastRecapPeriod: (period: string) => void;
  setLastBackupAt: (iso: string) => void;
  invalidateData: () => void;
}

/**
 * UI preferences only. Domain data (categories, transactions) lives in SQLite and is read through
 * hooks, so there is a single source of truth for it.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      notificationsSeenAt: null,
      lastAnnouncedVersion: null,
      lastRecapPeriod: null,
      lastBackupAt: null,
      dataVersion: 0,
      amountsVisible: false,
      selectedPeriod: null,
      setSelectedPeriod: (selectedPeriod) => set({ selectedPeriod }),
      pickedCategoryId: null,
      setPickedCategoryId: (pickedCategoryId) => set({ pickedCategoryId }),
      setAmountsVisible: (amountsVisible) => set({ amountsVisible }),
      setDefaultTheme: (defaultTheme) => set({ defaultTheme }),
      setLanguage: (language) => set({ language }),
      setPeriodStartDay: (periodStartDay) => set({ periodStartDay }),
      setDevToolsHidden: (devToolsHidden) => set({ devToolsHidden }),
      applyPrefs: (prefs) => set(prefs),
      markNotificationsSeen: () => set({ notificationsSeenAt: new Date().toISOString() }),
      setLastAnnouncedVersion: (lastAnnouncedVersion) => set({ lastAnnouncedVersion }),
      setLastRecapPeriod: (lastRecapPeriod) => set({ lastRecapPeriod }),
      setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
      invalidateData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
    }),
    {
      name: 'tangtu-ui',
      // expo-sqlite's key-value store. Using the sync API makes zustand hydrate before the
      // first render, so the saved theme shows immediately instead of flashing the default.
      storage: createJSONStorage(() => ({
        getItem: (key) => Storage.getItemSync(key),
        setItem: (key, value) => Storage.setItemSync(key, value),
        removeItem: (key) => {
          Storage.removeItemSync(key);
        },
      })),
      // Bump `version` and handle the old shape in `migrate` whenever a persisted key is renamed
      // or its meaning changes. New keys need no bump: missing keys take their defaults.
      version: 1,
      migrate: (persisted) => (persisted ?? {}) as PersistedState,
      // Saved preferences go through the same validation as a backup file, so an unknown theme or
      // language falls back to the default instead of breaking the app.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedState>;
        const markers: Partial<DeviceMarkers> = {
          notificationsSeenAt: saved.notificationsSeenAt ?? null,
          lastAnnouncedVersion: saved.lastAnnouncedVersion ?? null,
          lastRecapPeriod: saved.lastRecapPeriod ?? null,
          lastBackupAt: saved.lastBackupAt ?? null,
        };
        return { ...current, ...markers, ...sanitizePrefs(saved) };
      },
      partialize: ({
        defaultTheme,
        language,
        periodStartDay,
        devToolsHidden,
        notificationsSeenAt,
        lastAnnouncedVersion,
        lastRecapPeriod,
        lastBackupAt,
      }): PersistedState => ({
        defaultTheme,
        language,
        periodStartDay,
        devToolsHidden,
        notificationsSeenAt,
        lastAnnouncedVersion,
        lastRecapPeriod,
        lastBackupAt,
      }),
    },
  ),
);
