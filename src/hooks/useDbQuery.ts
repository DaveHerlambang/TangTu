import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Db } from '@/db/db';
import { requireSupabase } from '@/db/supabase';
import { useAppStore } from '@/store/useAppStore';

interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/** The data handle for screens behind sign-in (every screen but `sign-in`). */
export const useDb = (): Db => requireSupabase();

/**
 * Runs a read whenever the screen gains focus (so returning from a child screen shows fresh data) and exposes
 * `reload` for "Try again" and after in-screen changes. `query` must be referentially stable (useCallback).
 * Since 0.5.0 the read goes to the account's Supabase project; a failure keeps the last data and sets `error`
 * (the screen says "Can't reach your data" with Try again, §5).
 */
export function useDbQuery<T>(query: (db: Db) => Promise<T>) {
  const db = useDb();
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: undefined, loading: true });
  // Drop responses from superseded requests so a slow read can't overwrite a newer one.
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const data = await query(db);
      if (id === requestId.current) setState({ data, error: undefined, loading: false });
    } catch (e) {
      if (id === requestId.current) {
        setState((s) => ({ ...s, error: e instanceof Error ? e : new Error(String(e)), loading: false }));
      }
    }
  }, [db, query]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Also re-read when data is invalidated globally (a write, a restore, signing out), focused or not.
  const dataVersion = useAppStore((s) => s.dataVersion);
  const seenVersion = useRef(dataVersion);
  useEffect(() => {
    if (seenVersion.current === dataVersion) return;
    seenVersion.current = dataVersion;
    void reload();
  }, [dataVersion, reload]);

  return { ...state, reload, db };
}
