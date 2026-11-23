import Constants from 'expo-constants';
import type { SQLiteDatabase } from 'expo-sqlite';

import { findRelease } from '@/constants/releaseNotes';
import { addActivity, buildRecap, buildTanggalTua, buildYearRecap, hasActivity, hasAnyTransactions } from '@/db/activityRepository';
import { useAppStore } from '@/store/useAppStore';
import { periodKey, shiftPeriodKey } from '@/utils/format';
import { recapDedupeKey, yearToRecap } from '@/utils/bellSchedule';
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
  return addActivity(db, 'recap', recap, { dedupeKey: recapDedupeKey(store.periodStartDay, previous), now });
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

/**
 * "Tanggal tua": once per period, in its last `TANGGAL_TUA_DAYS` days, when there is income and something
 * left (`buildTanggalTua` decides). Checked on every launch in those days until it applies.
 */
export async function logTanggalTuaIfDue(db: SQLiteDatabase, now: Date = new Date()): Promise<boolean> {
  const { periodStartDay } = useAppStore.getState();
  const period = periodKey(now, periodStartDay);
  // With the start day in it: the same key means other dates under another start day (as for recaps).
  const dedupeKey = `tanggaltua:${periodStartDay}:${period}`;
  if (await hasActivity(db, dedupeKey)) return false;
  const params = await buildTanggalTua(db, period, periodStartDay, DEFAULT_CURRENCY, now);
  return params ? addActivity(db, 'tanggal_tua', params, { dedupeKey, now }) : false;
}

/**
 * The recap of last year's periods, once, early in the new year (`yearToRecap`); nothing for a year with no
 * data. "Once" is a device marker, not the bell's history, which is trimmed after 60 days (0.4.1, B2).
 */
export async function logYearRecapIfDue(db: SQLiteDatabase, now: Date = new Date()): Promise<boolean> {
  const store = useAppStore.getState();
  const year = yearToRecap(periodKey(now, store.periodStartDay), store.lastYearRecap);
  if (year === null) return false;
  const params = await buildYearRecap(db, year, store.periodStartDay, DEFAULT_CURRENCY);
  if (!params) return false;
  store.setLastYearRecap(year);
  return addActivity(db, 'year_recap', params, { dedupeKey: `year:${year}`, now });
}

/** Runs every "something is due" check. Resolves whether anything was added. */
export async function runActivityChecks(db: SQLiteDatabase, now: Date = new Date()): Promise<boolean> {
  const results = [
    await announceNewVersionIfNeeded(db),
    await logYearRecapIfDue(db, now),
    await logPeriodRecapIfDue(db, now),
    await logTanggalTuaIfDue(db, now),
  ];
  return results.some(Boolean);
}
