/**
 * DistroLearn — Flash Card Screen
 *
 * Full review session flow:
 *   1. Loads due cards (SQLite join with content)
 *   2. Shows card question
 *   3. User picks from 4 MCQ options (1 correct + 3 distractors from same topic)
 *   4. Result shown with full explanation; SM-2 rating auto-derived:
 *        wrong → again | correct <10s → easy | <30s → good | >30s → hard
 *   5. SM-2 state written to SQLite immediately (offline-safe)
 *   6. Cards rated < 3 re-queued for this session
 *   7. On session end: sync to Supabase, update XP + streak
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
  Dimensions, ActivityIndicator, Platform, StatusBar, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { playSound } from '../services/audio';
import {
  trackSessionStarted, trackCardReviewed, trackSessionCompleted,
  trackSessionAbandoned, trackLevelUp,
} from '../services/analytics';
import { reviewCard, calculateSessionXP, RATING_TO_QUALITY } from '../engine/sm2';
import type { Rating } from '../engine/sm2';
import type { CardContent, CardSM2State } from '../db/database';
import {
  getDueCardsWithContent, saveCardReview, createSession,
  recordCardInSession, finalizeSession, addXP, updateStreak, getProgress,
} from '../db/database';
import { pullDueCardContent } from '../services/sync';
import { syncOnSessionEnd } from '../services/sync';
import LevelUpModal from './LevelUpModal';
import { xpToLevel } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type DeckCard = CardSM2State & CardContent;
type Phase = 'question' | 'mcq' | 'result';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  topic?: string;
  onSessionComplete: (stats: { cardsReviewed: number; xpEarned: number; streakDays: number }) => void;
  onExit: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a short (≤100 char) answer from the full back text for MCQ display */
function extractShortAnswer(back: string): string {
  const firstPara = (back.split('\n')[0] ?? '').trim();
  if (!firstPara) return '';

  // Numbered list: "1. First item text. 2. Second..." → extract only first item
  const numberedMatch = firstPara.match(/^\d+\.\s+(.+?)(?=\s+\d+\.\s|$)/);
  if (numberedMatch) {
    const text = numberedMatch[1].replace(/\.\s*$/, '').trim();
    return text.length > 100 ? text.substring(0, 97) + '...' : text;
  }

  // Bullet list: "• item" or "- item"
  const bulletMatch = firstPara.match(/^[•\-\*]\s+(.+?)(?=\s+[•\-\*]\s|$)/);
  if (bulletMatch) {
    const text = bulletMatch[1].replace(/\.\s*$/, '').trim();
    return text.length > 100 ? text.substring(0, 97) + '...' : text;
  }

  // Regular prose: first sentence that ends before a capital-letter word
  const sentenceMatch = firstPara.match(/^.+?\.(?=\s+[A-Z])/);
  if (sentenceMatch) {
    const text = sentenceMatch[0].trim();
    return text.length > 100 ? text.substring(0, 97) + '...' : text;
  }

  // Fallback: hard truncate
  return firstPara.length > 100 ? firstPara.substring(0, 97) + '...' : firstPara;
}

/** Renders the card back as Markdown for the Full Answer section */
function FormattedAnswer({ text }: { text: string }) {
  // Inline require so the import only loads when result phase renders
  const Markdown = require('react-native-markdown-display').default;
  return (
    <Markdown style={mdStyles}>{text}</Markdown>
  );
}

