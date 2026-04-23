/**
 * DistroLearn — SQLite Database Layer (expo-sqlite v16)
 *
 * Schema:
 *   card_content    — cached card Q&A from Supabase
 *   card_sm2        — per-user SM-2 state (offline-safe)
 *   user_progress   — XP, level, streak
 *   review_sessions — session metadata
 *   session_cards   — per-card session records
 */
import * as SQLite from 'expo-sqlite';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CardContent {
  cardId:   string;
  front:    string;
  back:     string;
  topic:    string;
  subtopic: string;
  level:    string;   // 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
}

export interface CardSM2State {
  cardId:      string;
  userId:      string;
  easiness:    number;
  interval:    number;
  repetitions: number;
  nextReview:  string;  // YYYY-MM-DD
  lastQuality: number;
}

interface UserProgress {
  userId:        string;
  totalXp:       number;
  level:         number;
  currentStreak: number;
  longestStreak: number;
  lastReviewDate: string;
}

interface SM2Metrics {
  dueCount:      number;
  avgEasiness:   number;
  retentionRate: number;
}

// ── DB singleton ──────────────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('distrolearn.db');
  await migrate(_db);
  return _db;
}

// ── Migrations ────────────────────────────────────────────────────────────────

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS card_content (
      cardId   TEXT PRIMARY KEY,
      front    TEXT NOT NULL DEFAULT '',
      back     TEXT NOT NULL DEFAULT '',
      topic    TEXT NOT NULL DEFAULT '',
      subtopic TEXT NOT NULL DEFAULT '',
      level    TEXT NOT NULL DEFAULT 'L1'
    );

    CREATE TABLE IF NOT EXISTS card_sm2 (
      cardId      TEXT NOT NULL,
      userId      TEXT NOT NULL,
      easiness    REAL NOT NULL DEFAULT 2.5,
      interval    INTEGER NOT NULL DEFAULT 1,
      repetitions INTEGER NOT NULL DEFAULT 0,
      nextReview  TEXT NOT NULL,
      lastQuality INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (cardId, userId)
    );

    CREATE INDEX IF NOT EXISTS idx_card_sm2_user_due
      ON card_sm2(userId, nextReview);

    CREATE TABLE IF NOT EXISTS user_progress (
      userId         TEXT PRIMARY KEY,
      totalXp        INTEGER NOT NULL DEFAULT 0,
      level          INTEGER NOT NULL DEFAULT 1,
      currentStreak  INTEGER NOT NULL DEFAULT 0,
      longestStreak  INTEGER NOT NULL DEFAULT 0,
      lastReviewDate TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS review_sessions (
      id            TEXT PRIMARY KEY,
      userId        TEXT NOT NULL,
      topic         TEXT,
      startTime     TEXT NOT NULL,
      endTime       TEXT,
      xpEarned      INTEGER NOT NULL DEFAULT 0,
      cardsReviewed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_cards (
      sessionId TEXT NOT NULL,
      cardId    TEXT NOT NULL,
      rating    TEXT NOT NULL,
      quality   INTEGER NOT NULL,
      timeMs    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (sessionId, cardId)
    );
  `);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ── User Progress ─────────────────────────────────────────────────────────────

export async function getProgress(userId: string): Promise<UserProgress> {
  const db = await getDb();
  const row = await db.getFirstAsync<UserProgress>(
    'SELECT * FROM user_progress WHERE userId = ?',
    [userId],
  );
  if (row) return row;

  // Bootstrap
  const t = today();
  await db.runAsync(
    `INSERT OR IGNORE INTO user_progress (userId, totalXp, level, currentStreak, longestStreak, lastReviewDate)
     VALUES (?, 0, 1, 0, 0, '')`,
    [userId],
  );
  return { userId, totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0, lastReviewDate: '' };
}

export async function addXP(userId: string, xp: number): Promise<void> {
  const db = await getDb();
  await getProgress(userId); // Ensure row exists
  await db.runAsync(
    `UPDATE user_progress
     SET totalXp = totalXp + ?,
         level   = MAX(1, (totalXp + ?) / 400 + 1)
     WHERE userId = ?`,
    [xp, xp, userId],
  );
}

export async function updateStreak(userId: string): Promise<number> {
  const db = await getDb();
  const progress = await getProgress(userId);
  const t = today();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = yesterday.toISOString().split('T')[0];

  let streak = progress.currentStreak;
  if (progress.lastReviewDate === yd) {
    streak += 1;
  } else if (progress.lastReviewDate !== t) {
    streak = 1;
  }

  const longest = Math.max(streak, progress.longestStreak);
  await db.runAsync(
    `UPDATE user_progress
     SET currentStreak = ?, longestStreak = ?, lastReviewDate = ?
     WHERE userId = ?`,
    [streak, longest, t, userId],
  );
  return streak;
}

// ── SM-2 State ────────────────────────────────────────────────────────────────

export async function getDueCards(userId: string): Promise<CardSM2State[]> {
  const db = await getDb();
  return db.getAllAsync<CardSM2State>(
    `SELECT * FROM card_sm2 WHERE userId = ? AND nextReview <= ?`,
    [userId, today()],
  );
}

export async function getDueCardsWithContent(userId: string): Promise<(CardSM2State & CardContent)[]> {
  const db = await getDb();
  const t = today();

  // Cards with SM-2 state that are due
  const rows = await db.getAllAsync<CardSM2State & CardContent>(
    `SELECT s.*, c.front, c.back, c.topic, c.subtopic, c.level
     FROM card_sm2 s
     LEFT JOIN card_content c ON s.cardId = c.cardId
     WHERE s.userId = ? AND s.nextReview <= ?
     ORDER BY s.nextReview ASC`,
    [userId, t],
  );

  // If nothing due, return all cached content as new cards
  if (rows.length === 0) {
    const content = await db.getAllAsync<CardContent>(
      'SELECT * FROM card_content LIMIT 30',
    );
    return content.map(c => ({
      ...c,
      userId,
      easiness:    2.5,
      interval:    1,
      repetitions: 0,
      nextReview:  t,
      lastQuality: 0,
    }));
  }

  return rows;
}

export async function getCardsByTopic(userId: string, topic: string): Promise<(CardSM2State & CardContent)[]> {
  const db = await getDb();
  return db.getAllAsync<CardSM2State & CardContent>(
    `SELECT s.*, c.front, c.back, c.topic, c.subtopic, c.level
     FROM card_sm2 s
     LEFT JOIN card_content c ON s.cardId = c.cardId
     WHERE s.userId = ? AND c.topic = ?`,
    [userId, topic],
  );
}

export async function saveCardReview(
  cardId: string,
  userId: string,
  state: {
    easiness: number;
    interval: number;
    repetitions: number;
    nextReview: string;
    lastQuality: number;
  },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO card_sm2 (cardId, userId, easiness, interval, repetitions, nextReview, lastQuality)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cardId, userId) DO UPDATE SET
       easiness    = excluded.easiness,
       interval    = excluded.interval,
       repetitions = excluded.repetitions,
       nextReview  = excluded.nextReview,
       lastQuality = excluded.lastQuality`,
    [cardId, userId, state.easiness, state.interval, state.repetitions, state.nextReview, state.lastQuality],
  );
}

