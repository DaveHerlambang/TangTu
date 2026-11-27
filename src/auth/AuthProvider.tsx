import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { DomainError } from '@/db/errors';
import { isConnectionFailure } from '@/db/db';
import { supabase } from '@/db/supabase';
import { forgetSafetyCopy } from '@/services/backup';
import { useAppStore } from '@/store/useAppStore';

/**
 * Who is signed in (§4 `sign-in`, §5). `unconfigured`: the build has no Supabase settings. Accounts are made in
 * the project's dashboard (§0.4): there is no sign-up, and no password reset in the app (§14.13).
 */
export type AuthStatus = 'unconfigured' | 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: AuthStatus;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Signs out and clears this device's account markers. The data stays in the project. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let alive = true;
    const apply = (next: Session | null) => {
      if (!alive) return;
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    };
    // The saved session is read from the device; no network needed to open the app signed in.
    void client.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => apply(next));
    // Tokens refresh only while the app is in front (as Supabase advises for React Native).
    const refresh = (state: string) => (state === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh());
    refresh(AppState.currentState ?? 'active');
    const sub = AppState.addEventListener('change', refresh);
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new DomainError('auth.invalid');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) {
      useAppStore.getState().setLastEmail(email.trim());
      return;
    }
    if (isConnectionFailure(error, error.status)) throw new DomainError('connection');
    throw new DomainError('auth.invalid');
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // Local scope: this device only; other devices stay signed in.
    await supabase.auth.signOut({ scope: 'local' });
    await forgetSafetyCopy();
    useAppStore.getState().clearAccountMarkers();
    useAppStore.getState().invalidateData();
  }, []);

  const value = useMemo<AuthValue>(() => ({ status, email: session?.user.email ?? null, signIn, signOut }), [status, session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
}
