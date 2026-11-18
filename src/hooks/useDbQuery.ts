import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppStore } from '@/store/useAppStore';

interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/**
 * Runs a SQLite read whenever the screen gains focus (so returning from a child screen
 * shows fresh data) and exposes `reload` for after in-screen mutations.
 * `query` must be referentially stable (wrap it in useCallback).
 */
export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>) {
  const db = useSQLiteContext();
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

  // Also re-read when data is invalidated globally (e.g. a database reset), focused or not.
  const dataVersion = useAppStore((s) => s.dataVersion);
  const seenVersion = useRef(dataVersion);
  useEffect(() => {
    if (seenVersion.current === dataVersion) return;
    seenVersion.current = dataVersion;
    void reload();
  }, [dataVersion, reload]);

  return { ...state, reload, db };
}
