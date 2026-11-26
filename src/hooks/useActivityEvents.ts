import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/hooks/useDbQuery';
import { runActivityChecks } from '@/services/activityEvents';
import { useAppStore } from '@/store/useAppStore';

/**
 * Writes the "something is due" messages to the bell: What's new on the first launch of a new version
 * and the recap when a new period starts. Checked at launch and whenever the app returns to the
 * foreground; each message is written once.
 */
export function useActivityEvents() {
  const db = useDb();
  const invalidateData = useAppStore((s) => s.invalidateData);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        if ((await runActivityChecks(db)) && alive) invalidateData();
      } catch {
        // Best effort: the next check tries again.
      }
    };
    void run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [db, invalidateData]);
}
