/**
 * DistroLearn — Puzzle Screen
 *
 * Renders all three puzzle types from the question bank:
 *   1. sequence_ordering  — drag steps into correct order (↑/↓ buttons on mobile)
 *   2. pattern_matching   — match left items to right items
 *   3. fill_in_blank      — tap blanks to fill from a word bank
 *
 * Each puzzle tracks:
 *   - Timer (counts up)
 *   - Hint usage (costs XP)
 *   - Result: correct/incorrect with explanation
 *   - XP awarded on completion
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform, StatusBar, ActivityIndicator, PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S, R, FONT, SHADOW, TOPIC_META } from '../theme';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { ScrollView } from 'react-native-gesture-handler';
import { addXP } from '../db/database';
import { trackPuzzleCompleted } from '../services/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PuzzleStep { id: number; text: string }
interface PuzzlePair  { left: string; right: string }

interface Puzzle {
  id: string;
  type: 'sequence_ordering' | 'pattern_matching' | 'fill_in_blank';
  topic: string;
  difficulty: string;
  xp: number;
  title: string;
  instructions: string;
  // sequence_ordering
  steps?: PuzzleStep[];
  correct_order?: number[];
  // pattern_matching
  pairs?: PuzzlePair[];
  // fill_in_blank
  question?: string;
  blanks?: Record<string, string>;
  hint?: string;
  explanation?: string;
}

interface Props {
  userId: string;
  puzzles: Puzzle[];
  onComplete: (xpEarned: number) => void;
  onExit: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PuzzleScreen({ userId, puzzles, onComplete, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [allDone, setAllDone] = useState(false);

  const swipeBack = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.x0 < 30,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx > 10 && Math.abs(gs.dy) < 80 && gs.dx > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 60) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onExit();
        }
      },
    }),
  ).current;

  const puzzle = puzzles[puzzleIdx];

  const handlePuzzleComplete = useCallback(async (xpEarned: number, correct: boolean) => {
    await addXP(userId, xpEarned);
    const newTotal = totalXp + xpEarned;
    setTotalXp(newTotal);
    trackPuzzleCompleted({
      puzzleId: puzzles[puzzleIdx].id,
      type:     puzzles[puzzleIdx].type,
      topic:    puzzles[puzzleIdx].topic,
      xpEarned,
      correct,
    });

    if (puzzleIdx + 1 >= puzzles.length) {
      setAllDone(true);
    } else {
      setPuzzleIdx(i => i + 1);
    }
  }, [puzzleIdx, puzzles, totalXp, userId]);

  if (allDone) return (
    <DoneScreen totalXp={totalXp} count={puzzles.length} onExit={() => onComplete(totalXp)} />
  );

  if (!puzzle) return (
    <View style={[gs.container, gs.centered]}>
      <Text style={gs.emptyText}>No puzzles available</Text>
      <TouchableOpacity style={gs.exitBtn} onPress={onExit}>
        <Text style={gs.exitBtnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Don't attach PanResponder for sequence_ordering — it conflicts with DraggableFlatList gestures
  const panProps = puzzle.type === 'sequence_ordering' ? {} : swipeBack.panHandlers;

  return (
    <View style={[gs.container, { paddingTop: insets.top }]} {...panProps}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={gs.header}>
        <TouchableOpacity onPress={onExit} style={gs.backBtn}>
          <Text style={gs.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={gs.headerMeta}>
          <Text style={gs.headerTopic}>
            {TOPIC_META[puzzle.topic]?.icon ?? '⊞'} {TOPIC_META[puzzle.topic]?.label ?? puzzle.topic}
          </Text>
          <Text style={gs.headerProgress}>{puzzleIdx + 1}/{puzzles.length}</Text>
        </View>
        <View style={gs.xpPill}>
          <Text style={gs.xpPillText}>+{totalXp} XP</Text>
        </View>
      </View>

      {puzzle.type === 'sequence_ordering' && (
        <SequencePuzzle key={puzzle.id} puzzle={puzzle} onComplete={(xp, c) => handlePuzzleComplete(xp, c)} />
      )}
      {puzzle.type === 'pattern_matching' && (
        <PatternPuzzle key={puzzle.id} puzzle={puzzle} onComplete={(xp, c) => handlePuzzleComplete(xp, c)} />
      )}
      {puzzle.type === 'fill_in_blank' && (
        <FillBlankPuzzle key={puzzle.id} puzzle={puzzle} onComplete={(xp, c) => handlePuzzleComplete(xp, c)} />
      )}
    </View>
  );
}

// ─── Sequence Ordering Puzzle ─────────────────────────────────────────────────

type StepItem = { id: number; text: string };

function SequencePuzzle({ puzzle, onComplete }: { puzzle: Puzzle; onComplete: (xp: number, correct: boolean) => void }) {
  const [items, setItems] = useState<StepItem[]>(
    puzzle.steps ? shuffleArray([...puzzle.steps]) : []
  );
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function submit() {
    if (timerRef.current) clearInterval(timerRef.current);
    const currentOrder = items.map(s => s.id);
    const isCorrect = JSON.stringify(currentOrder) === JSON.stringify(puzzle.correct_order);
    setCorrect(isCorrect);
    setSubmitted(true);
    Haptics.notificationAsync(
      isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }

  function handleContinue() {
    const baseXP = puzzle.xp;
    const timeBonus = elapsed < 60 ? 10 : elapsed < 120 ? 5 : 0;
    const hintPenalty = hintUsed ? -10 : 0;
    const xp = correct ? Math.max(0, baseXP + timeBonus + hintPenalty) : 0;
    onComplete(xp, correct);
  }

  const renderItem = ({ item, getIndex, drag, isActive }: RenderItemParams<StepItem>) => {
    const pos = getIndex() ?? 0;
    const posCorrect = submitted && puzzle.correct_order?.[pos] === item.id;
    const posWrong   = submitted && puzzle.correct_order?.[pos] !== item.id;
    return (
      <ScaleDecorator activeScale={1.03}>
        <TouchableOpacity
          onLongPress={submitted ? undefined : drag}
          disabled={submitted}
          activeOpacity={isActive ? 1 : 0.9}
          style={[
            sp.stepRow,
            isActive && sp.stepDragging,
            submitted && posCorrect && sp.stepCorrect,
            submitted && posWrong   && sp.stepWrong,
          ]}
        >
          <View style={[sp.stepNum,
            submitted && posCorrect && { backgroundColor: C.green },
            submitted && posWrong   && { backgroundColor: C.red },
          ]}>
            <Text style={sp.stepNumText}>{pos + 1}</Text>
          </View>
          <Text style={sp.stepText}>{item.text}</Text>
          {!submitted && (
            <Text style={sp.dragHandle}>⠿</Text>
          )}
          {submitted && (
            <Text style={[sp.tick, posCorrect && { color: C.green }, posWrong && { color: C.red }]}>
              {posCorrect ? '✓' : '✗'}
            </Text>
          )}
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <DraggableFlatList
        data={items}
        keyExtractor={item => String(item.id)}
        onDragEnd={({ data }) => setItems(data)}
        renderItem={renderItem}
        containerStyle={{ flex: 1 }}
        ListHeaderComponent={() => (
          <View style={sp.scroll}>
            <PuzzleHeader
              title={puzzle.title}
              instructions={`${puzzle.instructions} Long-press and drag to reorder.`}
              difficulty={puzzle.difficulty}
              xp={puzzle.xp}
              elapsed={elapsed}
            />
          </View>
        )}
        ListFooterComponent={() => (
          <View style={sp.footer}>
            {!submitted && !hintUsed && puzzle.hint && (
              <TouchableOpacity style={sp.hintBtn} onPress={() => setHintUsed(true)}>
                <Text style={sp.hintBtnText}>💡 Show hint (−10 XP)</Text>
              </TouchableOpacity>
            )}
            {hintUsed && (
              <View style={sp.hintBox}>
                <Text style={sp.hintLabel}>HINT</Text>
                <Text style={sp.hintText}>{puzzle.hint}</Text>
              </View>
            )}
            {!submitted ? (
              <TouchableOpacity style={sp.submitBtn} onPress={submit}>
                <Text style={sp.submitText}>Check answer →</Text>
              </TouchableOpacity>
            ) : (
              <ResultBlock
                correct={correct} explanation={puzzle.explanation ?? ''}
                xpEarned={correct ? puzzle.xp : 0} anim={resultAnim}
                onContinue={handleContinue}
              />
            )}
            <View style={{ height: 80 }} />
          </View>
        )}
      />
    </View>
  );
}

const sp = StyleSheet.create({
  scroll: { paddingHorizontal: S.screenH, paddingTop: S.md, paddingBottom: 40 },
  footer: { paddingHorizontal: S.screenH, paddingTop: S.md },
  stepsCol: { gap: S.sm, marginBottom: S.xl },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1,
    borderColor: C.border, padding: S.md,
  },
  stepCorrect: { borderColor: C.green, backgroundColor: C.greenGlow },
  stepWrong:   { borderColor: C.red,   backgroundColor: C.redGlow },
  stepNum: {
    width: 28, height: 28, borderRadius: R.md, backgroundColor: C.accentDim,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontWeight: '800', color: C.accent, fontFamily: FONT.mono },
  stepText: { flex: 1, fontSize: 15, color: C.text, fontFamily: FONT.sans, lineHeight: 22 },
  stepDragging: { opacity: 0.85, shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  dragHandle: { fontSize: 20, color: C.textDim, paddingHorizontal: 4 },
  arrowCol: { gap: 2 },
  arrowBtn: { padding: 4 },
  arrow: { color: C.textDim, fontSize: 12 },
  tick: { fontSize: 18, fontWeight: '700' },
  hintBtn: {
    borderWidth: 1, borderColor: C.yellow + '55', borderRadius: R.md,
    paddingVertical: S.md, alignItems: 'center', marginBottom: S.md,
    backgroundColor: C.yellow + '10',
  },
  hintBtnText: { color: C.yellow, fontSize: 15, fontFamily: FONT.sans },
  hintBox: {
    backgroundColor: C.yellow + '10', borderRadius: R.lg, borderWidth: 1,
    borderColor: C.yellow + '33', padding: S.lg, marginBottom: S.xl,
  },
  hintLabel: { fontSize: 10, fontFamily: FONT.mono, color: C.yellow, letterSpacing: 1.5, marginBottom: 6 },
  hintText: { fontSize: 15, color: C.text, fontFamily: FONT.sans, lineHeight: 22 },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 16, alignItems: 'center',
    ...SHADOW.accent(C.accent),
  },
  submitText: { color: C.bg, fontSize: 15, fontWeight: '700', fontFamily: FONT.sans },
});

// ─── Pattern Matching Puzzle ──────────────────────────────────────────────────

function PatternPuzzle({ puzzle, onComplete }: { puzzle: Puzzle; onComplete: (xp: number, correct: boolean) => void }) {
  const pairs = puzzle.pairs ?? [];
  const [selected, setSelected] = useState<string | null>(null);  // left item key
  const [matched, setMatched] = useState<Record<string, string>>({}); // left → right
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultAnim = useRef(new Animated.Value(0)).current;

  // Shuffle right-side options
  const [rightOptions] = useState(() => shuffleArray(pairs.map(p => p.right)));

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function selectLeft(left: string) {
    if (matched[left]) return; // Already matched
    setSelected(l => l === left ? null : left);
    Haptics.selectionAsync();
  }

  function selectRight(right: string) {
    if (!selected) return;
    if (Object.values(matched).includes(right)) return; // Already matched

    const correctRight = pairs.find(p => p.left === selected)?.right;
    if (right === correctRight) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setMatched(m => ({ ...m, [selected]: right }));
      setSelected(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setWrongPair(selected);
      setTimeout(() => { setWrongPair(null); setSelected(null); }, 700);
    }
  }

  // Auto-submit when all matched
  useEffect(() => {
    if (Object.keys(matched).length === pairs.length && pairs.length > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    }
  }, [matched, pairs.length]);

  function handleContinue() {
    const allCorrect = pairs.every(p => matched[p.left] === p.right);
    const xp = allCorrect ? puzzle.xp : Math.floor(puzzle.xp * 0.4);
    onComplete(xp, allCorrect);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={pm.scroll} showsVerticalScrollIndicator={false}>
      <PuzzleHeader
        title={puzzle.title} instructions={puzzle.instructions}
        difficulty={puzzle.difficulty} xp={puzzle.xp} elapsed={elapsed}
      />

      <View style={pm.columns}>
        {/* Left column */}
        <View style={pm.col}>
          <Text style={pm.colHeader}>CONCEPT</Text>
          {pairs.map(p => {
            const isMatched = !!matched[p.left];
            const isSel = selected === p.left;
            const isWrong = wrongPair === p.left;
            return (
              <TouchableOpacity
                key={p.left}
                style={[
                  pm.chip, pm.leftChip,
                  isSel   && { borderColor: C.accent, backgroundColor: C.accentDim },
                  isMatched && { borderColor: C.green, backgroundColor: C.greenGlow, opacity: 0.8 },
                  isWrong && { borderColor: C.red, backgroundColor: C.redGlow },
                ]}
                onPress={() => selectLeft(p.left)}
                disabled={isMatched}
                activeOpacity={0.75}
              >
                <Text style={[pm.chipText, isSel && { color: C.accent }, isMatched && { color: C.green }]}
                  numberOfLines={3}>
                  {p.left}
                </Text>
                {isMatched && <Text style={pm.matchIcon}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Arrow column */}
        <View style={pm.arrowCol}>
          {pairs.map((_, i) => (
            <View key={i} style={pm.arrowWrap}>
              <Text style={pm.arrowText}>→</Text>
            </View>
          ))}
        </View>

        {/* Right column */}
        <View style={pm.col}>
          <Text style={pm.colHeader}>PROPERTY</Text>
          {rightOptions.map((right, ri) => {
            const isMatched = Object.values(matched).includes(right);
            return (
              <TouchableOpacity
                key={`right-${ri}`}
                style={[
                  pm.chip, pm.rightChip,
                  isMatched && { borderColor: C.green, backgroundColor: C.greenGlow, opacity: 0.8 },
                  selected && !isMatched && { borderColor: C.accent + '55' },
                ]}
                onPress={() => selectRight(right)}
                disabled={isMatched}
                activeOpacity={0.75}
              >
                <Text style={[pm.chipText, isMatched && { color: C.green }]} numberOfLines={4}>
                  {right}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {submitted && (
        <ResultBlock
          correct explanation={puzzle.explanation ?? ''}
          xpEarned={puzzle.xp} anim={resultAnim}
          onContinue={handleContinue}
        />
      )}

      {!submitted && (
        <Text style={pm.hint}>Tap a concept, then tap its matching property</Text>
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const pm = StyleSheet.create({
  scroll: { paddingHorizontal: S.screenH, paddingTop: S.md, paddingBottom: 40 },
  columns: { flexDirection: 'row', gap: 6, marginBottom: S.xl },
  col: { flex: 1, gap: 8 },
  colHeader: { fontSize: 9, color: C.textDim, fontFamily: FONT.mono, letterSpacing: 1.5, textAlign: 'center', marginBottom: 4 },
  chip: {
    borderRadius: R.md, borderWidth: 1.5, borderColor: C.border,
    padding: S.sm, minHeight: 52, justifyContent: 'center',
    backgroundColor: C.card,
  },
  leftChip: {},
  rightChip: {},
  chipText: { fontSize: 13, color: C.text, fontFamily: FONT.sans, lineHeight: 18 },
  matchIcon: { color: C.green, fontSize: 14, marginTop: 4 },
  arrowCol: { width: 20, justifyContent: 'space-around', paddingTop: 32 },
  arrowWrap: { height: 60, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: C.textDim, fontSize: 14 },
  hint: { textAlign: 'center', color: C.textDim, fontSize: 12, fontFamily: FONT.mono, letterSpacing: 0.5 },
});

// ─── Fill-in-the-Blank Puzzle ─────────────────────────────────────────────────

function FillBlankPuzzle({ puzzle, onComplete }: { puzzle: Puzzle; onComplete: (xp: number, correct: boolean) => void }) {
  const blanks = puzzle.blanks ?? {};
  const blankKeys = Object.keys(blanks);

  // Replace {{key}} with selectable slot
  const questionText = puzzle.question ?? '';
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [activeBlank, setActiveBlank] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultAnim = useRef(new Animated.Value(0)).current;

  // Build word bank from blank values, shuffled
  const [wordBank] = useState(() => shuffleArray(Object.values(blanks)));

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function fillBlank(word: string) {
    if (!activeBlank) return;
    if (Object.values(userAnswers).includes(word)) return; // Already used
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUserAnswers(a => ({ ...a, [activeBlank]: word }));
    setActiveBlank(null);
  }

  function clearBlank(key: string) {
    setUserAnswers(a => { const n = { ...a }; delete n[key]; return n; });
    setActiveBlank(key);
  }

  function submit() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitted(true);
    const allCorrect = blankKeys.every(k => userAnswers[k] === blanks[k]);
    Haptics.notificationAsync(
      allCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    Animated.spring(resultAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }

  function handleContinue() {
    const correctCount = blankKeys.filter(k => userAnswers[k] === blanks[k]).length;
    const allCorrect = correctCount === blankKeys.length;
    const xp = Math.round((correctCount / blankKeys.length) * puzzle.xp);
    onComplete(xp, allCorrect);
  }

  const allFilled = blankKeys.every(k => userAnswers[k]);

  // Render question with blank slots inline
  function renderQuestion() {
    const parts = questionText.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      const match = part.match(/\{\{([^}]+)\}\}/);
      if (!match) return <Text key={i} style={fb.questionText}>{part}</Text>;

      const key = match[1];
      const filled = userAnswers[key];
      const isActive = activeBlank === key;
      const isCorrect = submitted && filled === blanks[key];
      const isWrong = submitted && filled !== blanks[key];

      return (
        <TouchableOpacity
          key={i}
          style={[
            fb.blank,
            isActive && { borderColor: C.accent, backgroundColor: C.accentDim },
            filled && !submitted && { borderColor: C.textMid, backgroundColor: C.surface },
            isCorrect && { borderColor: C.green, backgroundColor: C.greenGlow },
            isWrong && { borderColor: C.red, backgroundColor: C.redGlow },
          ]}
          onPress={() => {
            if (!submitted) {
              if (filled) clearBlank(key);
              else setActiveBlank(key);
            }
          }}
          disabled={submitted}
        >
          <Text style={[
            fb.blankText,
            isActive && { color: C.accent },
            filled && { color: isCorrect ? C.green : isWrong ? C.red : C.text },
          ]}>
            {filled ?? (isActive ? '...' : '  ______  ')}
          </Text>
        </TouchableOpacity>
      );
    });
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={fb.scroll} showsVerticalScrollIndicator={false}>
      <PuzzleHeader
        title={puzzle.title} instructions={puzzle.instructions}
        difficulty={puzzle.difficulty} xp={puzzle.xp} elapsed={elapsed}
      />

      {/* Question with inline blanks */}
      <View style={fb.questionBox}>
        <Text style={fb.questionLabel}>FILL IN THE BLANKS</Text>
        <View style={fb.questionWrap}>
          {renderQuestion()}
        </View>
      </View>

      {/* Word bank */}
      {!submitted && (
        <View style={fb.wordBankBox}>
          <Text style={fb.wordBankLabel}>WORD BANK — tap a blank, then tap a word</Text>
          <View style={fb.wordBankRow}>
            {wordBank.map((word, wi) => {
              const used = Object.values(userAnswers).includes(word);
              return (
                <TouchableOpacity
                  key={`word-${wi}`}
                  style={[fb.word, used && fb.wordUsed]}
                  onPress={() => fillBlank(word)}
                  disabled={used || !activeBlank}
                  activeOpacity={0.75}
                >
                  <Text style={[fb.wordText, used && { color: C.textDim }]}>{word}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Submit */}
      {!submitted ? (
        <TouchableOpacity
          style={[fb.submitBtn, !allFilled && fb.submitDisabled]}
          onPress={submit} disabled={!allFilled}
        >
          <Text style={fb.submitText}>Check answers →</Text>
        </TouchableOpacity>
      ) : (
        <ResultBlock
          correct={blankKeys.every(k => userAnswers[k] === blanks[k])}
          explanation={puzzle.explanation ?? ''}
          xpEarned={Math.round(
            (blankKeys.filter(k => userAnswers[k] === blanks[k]).length / blankKeys.length) * puzzle.xp
          )}
          anim={resultAnim}
          onContinue={handleContinue}
        />
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const fb = StyleSheet.create({
  scroll: { paddingHorizontal: S.screenH, paddingTop: S.md, paddingBottom: 40 },
  questionBox: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl, marginBottom: S.xl,
  },
  questionLabel: { fontSize: 9, color: C.textDim, fontFamily: FONT.mono, letterSpacing: 1.5, marginBottom: S.md },
  questionWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  questionText: { fontSize: 16, color: C.text, fontFamily: FONT.sans, lineHeight: 26 },
  blank: {
    borderBottomWidth: 2, borderColor: C.textDim, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: R.sm, minWidth: 80, alignItems: 'center',
  },
  blankText: { fontSize: 15, color: C.textMid, fontFamily: FONT.sans, fontWeight: '600' },
  wordBankBox: {
    backgroundColor: C.surface, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.lg, marginBottom: S.xl, gap: S.md,
  },
  wordBankLabel: { fontSize: 9, color: C.textDim, fontFamily: FONT.mono, letterSpacing: 1.5 },
  wordBankRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  word: {
    backgroundColor: C.card, borderRadius: R.md, borderWidth: 1,
    borderColor: C.border, paddingHorizontal: S.md, paddingVertical: S.sm,
  },
  wordUsed: { opacity: 0.3 },
  wordText: { fontSize: 15, color: C.text, fontFamily: FONT.sans },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 16, alignItems: 'center',
    ...SHADOW.accent(C.accent),
  },
  submitDisabled: { opacity: 0.35, shadowOpacity: 0 },
  submitText: { color: C.bg, fontSize: 15, fontWeight: '700', fontFamily: FONT.sans },
});

// ─── Shared: Puzzle Header + Timer ────────────────────────────────────────────

function PuzzleHeader({ title, instructions, difficulty, xp, elapsed }: {
  title: string; instructions: string; difficulty: string; xp: number; elapsed: number;
}) {
  const diffColor = difficulty === 'advanced' ? C.red : difficulty === 'intermediate' ? C.yellow : C.green;
  return (
    <View style={ph.wrap}>
      <View style={ph.topRow}>
        <View style={[ph.diffBadge, { borderColor: diffColor + '55', backgroundColor: diffColor + '18' }]}>
          <Text style={[ph.diffText, { color: diffColor }]}>{difficulty}</Text>
        </View>
        <View style={ph.xpBadge}>
          <Text style={ph.xpText}>+{xp} XP</Text>
        </View>
        <View style={ph.timer}>
          <Text style={ph.timerText}>
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </Text>
        </View>
      </View>
      <Text style={ph.title}>{title}</Text>
      <Text style={ph.instructions}>{instructions}</Text>
    </View>
  );
}
const ph = StyleSheet.create({
  wrap: { marginBottom: S.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md },
  diffBadge: { borderRadius: R.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  diffText: { fontSize: 11, fontWeight: '700', fontFamily: FONT.sans },
  xpBadge: { backgroundColor: C.accentDim, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 3 },
  xpText: { fontSize: 11, fontWeight: '700', color: C.accent, fontFamily: FONT.sans },
  timer: { marginLeft: 'auto' },
  timerText: { fontSize: 13, color: C.textMid, fontFamily: FONT.mono },
  title: { fontSize: 20, fontWeight: '800', color: C.text, fontFamily: FONT.sans, marginBottom: S.sm, letterSpacing: -0.3 },
  instructions: { fontSize: 15, color: C.textMid, fontFamily: FONT.sans, lineHeight: 22 },
});

// ─── Shared: Result Block ─────────────────────────────────────────────────────

function ResultBlock({ correct, explanation, xpEarned, anim, onContinue }: {
  correct: boolean; explanation: string; xpEarned: number;
  anim: Animated.Value; onContinue: () => void;
}) {
  return (
    <Animated.View style={[rb.wrap, { transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }], opacity: anim }]}>
      <View style={[rb.banner, { backgroundColor: correct ? C.greenGlow : C.redGlow, borderColor: correct ? C.green : C.red }]}>
        <Text style={rb.bannerIcon}>{correct ? '🎉' : '💡'}</Text>
        <View style={rb.bannerText}>
          <Text style={[rb.bannerTitle, { color: correct ? C.green : C.red }]}>
            {correct ? 'Correct!' : 'Not quite'}
          </Text>
          {xpEarned > 0 && <Text style={rb.xpLabel}>+{xpEarned} XP earned</Text>}
        </View>
      </View>
      {explanation.length > 0 && (
        <View style={rb.explanation}>
          <Text style={rb.explanationLabel}>EXPLANATION</Text>
          <Text style={rb.explanationText}>{explanation}</Text>
        </View>
      )}
      <TouchableOpacity style={[rb.continueBtn, { backgroundColor: correct ? C.green : C.accent }]} onPress={onContinue}>
        <Text style={rb.continueText}>Continue →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rb = StyleSheet.create({
  wrap: { marginTop: S.xl, gap: S.lg },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: S.lg,
    borderRadius: R.lg, borderWidth: 1.5, padding: S.lg,
  },
  bannerIcon: { fontSize: 28 },
  bannerText: { gap: 4 },
  bannerTitle: { fontSize: 18, fontWeight: '800', fontFamily: FONT.sans },
  xpLabel: { fontSize: 13, color: C.textMid, fontFamily: FONT.sans },
  explanation: {
    backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1,
    borderColor: C.border, padding: S.lg, gap: S.sm,
  },
  explanationLabel: { fontSize: 9, fontFamily: FONT.mono, color: C.textDim, letterSpacing: 1.5 },
  explanationText: { fontSize: 15, color: C.text, fontFamily: FONT.sans, lineHeight: 23 },
  continueBtn: {
    borderRadius: R.lg, paddingVertical: 16, alignItems: 'center',
  },
  continueText: { color: C.bg, fontSize: 15, fontWeight: '700', fontFamily: FONT.sans },
});

// ─── Done Screen ──────────────────────────────────────────────────────────────

function DoneScreen({ totalXp, count, onExit }: { totalXp: number; count: number; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[ds.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      <Text style={ds.emoji}>🏆</Text>
      <Text style={ds.title}>Session complete!</Text>
      <Text style={ds.sub}>{count} puzzles · +{totalXp} XP earned</Text>
      <TouchableOpacity style={ds.btn} onPress={onExit}>
        <Text style={ds.btnText}>Back to home</Text>
      </TouchableOpacity>
    </View>
  );
}
const ds = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emoji: { fontSize: 56 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, fontFamily: FONT.sans },
  sub: { fontSize: 14, color: C.textMid, fontFamily: FONT.sans },
  btn: { backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 36, marginTop: 12, ...SHADOW.accent(C.accent) },
  btnText: { color: C.bg, fontSize: 15, fontWeight: '700', fontFamily: FONT.sans },
});

// ─── Global styles ────────────────────────────────────────────────────────────

const gs = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.textMid, fontSize: 14, fontFamily: FONT.sans },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.screenH, paddingVertical: S.lg, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  backIcon: { color: C.textMid, fontSize: 20 },
  headerMeta: { flex: 1, gap: 2 },
  headerTopic: { fontSize: 13, fontWeight: '600', color: C.text, fontFamily: FONT.sans },
  headerProgress: { fontSize: 11, color: C.textMid, fontFamily: FONT.mono },
  xpPill: { backgroundColor: C.accentDim, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5 },
  xpPillText: { color: C.accent, fontSize: 12, fontWeight: '700', fontFamily: FONT.sans },
  exitBtn: { backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 },
  exitBtnText: { color: C.text, fontSize: 14, fontFamily: FONT.sans },
});

// ─── Utils ────────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
