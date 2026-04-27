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

// expo-secure-store adapter for Supabase auth persistence.
// Supabase session JSON can exceed 2048 bytes (JWT + refresh token + user metadata),
// so large values are split across numbered chunk keys to stay within the limit.
const CHUNK_SIZE = 1800;

const ExpoSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const numChunksStr = await SecureStore.getItemAsync(`${key}.chunks`);
    if (!numChunksStr) return SecureStore.getItemAsync(key);
    const numChunks = parseInt(numChunksStr, 10);
    const parts: string[] = [];
    for (let i = 0; i < numChunks; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
      if (chunk) parts.push(chunk);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}.chunks`).catch(() => {});
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const numChunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.chunks`, String(numChunks));
    for (let i = 0; i < numChunks; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },

  async removeItem(key: string): Promise<void> {
    const numChunksStr = await SecureStore.getItemAsync(`${key}.chunks`).catch(() => null);
    if (numChunksStr) {
      const numChunks = parseInt(numChunksStr, 10);
      await SecureStore.deleteItemAsync(`${key}.chunks`).catch(() => {});
      for (let i = 0; i < numChunks; i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {});
      }
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
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
