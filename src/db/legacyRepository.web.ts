/**
 * The web build (0.6.0): there is no offline-version database in a browser, so there is never anything to move
 * (§11). Same exports as `legacyRepository.ts`, without expo-sqlite and expo-file-system.
 */
import type { LegacyData } from './legacyRepository';

export type { LegacyData } from './legacyRepository';

export const LEGACY_DATABASE_NAME = 'tangtu.db';

export async function readLegacyData(): Promise<LegacyData | null> {
  return null;
}