/** Pick up to 3 unique distractors from the card pool, same topic preferred */
function pickDistractors(current: DeckCard, pool: DeckCard[], correctText: string): string[] {
  const sameTopic = pool.filter(c => c.cardId !== current.cardId && c.topic === current.topic);
  const otherTopic = pool.filter(c => c.cardId !== current.cardId && c.topic !== current.topic);

  const candidates = [...sameTopic, ...otherTopic]
    .map(c => extractShortAnswer(c.back ?? ''))
    .filter(s => s !== correctText && s.length > 15);

  // Deduplicate
  const unique = [...new Set(candidates)];
  return shuffleArray(unique).slice(0, 3);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deriveRating(isCorrect: boolean, timeMs: number): Rating {
  if (!isCorrect) return 'again';
  const s = timeMs / 1000;
  if (s < 10) return 'easy';
  if (s < 30) return 'good';
  return 'hard';
}

const RATING_META: Record<Rating, { label: string; color: string }> = {
  again: { label: 'Again',  color: '#FF6B6B' },
  hard:  { label: 'Hard',   color: '#FB923C' },
  good:  { label: 'Good',   color: '#6B9FFF' },
  easy:  { label: 'Easy',   color: '#1EE8C0' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlashCardScreen({ userId, topic, onSessionComplete, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<DeckCard[]>([]);
  const [repeatQueue, setRepeatQueue] = useState<DeckCard[]>([]);
  const [currentCard, setCurrentCard] = useState<DeckCard | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [done, setDone] = useState(false);
  const [levelUp, setLevelUp] = useState<{ newLevel: number; xpTotal: number } | null>(null);
  const [finalStreak, setFinalStreak] = useState(0);

  // MCQ state
  const [phase, setPhase] = useState<Phase>('question');
  const [mcqOptions, setMcqOptions] = useState<string[]>([]);
  const [correctOption, setCorrectOption] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Full card pool for distractor generation (wider than session's 10 cards)
  const allCardsPool = useRef<DeckCard[]>([]);
  const cardStartTime = useRef<number>(Date.now());

  // Animations
  const cardSlide = useRef(new Animated.Value(0)).current;
  const mcqFade   = useRef(new Animated.Value(0)).current;

  // Swipe-right to exit
  const swipeBack = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.x0 < 30 && gs.dx > 10 && Math.abs(gs.dy) < 80 && gs.dx > Math.abs(gs.dy),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 60) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onExit();
        }
      },
    }),
  ).current;

  // ── Load session ────────────────────────────────────────────────────────────

  useEffect(() => { loadSession(); }, []);

  async function loadSession() {
    setLoading(true);
    try {
      let cards = await getDueCardsWithContent(userId);
      if (topic) cards = cards.filter(c => c.topic === topic);

      const missingIds = cards.filter(c => !c.front).map(c => c.cardId);
      if (missingIds.length > 0) {
        await pullDueCardContent(missingIds);
        cards = await getDueCardsWithContent(userId);
        if (topic) cards = cards.filter(c => c.topic === topic);
      }

      // Store full pool for distractors before slicing to 10
      allCardsPool.current = cards;

      const sessionCards = cards.slice(0, 10);
      if (sessionCards.length === 0) { setDone(true); setLoading(false); return; }

      const sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await createSession(sid, userId, topic);
      setSessionId(sid);
      setQueue(sessionCards);
      setTotalCards(sessionCards.length);
      setCurrentCard(sessionCards[0]);
      cardStartTime.current = Date.now();
      trackSessionStarted(topic);
    } catch (e) {
      console.error('[FlashCard] Load error:', e);
    } finally {
      setLoading(false);
    }
  }

  // ── MCQ: show options ───────────────────────────────────────────────────────

  const showMCQ = useCallback(() => {
    if (!currentCard) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const correct = extractShortAnswer(currentCard.back ?? '');
    const distractors = pickDistractors(currentCard, allCardsPool.current, correct);
    const options = shuffleArray([correct, ...distractors]);

    setCorrectOption(correct);
    setMcqOptions(options);
    mcqFade.setValue(0);
    setPhase('mcq');
    Animated.timing(mcqFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [currentCard, mcqFade]);

  // ── MCQ: user selects an option ─────────────────────────────────────────────

  const selectOption = useCallback((option: string) => {
    setSelectedOption(option);
    setPhase('result');
    const isCorrect = option === correctOption;
    Haptics.notificationAsync(
      isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    playSound(isCorrect ? 'good' : 'again');
  }, [correctOption]);

  // ── Rate card (SM-2 + advance) ──────────────────────────────────────────────

  const rateCard = useCallback(async (rating: Rating, timeMs?: number) => {
    if (!currentCard || !sessionId) return;

    const elapsed = timeMs ?? (Date.now() - cardStartTime.current);
    Haptics.impactAsync(
      rating === 'easy' ? Haptics.ImpactFeedbackStyle.Medium :
      rating === 'again' ? Haptics.ImpactFeedbackStyle.Heavy :
      Haptics.ImpactFeedbackStyle.Light
    );
    playSound(rating);
    trackCardReviewed({ cardId: currentCard.cardId, topic: currentCard.topic, level: currentCard.level, rating, timeMs: elapsed });

    const result = reviewCard(rating, currentCard);

    await saveCardReview(currentCard.cardId, userId, {
      easiness: result.easiness,
      interval: result.interval,
      repetitions: result.repetitions,
      nextReview: result.nextReview,
      lastQuality: result.lastQuality,
    });
    await recordCardInSession(sessionId, currentCard.cardId, rating, result.lastQuality, elapsed);

    const xp = rating === 'easy' ? 3 : rating === 'good' ? 2 : rating === 'hard' ? 1 : 0;
    setSessionXP(prev => prev + xp);
    setReviewedCount(prev => prev + 1);

    if (result.shouldRepeatToday) {
      setRepeatQueue(prev => [...prev, { ...currentCard, ...result }]);
    }

    // Slide out current card, slide in next
    Animated.timing(cardSlide, { toValue: -SCREEN_W, duration: 220, useNativeDriver: true })
      .start(async () => {
        cardSlide.setValue(SCREEN_W);

        const nextQueue = queue.slice(1);
        if (nextQueue.length > 0) {
          setQueue(nextQueue);
          setCurrentCard(nextQueue[0]);
        } else if (repeatQueue.length > 0) {
          const repeats = [...repeatQueue];
          setRepeatQueue([]);
          setQueue(repeats);
          setCurrentCard(repeats[0]);
          setTotalCards(prev => prev + repeats.length);
        } else {
          await completeSession();
          return;
        }

        cardStartTime.current = Date.now();
        Animated.spring(cardSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start();
      });
  }, [currentCard, sessionId, queue, repeatQueue, cardSlide]);

  // ── MCQ: continue after seeing result ───────────────────────────────────────

  const continueAfterMCQ = useCallback(() => {
    if (!selectedOption) return;
    const isCorrect = selectedOption === correctOption;
    const timeMs = Date.now() - cardStartTime.current;
    const rating = deriveRating(isCorrect, timeMs);
    setPhase('question');
    setSelectedOption(null);
    setMcqOptions([]);
    setCorrectOption('');
    rateCard(rating, timeMs);
  }, [selectedOption, correctOption, rateCard]);

  // ── Complete session ────────────────────────────────────────────────────────

  async function completeSession() {
    if (!sessionId) return;
    const totalXp = sessionXP + 10;
    const progressBefore = await getProgress(userId);
    const levelBefore = xpToLevel(progressBefore.totalXp);

    await finalizeSession(sessionId, totalXp);
    await addXP(userId, totalXp);
    const streak = await updateStreak(userId);
    setFinalStreak(streak);

    const progressAfter = await getProgress(userId);
    const levelAfter = xpToLevel(progressAfter.totalXp);
    trackSessionCompleted({ cardsReviewed: reviewedCount + 1, xpEarned: totalXp, streakDays: streak, topic });

    if (levelAfter > levelBefore) {
      playSound('levelup');
      trackLevelUp({ newLevel: levelAfter, totalXp: progressAfter.totalXp });
      setLevelUp({ newLevel: levelAfter, xpTotal: progressAfter.totalXp });
    } else {
      playSound('complete');
      setDone(true);
      onSessionComplete({ cardsReviewed: reviewedCount + 1, xpEarned: totalXp, streakDays: streak });
    }

    syncOnSessionEnd(userId, totalXp, streak).catch(e =>
      console.warn('[FlashCard] Sync error (data safe locally):', e)
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[S.container, S.centered]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#5B8EFF" size="large" />
        <Text style={S.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  if (!currentCard && !loading) {
    return (
      <View style={[S.container, S.centered]}>
        <StatusBar barStyle="light-content" />
        <Text style={S.doneEmoji}>🎉</Text>
        <Text style={S.doneTitle}>All caught up!</Text>
        <Text style={S.doneBody}>No cards due for review today.</Text>
        <TouchableOpacity style={S.exitButton} onPress={onExit}>
          <Text style={S.exitButtonText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = totalCards > 0 ? reviewedCount / totalCards : 0;
  const level = currentCard?.level ?? 'L1';
  const levelColor = level === 'L5' ? '#FF5B5B' : level === 'L4' ? '#F97316'
    : level === 'L3' ? '#FBBF24' : level === 'L2' ? '#5B8EFF' : '#2DD4BF';

  // Derived rating label for result phase
  const isCorrect = selectedOption === correctOption;
  const elapsedSec = Math.round((Date.now() - cardStartTime.current) / 1000);
  const derivedRating = selectedOption ? deriveRating(isCorrect, Date.now() - cardStartTime.current) : 'good';
  const ratingMeta = RATING_META[derivedRating];

  return (
    <View style={S.container} {...(phase === 'question' ? swipeBack.panHandlers : {})}>
      <StatusBar barStyle="light-content" />
      <LevelUpModal
        visible={!!levelUp}
        newLevel={levelUp?.newLevel ?? 1}
        xpTotal={levelUp?.xpTotal ?? 0}
        onDismiss={() => {
          setLevelUp(null);
          setDone(true);
          onSessionComplete({ cardsReviewed: reviewedCount + 1, xpEarned: sessionXP + 10, streakDays: finalStreak });
        }}
      />

      {/* Header */}
      <View style={[S.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={S.exitTap} onPress={onExit} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <View style={S.backBtn}>
            <Text style={S.exitIcon}>←</Text>
          </View>
        </TouchableOpacity>
        <View style={S.progressBarTrack}>
          <View style={[S.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={S.progressLabel}>{reviewedCount}/{totalCards}</Text>
      </View>

      {/* Topic + level badge */}
      <View style={S.metaRow}>
        <View style={[S.levelBadge, { backgroundColor: `${levelColor}22`, borderColor: `${levelColor}44` }]}>
          <Text style={[S.levelBadgeText, { color: levelColor }]}>{level}</Text>
        </View>
        <Text style={S.topicLabel}>{currentCard?.topic} · {currentCard?.subtopic}</Text>
        <View style={S.xpBadge}>
          <Text style={S.xpText}>+{sessionXP} XP</Text>
        </View>
      </View>

      {/* ── Phase: question ── */}
      {phase === 'question' && (
        <Animated.View style={[S.cardArea, { transform: [{ translateX: cardSlide }] }]}>
          <View style={S.card}>
            <View style={S.cardSideLabel}>
              <Text style={S.cardSideLabelText}>QUESTION</Text>
            </View>
            <Text style={S.cardQuestion}>{currentCard?.front}</Text>
            <TouchableOpacity style={S.showOptionsBtn} onPress={showMCQ} activeOpacity={0.8}>
              <Text style={S.showOptionsBtnText}>Choose answer →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── Phase: MCQ options ── */}
      {phase === 'mcq' && (
        <Animated.ScrollView
          style={[S.mcqContainer, { opacity: mcqFade }]}
          contentContainerStyle={S.mcqContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Question recap */}
          <View style={S.mcqQuestionBox}>
            <Text style={S.mcqQuestionLabel}>QUESTION</Text>
            <Text style={S.mcqQuestion}>{currentCard?.front}</Text>
          </View>

          <Text style={S.mcqPrompt}>Select the correct answer</Text>

          {mcqOptions.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={S.mcqOption}
              onPress={() => selectOption(opt)}
              activeOpacity={0.75}
            >
              <View style={S.mcqOptionIndex}>
                <Text style={S.mcqOptionIndexText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={S.mcqOptionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      )}

      {/* ── Phase: result ── */}
      {phase === 'result' && (
        <ScrollView
          style={S.resultContainer}
          contentContainerStyle={S.resultContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Question recap */}
          <View style={S.mcqQuestionBox}>
            <Text style={S.mcqQuestionLabel}>QUESTION</Text>
            <Text style={S.mcqQuestion}>{currentCard?.front}</Text>
          </View>

          {/* Options with correct/wrong highlighted */}
          {mcqOptions.map((opt, i) => {
            const isOpt = opt === selectedOption;
            const isCor = opt === correctOption;
            return (
              <View
                key={i}
                style={[
                  S.resultOption,
                  isCor && S.resultOptionCorrect,
                  isOpt && !isCor && S.resultOptionWrong,
                ]}
              >
                <View style={[S.mcqOptionIndex,
                  isCor && { backgroundColor: C.green + '33' },
                  isOpt && !isCor && { backgroundColor: C.red + '33' },
                ]}>
                  <Text style={[S.mcqOptionIndexText,
                    isCor && { color: C.green },
                    isOpt && !isCor && { color: C.red },
                  ]}>{String.fromCharCode(65 + i)}</Text>
                </View>
                <Text style={[S.mcqOptionText,
                  isCor && { color: C.green },
                  isOpt && !isCor && { color: C.red },
                ]}>{opt}</Text>
                {isCor && <Text style={S.resultMark}>✓</Text>}
                {isOpt && !isCor && <Text style={[S.resultMark, { color: C.red }]}>✗</Text>}
              </View>
            );
          })}

          {/* Result banner */}
          <View style={[S.resultBanner, { borderColor: isCorrect ? C.green : C.red, backgroundColor: isCorrect ? C.green + '15' : C.red + '15' }]}>
            <Text style={[S.resultBannerIcon]}>{isCorrect ? '🎉' : '💡'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.resultBannerTitle, { color: isCorrect ? C.green : C.red }]}>
                {isCorrect ? 'Correct!' : 'Not quite'}
              </Text>
              <Text style={[S.resultBannerSub, { color: ratingMeta.color }]}>
                Rated <Text style={{ fontWeight: '800' }}>{ratingMeta.label}</Text>
                {isCorrect ? ` · answered in ${elapsedSec}s` : ''}
              </Text>
            </View>
          </View>

          {/* Full explanation */}
          <View style={S.explanationBox}>
            <Text style={S.explanationLabel}>FULL ANSWER</Text>
            <FormattedAnswer text={currentCard?.back ?? ''} />
            <Text style={S.sm2Info}>
              EF {currentCard?.easiness.toFixed(1)} · Rep #{currentCard?.repetitions} · {currentCard?.interval}d interval
            </Text>
          </View>

          {/* Continue */}
          <TouchableOpacity
            style={[S.continueBtn, { backgroundColor: isCorrect ? C.green : C.accent }]}
            onPress={continueAfterMCQ}
            activeOpacity={0.85}
          >
            <Text style={S.continueBtnText}>Continue →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg: '#070912', surface: '#0C1020', card: '#101525',
  border: '#222B4A', accent: '#6B9FFF', text: '#EEF1FF',
  textMid: '#8B95BE', textDim: '#454E72',
  green: '#1EE8C0', red: '#FF6B6B',
  sans: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered:  { alignItems: 'center', justifyContent: 'center', gap: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12, gap: 12,
  },
  exitTap: { padding: 2 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  exitIcon: { color: C.text, fontSize: 20, fontWeight: '700', fontFamily: C.sans },
  progressBarTrack: { flex: 1, height: 4, backgroundColor: C.surface, borderRadius: 2, overflow: 'hidden' },
  progressBarFill:  { height: '100%', backgroundColor: C.accent, borderRadius: 2 },
  progressLabel:    { color: C.textMid, fontSize: 12, fontFamily: C.mono, minWidth: 32, textAlign: 'right' },

  // Meta row
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  levelBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: C.mono },
  topicLabel: { flex: 1, color: C.textMid, fontSize: 12, fontFamily: C.sans },
  xpBadge: { backgroundColor: '#1A2240', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  xpText: { color: C.accent, fontSize: 12, fontWeight: '700', fontFamily: C.sans },

  // ── Phase: question ──
  cardArea: { flex: 1, marginHorizontal: 20 },
  card: {
    flex: 1, backgroundColor: C.card, borderRadius: 24,
    borderWidth: 1, borderColor: C.border, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  cardSideLabel: { marginBottom: 20 },
  cardSideLabelText: { fontSize: 10, fontWeight: '700', fontFamily: C.mono, letterSpacing: 1.5, color: C.accent },
  cardQuestion: { flex: 1, fontSize: 20, color: C.text, fontFamily: C.sans, lineHeight: 32, fontWeight: '500' },
  showOptionsBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  showOptionsBtnText: { color: C.bg, fontSize: 15, fontWeight: '700', fontFamily: C.sans },

  // ── Phase: MCQ ──
  mcqContainer: { flex: 1 },
  mcqContent: { paddingHorizontal: 20, paddingBottom: 20 },
  mcqQuestionBox: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, padding: 20, marginBottom: 20,
  },
  mcqQuestionLabel: { fontSize: 10, fontWeight: '700', fontFamily: C.mono, letterSpacing: 1.5, color: C.accent, marginBottom: 10 },
  mcqQuestion: { fontSize: 17, color: C.text, fontFamily: C.sans, lineHeight: 26, fontWeight: '500' },
  mcqPrompt: { color: C.textDim, fontSize: 11, fontFamily: C.mono, letterSpacing: 1, marginBottom: 12, textAlign: 'center' },
  mcqOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, padding: 14, marginBottom: 10,
  },
  mcqOptionIndex: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  mcqOptionIndexText: { fontSize: 13, fontWeight: '800', color: C.textMid, fontFamily: C.mono },
  mcqOptionText: { flex: 1, fontSize: 15, color: C.text, fontFamily: C.sans, lineHeight: 22 },

  // ── Phase: result ──
  resultContainer: { flex: 1 },
  resultContent: { paddingHorizontal: 20, paddingBottom: 20 },
  resultOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, padding: 14, marginBottom: 10,
  },
  resultOptionCorrect: { borderColor: C.green, backgroundColor: C.green + '0F' },
  resultOptionWrong:   { borderColor: C.red,   backgroundColor: C.red   + '0F' },
  resultMark: { fontSize: 18, fontWeight: '800', color: C.green },
  resultBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, borderWidth: 1.5, padding: 16, marginBottom: 16,
  },
  resultBannerIcon: { fontSize: 28 },
  resultBannerTitle: { fontSize: 18, fontWeight: '800', fontFamily: C.sans },
  resultBannerSub: { fontSize: 13, fontFamily: C.sans, marginTop: 2 },
  explanationBox: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, padding: 20, marginBottom: 16, gap: 12,
  },
  explanationLabel: { fontSize: 10, fontWeight: '700', fontFamily: C.mono, letterSpacing: 1.5, color: C.textDim },
  explanationText: { fontSize: 15, color: C.text, fontFamily: C.sans, lineHeight: 24 },
  sm2Info: { color: C.textDim, fontSize: 11, fontFamily: C.mono, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  continueBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  continueBtnText: { color: C.bg, fontSize: 15, fontWeight: '700', fontFamily: C.sans },

  // Loading / done
  loadingText: { color: C.textMid, fontSize: 14, fontFamily: C.sans, marginTop: 12 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: C.text, fontFamily: C.sans },
  doneBody: { fontSize: 14, color: C.textMid, fontFamily: C.sans, textAlign: 'center' },
  exitButton: { marginTop: 24, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  exitButtonText: { color: '#080A14', fontSize: 15, fontWeight: '700', fontFamily: C.sans },
});

// Markdown styles for the Full Answer section
const mdStyles = {
  body:       { color: C.text, fontFamily: C.sans, fontSize: 15, lineHeight: 24, backgroundColor: 'transparent' },
  heading1:   { color: C.accent, fontFamily: C.sans, fontSize: 17, fontWeight: '700' as const, marginBottom: 6, marginTop: 10 },
  heading2:   { color: C.accent, fontFamily: C.sans, fontSize: 15, fontWeight: '700' as const, marginBottom: 4, marginTop: 8 },
  strong:     { color: C.text, fontWeight: '700' as const, fontFamily: C.sans },
  em:         { color: C.textMid, fontStyle: 'italic' as const },
  code_inline:{ color: C.accent, fontFamily: C.mono, fontSize: 13, backgroundColor: C.accent + '18', paddingHorizontal: 4, borderRadius: 4 },
  code_block: { color: C.text, fontFamily: C.mono, fontSize: 13, backgroundColor: C.surface, padding: 12, borderRadius: 8, marginVertical: 6 },
  fence:      { color: C.text, fontFamily: C.mono, fontSize: 13, backgroundColor: C.surface, padding: 12, borderRadius: 8, marginVertical: 6 },
  bullet_list:{ marginVertical: 4 },
  ordered_list:{ marginVertical: 4 },
  list_item:  { marginVertical: 3 },
  bullet_list_icon: { color: C.accent, marginRight: 6, marginTop: 6 },
  ordered_list_icon:{ color: C.accent, fontFamily: C.mono, fontSize: 13, marginRight: 6 },
  blockquote: { backgroundColor: C.surface, borderLeftColor: C.accent, borderLeftWidth: 3, paddingLeft: 12, marginVertical: 6 },
  hr:         { backgroundColor: C.border, height: 1, marginVertical: 10 },
  link:       { color: C.accent },
  paragraph:  { marginVertical: 4 },
};
