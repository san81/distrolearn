/**
 * DistroLearn — Auth Service (Supabase + expo-secure-store)
 *
 * All auth operations go through Supabase.
 * JWT is persisted in SecureStore so restoreSession() works offline.
 */
import 'react-native-url-polyfill/auto';
import { createClient, type User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// ── Supabase client ────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// expo-secure-store adapter for Supabase auth persistence
const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            ExpoSecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthResult {
  user:  User | null;
  error: string | null;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return {
    user:  data.user ?? null,
    error: error?.message ?? null,
  };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return {
    user:  data.user ?? null,
    error: error?.message ?? null,
  };
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Attempt to restore an existing session from SecureStore.
 * Returns the User if a valid session exists, null otherwise.
 */
export async function restoreSession(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/**
 * Listen for auth state changes (sign-in / sign-out).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}
