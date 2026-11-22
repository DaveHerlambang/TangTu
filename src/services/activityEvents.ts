import Constants from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';

import { findRelease } from '@/constants/releaseNotes';
import { addActivity, buildRecap, hasAnyTransactions } from '@/db/activityRepository';
import { useAppStore } from '@/store/useAppStore';
import { periodKey, shiftPeriodKey } from '@/utils/format';
import { DEFAULT_CURRENCY } from '@/utils/money';

/**
 * Things the app tells you about in the bell (§8.7) — in-app only, never an OS notification. Each one
 * is written once. Checked at launch and when the app comes back to the foreground.
 */

/** The version this build is. */
export const appVersion = (): string => Constants.expoConfig?.version ?? '';

/**
 * When a new period has started, writes the recap of the one that just ended — once. A period with
 * nothing logged (e.g. the app was only just installed) gets no recap.
 */
export async function logPeriodRecapIfDue(db: SQLiteDatabase, now: Date = new Date()): Promise<boolean> {
  const store = useAppStore.getState();
  const previous = shiftPeriodKey(periodKey(now, store.periodStartDay), -1);
  if (store.lastRecapPeriod !== null && store.lastRecapPeriod >= previous) return false;
  // Mark it handled first: whatever happens below, the same period isn't evaluated again.
  store.setLastRecapPeriod(previous);
  const recap = await buildRecap(db, previous, store.periodStartDay, DEFAULT_CURRENCY);
  if (!recap) return false;
  return addActivity(db, 'recap', recap, { dedupeKey: `recap:${previous}`, now });
}

/**
 * The first launch of a new version adds "What's new" to the bell. A fresh install (no version
 * recorded and no data) just remembers the version: nothing is new to someone who never saw the old one.
 */
export async function announceNewVersionIfNeeded(db: SQLiteDatabase, version: string = appVersion()): Promise<boolean> {
  const store = useAppStore.getState();
  if (!version || store.lastAnnouncedVersion === version) return false;
  const fresh = store.lastAnnouncedVersion === null && !(await hasAnyTransactions(db));
  store.setLastAnnouncedVersion(version);
  if (fresh || !findRelease(version)) return false;
  return addActivity(db, 'whats_new', { version }, { dedupeKey: `whatsnew:${version}` });
}

/** Runs every "something is due" check. Resolves whether anything was added. */
export async function runActivityChecks(db: SQLiteDatabase, now: Date = new Date()): Promise<boolean> {
  const results = [await announceNewVersionIfNeeded(db), await logPeriodRecapIfDue(db, now)];
  return results.some(Boolean);
}
