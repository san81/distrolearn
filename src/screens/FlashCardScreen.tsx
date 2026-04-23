/**
 * DistroLearn — Flash Card Screen
 *
 * Full review session flow:
 *   1. Loads due cards (SQLite join with content)
 *   2. If any cards have no cached content, pulls from Supabase first
 *   3. User flips card, rates it (Again/Hard/Good/Easy)
 *   4. SM-2 state written to SQLite immediately
 *   5. Cards rated < 3 re-queued for this session
 *   6. On session end: sync to Supabase, update XP + streak
 *
 * Design: dark, focused, distraction-free — card is the hero.
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

interface RatingConfig {
  key: Rating;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
}

const RATINGS: RatingConfig[] = [
  { key: 'again', label: 'Again',  sublabel: 'Forgot',    color: '#FF6B6B', bg: '#2A1012' },
  { key: 'hard',  label: 'Hard',   sublabel: 'Struggled', color: '#FB923C', bg: '#26160A' },
  { key: 'good',  label: 'Good',   sublabel: 'Got it',    color: '#6B9FFF', bg: '#0E1B3A' },
  { key: 'easy',  label: 'Easy',   sublabel: 'Perfect',   color: '#1EE8C0', bg: '#081F1C' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  topic?: string;
  onSessionComplete: (stats: { cardsReviewed: number; xpEarned: number; streakDays: number }) => void;
  onExit: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlashCardScreen({ userId, topic, onSessionComplete, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<DeckCard[]>([]);
  const [repeatQueue, setRepeatQueue] = useState<DeckCard[]>([]);
  const [currentCard, setCurrentCard] = useState<DeckCard | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [lastResult, setLastResult] = useState<{ label: string; color: string } | null>(null);
  const [done, setDone] = useState(false);
  const [levelUp, setLevelUp] = useState<{ newLevel: number; xpTotal: number } | null>(null);
  const [finalStreak, setFinalStreak] = useState(0);

  // Card start time for tracking how long each card takes
  const cardStartTime = useRef<number>(Date.now());

  // Swipe-right to exit
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

  // Flip animation
  const flipAnim = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  // ── Load session ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    setLoading(true);
    try {
      // 1. Get due cards with content from SQLite
      let cards = await getDueCardsWithContent(userId);

      // 2. Filter by topic if specified
      if (topic) cards = cards.filter(c => c.topic === topic);

      // 3. Find cards missing content (not yet cached locally)
      const missingContentIds = cards
        .filter(c => !c.front) // front being empty = content not cached
        .map(c => c.cardId);

      if (missingContentIds.length > 0) {
        await pullDueCardContent(missingContentIds);
        // Re-fetch after content pull
        cards = await getDueCardsWithContent(userId);
        if (topic) cards = cards.filter(c => c.topic === topic);
      }

      // 4. Limit session to 10 cards max
      const sessionCards = cards.slice(0, 10);

      if (sessionCards.length === 0) {
        setDone(true);
        setLoading(false);
        return;
      }

      // 5. Create session record in SQLite
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

  // ── Flip card ───────────────────────────────────────────────────────────────

  const flipCard = useCallback(() => {
    if (isFlipped) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound('flip');

    Animated.spring(flipAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
    setIsFlipped(true);
  }, [isFlipped, flipAnim]);

  // ── Rate card ───────────────────────────────────────────────────────────────

  const rateCard = useCallback(async (rating: Rating) => {
    if (!currentCard || !sessionId) return;

    Haptics.impactAsync(
      rating === 'easy' ? Haptics.ImpactFeedbackStyle.Medium :
      rating === 'again' ? Haptics.ImpactFeedbackStyle.Heavy :
      Haptics.ImpactFeedbackStyle.Light
    );
    playSound(rating);
    const timeMs = Date.now() - cardStartTime.current;
    trackCardReviewed({
      cardId: currentCard.cardId,
      topic:  currentCard.topic,
      level:  currentCard.level,
      rating,
      timeMs,
    });
    const result = reviewCard(rating, currentCard);
    const ratingConfig = RATINGS.find(r => r.key === rating)!;

    // 1. Write SM-2 state to SQLite immediately (offline-safe)
    await saveCardReview(currentCard.cardId, userId, {
      easiness: result.easiness,
      interval: result.interval,
      repetitions: result.repetitions,
      nextReview: result.nextReview,
      lastQuality: result.lastQuality,
    });

    // 2. Record in session
    await recordCardInSession(
      sessionId, currentCard.cardId, rating, result.lastQuality, timeMs
    );

    // 3. Show result flash
    setLastResult({ label: ratingConfig.label, color: ratingConfig.color });
    Animated.sequence([
      Animated.timing(resultOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(resultOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    // 4. XP: easy=3, good=2, hard=1, again=0
    const xp = rating === 'easy' ? 3 : rating === 'good' ? 2 : rating === 'hard' ? 1 : 0;
    setSessionXP(prev => prev + xp);
    setReviewedCount(prev => prev + 1);

    // 5. Handle repeat queue for 'again' / 'hard' (quality < 3)
    if (result.shouldRepeatToday) {
      setRepeatQueue(prev => [...prev, { ...currentCard, ...result }]);
    }

    // 6. Advance to next card with slide animation
    Animated.timing(cardSlide, { toValue: -SCREEN_W, duration: 220, useNativeDriver: true })
      .start(async () => {
        cardSlide.setValue(SCREEN_W); // Reset to right side
        flipAnim.setValue(0);
        setIsFlipped(false);

        const nextQueue = queue.slice(1);

        if (nextQueue.length > 0) {
          setQueue(nextQueue);
          setCurrentCard(nextQueue[0]);
        } else if (repeatQueue.length > 0) {
          // Main queue done — process repeat queue
          const repeats = [...repeatQueue];
          setRepeatQueue([]);
          setQueue(repeats);
          setCurrentCard(repeats[0]);
          setTotalCards(prev => prev + repeats.length);
        } else {
          // Session complete!
          await completeSession();
          return;
        }

        cardStartTime.current = Date.now();
        // Slide in new card
        Animated.spring(cardSlide, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start();
      });
  }, [currentCard, sessionId, queue, repeatQueue, flipAnim, cardSlide]);

  // ── Complete session ────────────────────────────────────────────────────────

  async function completeSession() {
    if (!sessionId) return;

    const xpBonus = 10;
    const totalXp = sessionXP + xpBonus;

    // Snapshot level BEFORE adding XP
    const progressBefore = await getProgress(userId);
    const levelBefore = xpToLevel(progressBefore.totalXp);

    await finalizeSession(sessionId, totalXp);
    await addXP(userId, totalXp);
    const streak = await updateStreak(userId);
    setFinalStreak(streak);

    // Check if user levelled up
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

    // Sync to Supabase (non-blocking)
    syncOnSessionEnd(userId, totalXp, streak).catch(e =>
      console.warn('[FlashCard] Sync error (data safe locally):', e)
    );
  }

  // ── Flip interpolations ─────────────────────────────────────────────────────

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1], outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#5B8EFF" size="large" />
        <Text style={styles.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  // ── No cards due ────────────────────────────────────────────────────────────

  if (!currentCard && !loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={styles.doneTitle}>All caught up!</Text>
        <Text style={styles.doneBody}>No cards due for review today.</Text>
        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Text style={styles.exitButtonText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  const progress = totalCards > 0 ? reviewedCount / totalCards : 0;
  const level = currentCard?.level ?? 'L1';
  const levelColor = level === 'L5' ? '#FF5B5B' : level === 'L4' ? '#F97316'
    : level === 'L3' ? '#FBBF24' : level === 'L2' ? '#5B8EFF' : '#2DD4BF';

  return (
    <View style={styles.container} {...swipeBack.panHandlers}>
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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.exitTap} onPress={onExit} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <View style={styles.backBtn}>
            <Text style={styles.exitIcon}>←</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{reviewedCount}/{totalCards}</Text>
      </View>

      {/* Topic + level badge */}
      <View style={styles.metaRow}>
        <View style={[styles.levelBadge, { backgroundColor: `${levelColor}22`, borderColor: `${levelColor}44` }]}>
          <Text style={[styles.levelBadgeText, { color: levelColor }]}>{level}</Text>
        </View>
        <Text style={styles.topicLabel}>{currentCard?.topic} · {currentCard?.subtopic}</Text>
        <View style={styles.xpBadge}>
          <Text style={styles.xpText}>+{sessionXP} XP</Text>
        </View>
      </View>

      {/* Card */}
      <Animated.View style={[styles.cardArea, { transform: [{ translateX: cardSlide }] }]}>

        {/* Front */}
        <Animated.View style={[
          styles.card, styles.cardFront,
          { opacity: frontOpacity, transform: [{ rotateY: frontRotate }] }
        ]}>
          <View style={styles.cardSideLabel}>
            <Text style={styles.cardSideLabelText}>QUESTION</Text>
          </View>
          <Text style={styles.cardQuestion}>{currentCard?.front}</Text>
          <TouchableOpacity style={styles.tapToReveal} onPress={flipCard} activeOpacity={0.7}>
            <Text style={styles.tapToRevealText}>Tap to reveal answer</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Back */}
        <Animated.View style={[
          styles.card, styles.cardBack,
          { opacity: backOpacity, transform: [{ rotateY: backRotate }] }
        ]}>
          <View style={[styles.cardSideLabel, styles.cardSideLabelAnswer]}>
            <Text style={[styles.cardSideLabelText, { color: '#2DD4BF' }]}>ANSWER</Text>
          </View>
          <ScrollView
            style={styles.cardAnswerScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <Text style={styles.cardAnswer}>{currentCard?.back}</Text>
          </ScrollView>
          <View style={styles.sm2Info}>
            <Text style={styles.sm2InfoText}>
              EF {currentCard?.easiness.toFixed(1)} · Rep #{currentCard?.repetitions} · {currentCard?.interval}d interval
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Rating result flash */}
      <Animated.View style={[styles.resultFlash, { opacity: resultOpacity }]}>
        {lastResult && (
          <Text style={[styles.resultFlashText, { color: lastResult.color }]}>
            {lastResult.label}
          </Text>
        )}
      </Animated.View>

      {/* Rating buttons — only shown when flipped */}
      {isFlipped && (
        <View style={styles.ratingArea}>
          <Text style={styles.ratingPrompt}>How well did you recall it?</Text>
          <View style={styles.ratingRow}>
            {RATINGS.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[styles.ratingButton, { backgroundColor: r.bg, borderColor: r.color + '55' }]}
                onPress={() => rateCard(r.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.ratingLabel, { color: r.color }]}>{r.label}</Text>
                <Text style={styles.ratingSubLabel}>{r.sublabel}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Next review preview */}
          {currentCard && (
            <Text style={styles.nextReviewHint}>
              {`Next review → ${RATINGS.map(r => {
                const result = reviewCard(r.key, currentCard);
                return `${r.label}: ${result.interval}d`;
              }).join(' · ')}`}
            </Text>
          )}
        </View>
      )}

      {/* Flip hint when not yet flipped */}
      {!isFlipped && (
        <TouchableOpacity style={styles.flipHintButton} onPress={flipCard} activeOpacity={0.7}>
          <Text style={styles.flipHintText}>Flip card</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#070912', surface: '#0C1020', card: '#101525',
  border: '#222B4A', accent: '#6B9FFF', text: '#EEF1FF',
  textMid: '#8B95BE', textDim: '#454E72',
  green: '#1EE8C0', red: '#FF6B6B',
  sans: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },

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
  progressBarTrack: {
    flex: 1, height: 4, backgroundColor: C.surface, borderRadius: 2, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', backgroundColor: C.accent, borderRadius: 2,
  },
  progressLabel: {
    color: C.textMid, fontSize: 12, fontFamily: C.mono, minWidth: 32, textAlign: 'right',
  },

  // Meta row
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, marginBottom: 16,
  },
  levelBadge: {
    borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
  },
  levelBadgeText: { fontSize: 11, fontWeight: '700', fontFamily: C.mono },
  topicLabel: { flex: 1, color: C.textMid, fontSize: 12, fontFamily: C.sans },
  xpBadge: { backgroundColor: '#1A2240', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  xpText: { color: C.accent, fontSize: 12, fontWeight: '700', fontFamily: C.sans },

  // Card
  cardArea: {
    flex: 1, marginHorizontal: 20, position: 'relative',
  },
  card: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.border,
    padding: 28, backfaceVisibility: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  cardFront: {},
  cardBack: { backgroundColor: '#0D1020' },
  cardSideLabel: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
  },
  cardSideLabelAnswer: {},
  cardSideLabelText: {
    fontSize: 10, fontWeight: '700', fontFamily: C.mono,
    letterSpacing: 1.5, color: C.accent,
  },
  cardQuestion: {
    flex: 1, fontSize: 20, color: C.text, fontFamily: C.sans,
    lineHeight: 32, fontWeight: '500',
  },
  tapToReveal: { alignItems: 'center', marginTop: 24 },
  tapToRevealText: { color: C.textDim, fontSize: 15, fontFamily: C.sans },
  cardAnswerScroll: {
    flex: 1,
  },
  cardAnswer: {
    fontSize: 20, color: C.text, fontFamily: C.sans,
    lineHeight: 32, fontWeight: '500',
  },
  sm2Info: {
    borderTopWidth: 1, borderTopColor: C.border,
    paddingTop: 12, marginTop: 'auto',
  },
  sm2InfoText: { color: C.textDim, fontSize: 11, fontFamily: C.mono },

  // Rating area
  ratingArea: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 },
  ratingPrompt: {
    color: C.textMid, fontSize: 11, fontFamily: C.mono,
    letterSpacing: 1, textAlign: 'center', marginBottom: 12,
  },
  ratingRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ratingButton: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingVertical: 12, alignItems: 'center',
  },
  ratingLabel: { fontSize: 13, fontWeight: '800', fontFamily: C.sans },
  ratingSubLabel: { fontSize: 10, color: C.textDim, fontFamily: C.sans, marginTop: 2 },
  nextReviewHint: {
    color: C.textDim, fontSize: 10, fontFamily: C.mono,
    textAlign: 'center', letterSpacing: 0.3,
  },

  // Flip hint button
  flipHintButton: {
    marginHorizontal: 20, marginBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    paddingVertical: 16, alignItems: 'center',
  },
  flipHintText: { color: C.textMid, fontSize: 14, fontFamily: C.sans },

  // Result flash
  resultFlash: {
    position: 'absolute', top: '40%', alignSelf: 'center',
    backgroundColor: '#080A14CC', borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  resultFlashText: { fontSize: 22, fontWeight: '800', fontFamily: C.sans },

  // Loading / done states
  loadingText: { color: C.textMid, fontSize: 14, fontFamily: C.sans, marginTop: 12 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: C.text, fontFamily: C.sans },
  doneBody: { fontSize: 14, color: C.textMid, fontFamily: C.sans, textAlign: 'center' },
  exitButton: {
    marginTop: 24, backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  exitButtonText: { color: '#080A14', fontSize: 15, fontWeight: '700', fontFamily: C.sans },
});
