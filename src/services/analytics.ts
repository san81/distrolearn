/**
 * DistroLearn — Analytics & Crash Reporting
 *
 * Sentry  → crash reports, JS errors, performance
 * PostHog → play stats, user events, funnels, retention
 *
 * All calls are fire-and-forget, never throw.
 *
 * Setup:
 *   EXPO_PUBLIC_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
 *   EXPO_PUBLIC_POSTHOG_KEY=phc_xxxx
 */
import * as Sentry from '@sentry/react-native';
import { PostHog } from 'posthog-react-native';

// ── Clients ───────────────────────────────────────────────────────────────────

let posthog: PostHog | null = null;

export function initAnalytics(): void {
  // Sentry — crash reporting
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 0.2,          // 20% of sessions traced for performance
      environment: __DEV__ ? 'development' : 'production',
      enableNative: true,
    });
  }

  // PostHog — play stats / usage analytics
  const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    posthog = new PostHog(posthogKey, {
      host: 'https://us.i.posthog.com',
      disabled: __DEV__,              // don't pollute analytics in dev
    });
  }
}

// ── Identity ──────────────────────────────────────────────────────────────────

export function identifyUser(userId: string, email?: string): void {
  try {
    Sentry.setUser({ id: userId, email });
    posthog?.identify(userId, email ? { email } : {});
  } catch {}
}

export function resetUser(): void {
  try {
    Sentry.setUser(null);
    posthog?.reset();
  } catch {}
}

// ── Play stats events ─────────────────────────────────────────────────────────

/** User started a flashcard session */
export function trackSessionStarted(topic?: string): void {
  capture('session_started', { topic: topic ?? 'all' });
}

/** User rated a card */
export function trackCardReviewed(params: {
  cardId:  string;
  topic:   string;
  level:   string;
  rating:  'again' | 'hard' | 'good' | 'easy';
  timeMs:  number;
}): void {
  capture('card_reviewed', params);
}

/** User completed a flashcard session */
export function trackSessionCompleted(params: {
  cardsReviewed: number;
  xpEarned:      number;
  streakDays:    number;
  topic?:        string;
}): void {
  capture('session_completed', params);
}

/** User exited a session early */
export function trackSessionAbandoned(params: {
  cardsReviewed: number;
  totalCards:    number;
  topic?:        string;
}): void {
  capture('session_abandoned', {
    ...params,
    completion_pct: Math.round((params.cardsReviewed / params.totalCards) * 100),
  });
}

/** User completed a puzzle */
export function trackPuzzleCompleted(params: {
  puzzleId:  string;
  type:      string;
  topic:     string;
  xpEarned:  number;
  correct:   boolean;
}): void {
  capture('puzzle_completed', params);
}

/** User levelled up */
export function trackLevelUp(params: {
  newLevel: number;
  totalXp:  number;
}): void {
  capture('level_up', params);
}

/** User completed the Viz Quiz */
export function trackVizQuizCompleted(params: {
  score:     number;
  totalQ:    number;
  xpEarned:  number;
}): void {
  capture('viz_quiz_completed', params);
}

/** User viewed the paywall */
export function trackPaywallViewed(): void {
  capture('paywall_viewed', {});
}

/** User subscribed to Pro */
export function trackSubscribed(params: {
  packageId: string;
  price:     string;
}): void {
  capture('subscribed', params);
}

// ── Error capture ─────────────────────────────────────────────────────────────

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  try {
    if (context) Sentry.setContext('extra', context);
    Sentry.captureException(error);
  } catch {}
}

// ── Internal ──────────────────────────────────────────────────────────────────

function capture(event: string, properties: Record<string, unknown>): void {
  try {
    posthog?.capture(event, properties as any);
  } catch {}
}
