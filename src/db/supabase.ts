/**
 * The one Supabase client (§2), made from the build's settings (§0.4): `EXPO_PUBLIC_SUPABASE_URL` and the
 * **publishable** key. Set up as in Supabase's Expo guide: the URL polyfill, and the session kept in
 * `localStorage` (expo-sqlite's on the phone, the browser's on the web). App only — repositories take the client as a parameter (`Db`).
 */
import 'react-native-url-polyfill/auto';
import '@/platform/installLocalStorage';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/db/database.types';
import type { Db } from '@/db/db';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

/** False for a build made without the two settings: the app shows "not set up yet" instead of crashing (§2). */
export const isConfigured = /^https:\/\/\S+$/.test(url) && key.length > 0;

export const supabase: Db | null = isConfigured
  ? createClient<Database>(url, key, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** The client, for code that only runs once someone is signed in (every screen behind sign-in). */
export function requireSupabase(): Db {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
