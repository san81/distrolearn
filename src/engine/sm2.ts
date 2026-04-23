/**
 * DistroLearn — SM-2 Spaced Repetition Engine
 *
 * Based on the SuperMemo-2 algorithm:
 *   https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * Quality mapping:
 *   again → 0  (complete blackout)
 *   hard  → 2  (incorrect but remembered on hint)
 *   good  → 3  (correct with difficulty)
 *   easy  → 5  (perfect recall)
 */

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type UserLevel = 'novice' | 'intermediate' | 'advanced';

// ── Quality mapping ───────────────────────────────────────────────────────────

export const RATING_TO_QUALITY: Record<Rating, number> = {
  again: 0,
  hard:  2,
  good:  3,
  easy:  5,
};

// ── Initial easiness factor by user level ─────────────────────────────────────

export const INITIAL_EF_BY_LEVEL: Record<UserLevel, number> = {
  novice:       2.0,
  intermediate: 2.5,
  advanced:     2.8,
};

// ── Card state shape ──────────────────────────────────────────────────────────

export interface SM2State {
  easiness:    number;  // Easiness factor (EF), min 1.3
  interval:    number;  // Days until next review
  repetitions: number;  // Successful reviews in a row
  nextReview:  string;  // ISO date string
  lastQuality: number;  // Last quality score (0-5)
  shouldRepeatToday: boolean;
}

// ── Core SM-2 function ────────────────────────────────────────────────────────

export function reviewCard(
  rating: Rating,
  current: { easiness: number; interval: number; repetitions: number },
): SM2State {
  const q = RATING_TO_QUALITY[rating];

  let { easiness, interval, repetitions } = current;

  if (q < 3) {
    // Incorrect — repeat today, reset repetition count
    repetitions = 0;
    interval = 1;
  } else {
    // Correct
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions += 1;
  }

  // Update EF (bounded below by 1.3)
  easiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easiness = Math.max(1.3, Math.round(easiness * 100) / 100);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    easiness,
    interval,
    repetitions,
    nextReview: nextReview.toISOString().split('T')[0],
    lastQuality: q,
    shouldRepeatToday: q < 3,
  };
}

// ── Session XP calculation ────────────────────────────────────────────────────

export function calculateSessionXP(ratings: Rating[]): number {
  return ratings.reduce((total, r) => {
    const xp = r === 'easy' ? 3 : r === 'good' ? 2 : r === 'hard' ? 1 : 0;
    return total + xp;
  }, 0);
}

// ── Default state for a new card ──────────────────────────────────────────────

export function defaultSM2State(level: UserLevel = 'intermediate'): Omit<SM2State, 'shouldRepeatToday'> {
  const ef = INITIAL_EF_BY_LEVEL[level];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    easiness:    ef,
    interval:    1,
    repetitions: 0,
    nextReview:  tomorrow.toISOString().split('T')[0],
    lastQuality: 0,
  };
}
