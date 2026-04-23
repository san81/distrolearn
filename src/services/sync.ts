/**
 * DistroLearn — Sync Service
 *
 * Handles bidirectional sync between SQLite (local) and Supabase (remote):
 *   - pullUserSM2State: download SM-2 progress from Supabase on login
 *   - pullDueCardContent: fetch card Q&A for cards missing local content
 *   - syncOnSessionEnd: push session results + XP to Supabase
 *   - startConnectivitySync: watch network and auto-sync when online
 */
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './auth';
import { upsertCardContent, saveCardReview } from '../db/database';
import type { CardContent } from '../db/database';

// ── Pull SM-2 state ────────────────────────────────────────────────────────────

/**
 * Download the user's SM-2 card states from Supabase and merge into SQLite.
 * Called once after login to sync any progress made on another device.
 */
export async function pullUserSM2State(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('card_sm2')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return;

    for (const row of data) {
      await saveCardReview(row.card_id, userId, {
        easiness:    row.easiness,
        interval:    row.interval,
        repetitions: row.repetitions,
        nextReview:  row.next_review,
        lastQuality: row.last_quality,
      });
    }
  } catch (e) {
    console.warn('[sync] pullUserSM2State failed (offline?):', e);
  }
}

// ── Pull card content ─────────────────────────────────────────────────────────

/**
 * Fetch Q&A content for specific card IDs from Supabase, cache locally.
 */
export async function pullDueCardContent(cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('id, front, back, topic, subtopic, level')
      .in('id', cardIds);

    if (error || !data) return;

    const cards: CardContent[] = data.map(r => ({
      cardId:   r.id,
      front:    r.front,
      back:     r.back,
      topic:    r.topic,
      subtopic: r.subtopic,
      level:    r.level,
    }));

    await upsertCardContent(cards);
  } catch (e) {
    console.warn('[sync] pullDueCardContent failed (offline?):', e);
  }
}

// ── Sync on session end ───────────────────────────────────────────────────────

/**
 * Push session XP + streak to Supabase after a review session completes.
 * Local SQLite is already updated — this is best-effort remote sync.
 */
export async function syncOnSessionEnd(
  userId: string,
  xpEarned: number,
  streakDays: number,
): Promise<void> {
  try {
    await supabase.rpc('add_xp', {
      p_user_id:   userId,
      p_xp:        xpEarned,
      p_streak:    streakDays,
    });
  } catch (e) {
    console.warn('[sync] syncOnSessionEnd failed (offline?):', e);
  }
}

// ── Connectivity sync ─────────────────────────────────────────────────────────

/**
 * Subscribe to network changes. When the device comes online,
 * trigger a background SM-2 state sync.
 *
 * Returns a cleanup function to stop watching.
 */
export function startConnectivitySync(userId: string): () => void {
  let lastOnline = false;

  const unsubscribe = NetInfo.addEventListener(state => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;

    if (isOnline && !lastOnline) {
      // Just came online — sync in background
      pullUserSM2State(userId).catch(() => {});
    }
    lastOnline = isOnline;
  });

  return unsubscribe;
}
