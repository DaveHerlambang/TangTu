/**
 * The phone has no `localStorage`; expo-sqlite provides one, where Supabase keeps the session (Supabase's Expo
 * guide). The web build uses the browser's own (`installLocalStorage.web.ts`).
 */
import 'expo-sqlite/localStorage/install';
