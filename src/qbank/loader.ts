/**
 * DistroLearn — Question Bank Loader
 *
 * Imports all qbank JSON files and exports typed arrays used by:
 *   - seedDevCards  (flashcards → SQLite)
 *   - PuzzleScreenLoader (puzzles → PuzzleScreen)
 *   - VizQuizScreen, StatsScreen (topic metadata)
 */
import replication      from '../data/qbank/qbank_replication.json';
import partitioning     from '../data/qbank/qbank_partitioning.json';
import consensus        from '../data/qbank/qbank_consensus.json';
import transactions     from '../data/qbank/qbank_transactions.json';
import storageEngines   from '../data/qbank/qbank_storage_engines.json';
import distFaults       from '../data/qbank/qbank_distributed_faults.json';
import streamProcessing from '../data/qbank/qbank_stream_processing.json';
import batchProcessing  from '../data/qbank/qbank_batch_processing.json';
import dataStructures   from '../data/qbank/qbank_data_structures.json';
import type { CardContent } from '../db/database';

// ── Raw files ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_FILES: any[] = [
  replication,
  partitioning,
  consensus,
  transactions,
  storageEngines,
  distFaults,
  streamProcessing,
  batchProcessing,
  dataStructures,
];

// ── Flashcards ────────────────────────────────────────────────────────────────

/** All 65 flashcards mapped to the CardContent schema used by SQLite. */
export const QBANK_FLASHCARDS: CardContent[] = ALL_FILES.flatMap(file =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (file.flashcards as any[]).map((c: { id: string; level: string; topic: string; subtopic: string; front: string; back: string }) => ({
    cardId:   c.id,
    front:    c.front,
    back:     c.back,
    topic:    c.topic,
    subtopic: c.subtopic,
    level:    c.level,
  })),
);

// ── Puzzles ───────────────────────────────────────────────────────────────────

export interface QBankPuzzle {
  id:          string;
  type:        'sequence_ordering' | 'pattern_matching' | 'fill_in_blank';
  topic:       string;
  subtopic:    string;
  difficulty:  string;
  xp:          number;
  title:       string;
  instructions?: string;
  hint?:       string;
  explanation: string;
  // sequence_ordering
  steps?:         Array<{ id: number; text: string }>;
  correct_order?: number[];
  // pattern_matching
  pairs?:      Array<{ left: string; right: string }>;
  // fill_in_blank
  question?:   string;
  blanks?:     Record<string, string>;
}

/** All 24 puzzles across all topics. */
export const QBANK_PUZZLES: QBankPuzzle[] = ALL_FILES.flatMap(
  file => file.puzzles as QBankPuzzle[],
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns puzzles filtered by topic. */
export function getPuzzlesByTopic(topic: string): QBankPuzzle[] {
  return QBANK_PUZZLES.filter(p => p.topic === topic);
}

/** Returns a random selection of n puzzles (optionally filtered by topic). */
export function getRandomPuzzles(n: number, topic?: string): QBankPuzzle[] {
  const pool = topic ? getPuzzlesByTopic(topic) : QBANK_PUZZLES;
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
}

/** Returns flashcards filtered by topic. */
export function getFlashcardsByTopic(topic: string): CardContent[] {
  return QBANK_FLASHCARDS.filter(c => c.topic === topic);
}

/** Returns flashcards filtered by level ('L1'–'L5'). */
export function getFlashcardsByLevel(level: string): CardContent[] {
  return QBANK_FLASHCARDS.filter(c => c.level === level);
}
