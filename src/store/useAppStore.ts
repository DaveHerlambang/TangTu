import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/platform/kvStorage';
import { sanitizePrefs } from '@/utils/sanitizePrefs';
import type { LanguagePref } from '@/i18n/core';
import type { ThemeName } from '@/theme/themes';
import { recapHandledThrough } from '@/utils/bellSchedule';
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
  /** Last year (of periods) whose recap was written to the bell (0.4.1; was the bell's history, which is trimmed). */
  lastYearRecap: number | null;
  /** ISO time the user confirmed a backup was saved (shown in Settings; never a reminder). */
  lastBackupAt: string | null;
  /** The offline version's data on this phone was moved to an account (0.5.0, §11): it is never offered again. */
  legacyMoved: boolean;
  /** "Not now" on Home's offer to move it; Settings still offers it. */
  legacyOfferDismissed: boolean;
  /**
   * The email of the last successful sign-in (0.5.0, owner: "remember me" = remember the email): the sign-in
   * screen starts with it. Kept on sign-out (that's when it's needed); never the password, never in a backup.
   */
  lastEmail: string | null;
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
  pickedCategoryId: string | null;
  setPickedCategoryId: (id: string | null) => void;
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
  setLastYearRecap: (year: number) => void;
  setLastBackupAt: (iso: string) => void;
  setLegacyMoved: () => void;
  setLastEmail: (email: string) => void;
  dismissLegacyOffer: () => void;
  /**
   * Signing out (§5): the account's markers on this device go, so the next account starts clean. What isn't the
   * account's stays: the preferences, the last announced version, the offline data's state.
   */
  clearAccountMarkers: () => void;
  invalidateData: () => void;
}

/**
 * UI preferences and device markers only. Domain data (categories, transactions, the bell) lives in the
 * account's Supabase project (since 0.5.0) and is read through hooks, so there is a single source of truth.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      notificationsSeenAt: null,
      lastAnnouncedVersion: null,
      lastRecapPeriod: null,
      lastYearRecap: null,
      lastBackupAt: null,
      legacyMoved: false,
      legacyOfferDismissed: false,
      lastEmail: null,
      dataVersion: 0,
      amountsVisible: false,
      selectedPeriod: null,
      setSelectedPeriod: (selectedPeriod) => set({ selectedPeriod }),
      pickedCategoryId: null,
      setPickedCategoryId: (pickedCategoryId) => set({ pickedCategoryId }),
      setAmountsVisible: (amountsVisible) => set({ amountsVisible }),
      setDefaultTheme: (defaultTheme) => set({ defaultTheme }),
      setLanguage: (language) => set({ language }),
      // Period keys mean other dates under another start day: the recap marker moves to the new rule (§8.7).
      setPeriodStartDay: (periodStartDay) =>
        set((s) => (s.periodStartDay === periodStartDay ? {} : { periodStartDay, lastRecapPeriod: recapHandledThrough(periodStartDay) })),
      setDevToolsHidden: (devToolsHidden) => set({ devToolsHidden }),
      applyPrefs: (prefs) =>
        set((s) =>
          prefs.periodStartDay !== undefined && prefs.periodStartDay !== s.periodStartDay
            ? { ...prefs, lastRecapPeriod: recapHandledThrough(prefs.periodStartDay) }
            : prefs,
        ),
      markNotificationsSeen: () => set({ notificationsSeenAt: new Date().toISOString() }),
      setLastAnnouncedVersion: (lastAnnouncedVersion) => set({ lastAnnouncedVersion }),
      setLastRecapPeriod: (lastRecapPeriod) => set({ lastRecapPeriod }),
      setLastYearRecap: (lastYearRecap) => set({ lastYearRecap }),
      setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
      setLegacyMoved: () => set({ legacyMoved: true }),
      setLastEmail: (lastEmail) => set({ lastEmail }),
      dismissLegacyOffer: () => set({ legacyOfferDismissed: true }),
      clearAccountMarkers: () =>
        set({
          notificationsSeenAt: null,
          lastRecapPeriod: null,
          lastYearRecap: null,
          lastBackupAt: null,
          selectedPeriod: null,
          amountsVisible: false,
        }),
      invalidateData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
    }),
    {
      name: 'tangtu-ui',
      // Synchronous on both platforms (expo-sqlite's key-value store; localStorage on the web), so zustand
      // hydrates before the first render and the saved theme shows immediately instead of flashing the default.
      storage: createJSONStorage(() => kvStorage),
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
          lastYearRecap: typeof saved.lastYearRecap === 'number' ? saved.lastYearRecap : null,
          lastBackupAt: saved.lastBackupAt ?? null,
          legacyMoved: saved.legacyMoved === true,
          legacyOfferDismissed: saved.legacyOfferDismissed === true,
          lastEmail: typeof saved.lastEmail === 'string' && saved.lastEmail.length <= 320 ? saved.lastEmail : null,
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
        lastYearRecap,
        lastBackupAt,
        legacyMoved,
        legacyOfferDismissed,
        lastEmail,
      }): PersistedState => ({
        defaultTheme,
        language,
        periodStartDay,
        devToolsHidden,
        notificationsSeenAt,
        lastAnnouncedVersion,
        lastRecapPeriod,
        lastYearRecap,
        lastBackupAt,
        legacyMoved,
        legacyOfferDismissed,
        lastEmail,
      }),
    },
  ),
);