export async function getSM2Metrics(userId: string): Promise<SM2Metrics> {
  const db = await getDb();
  const t = today();

  const due = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM card_sm2 WHERE userId = ? AND nextReview <= ?',
    [userId, t],
  );
  const ef = await db.getFirstAsync<{ avg: number | null }>(
    'SELECT AVG(easiness) as avg FROM card_sm2 WHERE userId = ?',
    [userId],
  );
  const retention = await db.getFirstAsync<{ rate: number | null }>(
    `SELECT ROUND(AVG(CASE WHEN lastQuality >= 3 THEN 100.0 ELSE 0.0 END)) as rate
     FROM card_sm2 WHERE userId = ?`,
    [userId],
  );

  return {
    dueCount:      due?.count ?? 0,
    avgEasiness:   Math.round((ef?.avg ?? 2.5) * 100) / 100,
    retentionRate: Math.round(retention?.rate ?? 0),
  };
}

// ── Card Content Cache ─────────────────────────────────────────────────────────

export async function upsertCardContent(cards: CardContent[]): Promise<void> {
  const db = await getDb();
  for (const c of cards) {
    await db.runAsync(
      `INSERT INTO card_content (cardId, front, back, topic, subtopic, level)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(cardId) DO UPDATE SET
         front    = excluded.front,
         back     = excluded.back,
         topic    = excluded.topic,
         subtopic = excluded.subtopic,
         level    = excluded.level`,
      [c.cardId, c.front, c.back, c.topic, c.subtopic, c.level],
    );
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(
  id: string,
  userId: string,
  topic?: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO review_sessions (id, userId, topic, startTime, xpEarned, cardsReviewed)
     VALUES (?, ?, ?, ?, 0, 0)`,
    [id, userId, topic ?? null, new Date().toISOString()],
  );
}

export async function recordCardInSession(
  sessionId: string,
  cardId: string,
  rating: string,
  quality: number,
  timeMs: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO session_cards (sessionId, cardId, rating, quality, timeMs)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, cardId, rating, quality, timeMs],
  );
  await db.runAsync(
    `UPDATE review_sessions SET cardsReviewed = cardsReviewed + 1 WHERE id = ?`,
    [sessionId],
  );
}

export async function finalizeSession(sessionId: string, xpEarned: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE review_sessions SET endTime = ?, xpEarned = ? WHERE id = ?`,
    [new Date().toISOString(), xpEarned, sessionId],
  );
}

// ── Dev seed ──────────────────────────────────────────────────────────────────

/**
 * Seed local SQLite with all qbank flashcards (65 cards across 9 topics).
 * Safe to call multiple times — skips if cards already exist.
 * Also initialises SM-2 state for the given user so cards appear as due today.
 */
export async function seedDevCards(userId: string): Promise<void> {
  // Import lazily to avoid circular dep at module load time
  const { QBANK_FLASHCARDS } = await import('../qbank/loader');

  const db = await getDb();

  // Skip if already seeded
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM card_content',
  );
  if ((existing?.count ?? 0) > 0) return;

  const t = today();
  for (const c of QBANK_FLASHCARDS) {
    await db.runAsync(
      `INSERT OR IGNORE INTO card_content (cardId, front, back, topic, subtopic, level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [c.cardId, c.front, c.back, c.topic, c.subtopic, c.level],
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO card_sm2 (cardId, userId, easiness, interval, repetitions, nextReview, lastQuality)
       VALUES (?, ?, 2.5, 1, 0, ?, 0)`,
      [c.cardId, userId, t],
    );
  }
}
