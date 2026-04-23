/**
 * DistroLearn — Onboarding Screen
 *
 * 4 steps:
 *   0 — Welcome splash
 *   1 — Level selection (Novice / Intermediate / Advanced)
 *       Pre-seeds SM-2 EF values based on chosen level
 *   2 — Topic focus selection (multi-select)
 *   3 — Personalized plan preview → trigger initial card pull → Home
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView, Platform, StatusBar, Dimensions,
} from 'react-native';
import { C, S, R, FONT, SHADOW, TOPIC_META, SCREEN } from '../theme';
import type { UserLevel } from '../engine/sm2';
import { INITIAL_EF_BY_LEVEL } from '../engine/sm2';

interface Props {
  onComplete: (level: UserLevel, topics: string[]) => void;
}

const LEVELS = [
  {
    id: 'novice' as UserLevel,
    label: 'Novice',
    desc: 'New to distributed systems',
    detail: 'We\'ll start with fundamentals and build up gradually.',
    icon: '🌱',
    ef: INITIAL_EF_BY_LEVEL.novice,
  },
  {
    id: 'intermediate' as UserLevel,
    label: 'Intermediate',
    desc: 'Some CS / backend experience',
    detail: 'You know the basics. We\'ll push into mechanisms and trade-offs.',
    icon: '⚡',
    ef: INITIAL_EF_BY_LEVEL.intermediate,
  },
  {
    id: 'advanced' as UserLevel,
    label: 'Advanced',
    desc: 'Working software engineer',
    detail: 'Interview-level depth. Edge cases, design trade-offs, failure modes.',
    icon: '🎯',
    ef: INITIAL_EF_BY_LEVEL.advanced,
  },
];

const TOPICS = Object.entries(TOPIC_META).map(([id, meta]) => ({ id, ...meta }));

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<UserLevel | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  function nextStep() {
    Animated.timing(slideAnim, { toValue: -SCREEN.W, duration: 220, useNativeDriver: true })
      .start(() => {
        slideAnim.setValue(SCREEN.W);
        setStep(s => s + 1);
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start();
      });
  }

  function toggleTopic(id: string) {
    setTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  // ── Step 0: Welcome ─────────────────────────────────────────────────────────
  if (step === 0) return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.stepWrap, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.welcomeInner}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>DL</Text>
          </View>
          <Text style={styles.welcomeTitle}>DistroLearn</Text>
          <Text style={styles.welcomeSub}>
            Master distributed systems{'\n'}through active recall
          </Text>

          <View style={styles.pillRow}>
            {[
              { icon: '◈', label: 'Flash Cards', color: C.accent },
              { icon: '⊞', label: 'Puzzles',     color: C.orange },
              { icon: '⬡', label: 'Viz Quizzes', color: C.green },
            ].map(p => (
              <View key={p.label} style={[styles.pill, { borderColor: p.color + '44', backgroundColor: p.color + '15' }]}>
                <Text style={[styles.pillIcon, { color: p.color }]}>{p.icon}</Text>
                <Text style={[styles.pillLabel, { color: p.color }]}>{p.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.featureList}>
            {[
              '📐 SM-2 spaced repetition',
              '📱 Works offline',
              '📈 Adapts to your level',
              '🔥 Daily streaks + XP',
            ].map(f => (
              <Text key={f} style={styles.featureItem}>{f}</Text>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={nextStep}>
          <Text style={styles.primaryBtnText}>Get started →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // ── Step 1: Level ───────────────────────────────────────────────────────────
  if (step === 1) return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.stepWrap, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.stepHeader}>
          <StepDots current={1} />
          <Text style={styles.stepTitle}>What's your level?</Text>
          <Text style={styles.stepSub}>
            We'll calibrate your starting difficulty and review intervals
          </Text>
        </View>

        <View style={styles.levelCards}>
          {LEVELS.map(l => {
            const selected = level === l.id;
            return (
              <TouchableOpacity
                key={l.id}
                style={[
                  styles.levelCard,
                  selected && { borderColor: C.accent, backgroundColor: C.accentDim },
                ]}
                onPress={() => setLevel(l.id)}
                activeOpacity={0.8}
              >
                <View style={styles.levelCardTop}>
                  <Text style={styles.levelIcon}>{l.icon}</Text>
                  <View style={styles.levelCardText}>
                    <Text style={[styles.levelLabel, selected && { color: C.accent }]}>{l.label}</Text>
                    <Text style={styles.levelDesc}>{l.desc}</Text>
                  </View>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
                {selected && (
                  <Text style={styles.levelDetail}>{l.detail}</Text>
                )}
                <View style={styles.efRow}>
                  <Text style={styles.efLabel}>Starting EF</Text>
                  <Text style={[styles.efValue, selected && { color: C.accent }]}>{l.ef.toFixed(1)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !level && styles.primaryBtnDisabled]}
          onPress={() => level && nextStep()}
          disabled={!level}
        >
          <Text style={styles.primaryBtnText}>Continue →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // ── Step 2: Topics ──────────────────────────────────────────────────────────
  if (step === 2) return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.stepWrap, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.stepHeader}>
          <StepDots current={2} />
          <Text style={styles.stepTitle}>Pick your focus</Text>
          <Text style={styles.stepSub}>
            Select topics to prioritize. You can change this anytime.
          </Text>
        </View>

        <ScrollView
          style={styles.topicsScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.topicsGrid}
        >
          {TOPICS.map(t => {
            const sel = topics.includes(t.id);
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.topicChip,
                  sel && { borderColor: t.color, backgroundColor: t.color + '18' },
                ]}
                onPress={() => toggleTopic(t.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.topicIcon, { color: sel ? t.color : C.textMid }]}>{t.icon}</Text>
                <Text style={[styles.topicLabel, { color: sel ? t.color : C.textMid }]}>{t.label}</Text>
                {sel && <View style={[styles.topicDot, { backgroundColor: t.color }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.topicFooter}>
          <Text style={styles.topicCount}>
            {topics.length === 0 ? 'Select at least one topic'
              : `${topics.length} topic${topics.length > 1 ? 's' : ''} selected`}
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, topics.length === 0 && styles.primaryBtnDisabled]}
            onPress={() => topics.length > 0 && nextStep()}
            disabled={topics.length === 0}
          >
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );

  // ── Step 3: Plan preview ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.stepWrap, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.stepHeader}>
          <StepDots current={3} />
          <Text style={styles.stepTitle}>Your plan is ready</Text>
          <Text style={styles.stepSub}>
            SM-2 will adapt to your pace after every session
          </Text>
        </View>

        <View style={styles.planCard}>
          <PlanRow label="Level" value={
            LEVELS.find(l => l.id === level)?.label ?? ''
          } icon={LEVELS.find(l => l.id === level)?.icon ?? ''} color={C.accent} />
          <View style={styles.planDivider} />
          <PlanRow label="Topics queued" value={`${topics.length} focus areas`}
            icon="📚" color={C.green} />
          <View style={styles.planDivider} />
          <PlanRow label="Daily goal" value="20 cards + 2 puzzles"
            icon="🎯" color={C.orange} />
          <View style={styles.planDivider} />
          <PlanRow label="SM-2 starts at EF" value={
            (INITIAL_EF_BY_LEVEL[level!] ?? 2.5).toFixed(1)
          } icon="⚙" color={C.purple} />
        </View>

        <View style={styles.topicPreviewRow}>
          {topics.slice(0, 4).map(tid => {
            const meta = TOPIC_META[tid];
            if (!meta) return null;
            return (
              <View key={tid} style={[styles.topicPreviewChip, { borderColor: meta.color + '44' }]}>
                <Text style={[styles.topicPreviewText, { color: meta.color }]}>
                  {meta.icon} {meta.label}
                </Text>
              </View>
            );
          })}
          {topics.length > 4 && (
            <View style={[styles.topicPreviewChip, { borderColor: C.border }]}>
              <Text style={[styles.topicPreviewText, { color: C.textMid }]}>
                +{topics.length - 4} more
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, styles.primaryBtnGreen]}
          onPress={() => onComplete(level!, topics)}
        >
          <Text style={styles.primaryBtnText}>Start Learning ⚡</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <View style={dots.row}>
      {[1, 2, 3].map(i => (
        <View key={i} style={[dots.dot, i === current && dots.dotActive, i < current && dots.dotDone]} />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 20, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
  dotActive: { width: 20, backgroundColor: C.accent },
  dotDone: { backgroundColor: C.green },
});

function PlanRow({ label, value, icon, color }: {
  label: string; value: string; icon: string; color: string;
}) {
  return (
    <View style={planRow.row}>
      <Text style={planRow.icon}>{icon}</Text>
      <Text style={planRow.label}>{label}</Text>
      <Text style={[planRow.value, { color }]}>{value}</Text>
    </View>
  );
}

const planRow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  icon: { fontSize: 16, width: 24 },
  label: { flex: 1, fontSize: 14, color: C.textMid, fontFamily: FONT.sans },
  value: { fontSize: 14, fontWeight: '700', fontFamily: FONT.sans },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  stepWrap: {
    flex: 1,
    paddingTop: S.safeTop,
    paddingHorizontal: S.screenH,
    paddingBottom: S.safeBot,
  },

  // Welcome
  welcomeInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  logoMark: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    ...SHADOW.glow(C.accent),
  },
  logoMarkText: { fontFamily: FONT.mono, fontSize: 24, fontWeight: '700', color: C.bg, letterSpacing: 1 },
  welcomeTitle: { fontSize: 30, fontWeight: '800', color: C.text, fontFamily: FONT.sans, letterSpacing: -0.5 },
  welcomeSub: { fontSize: 15, color: C.textMid, fontFamily: FONT.sans, textAlign: 'center', lineHeight: 24 },
  pillRow: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap', justifyContent: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, borderWidth: 1,
  },
  pillIcon: { fontSize: 13 },
  pillLabel: { fontSize: 12, fontWeight: '600', fontFamily: FONT.sans },
  featureList: { gap: S.sm, alignSelf: 'stretch', paddingHorizontal: S.xl },
  featureItem: { fontSize: 14, color: C.textMid, fontFamily: FONT.sans },

  // Step header
  stepHeader: { marginBottom: S.xl },
  stepTitle: { fontSize: 24, fontWeight: '800', color: C.text, fontFamily: FONT.sans, letterSpacing: -0.3, marginBottom: S.sm },
  stepSub: { fontSize: 14, color: C.textMid, fontFamily: FONT.sans, lineHeight: 22 },

  // Level cards
  levelCards: { flex: 1, gap: S.md },
  levelCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1.5,
    borderColor: C.border, padding: S.lg, gap: S.sm,
  },
  levelCardTop: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  levelIcon: { fontSize: 28 },
  levelCardText: { flex: 1 },
  levelLabel: { fontSize: 16, fontWeight: '700', color: C.text, fontFamily: FONT.sans },
  levelDesc: { fontSize: 12, color: C.textMid, fontFamily: FONT.sans, marginTop: 2 },
  checkmark: { fontSize: 18, color: C.accent },
  levelDetail: { fontSize: 13, color: C.textMid, fontFamily: FONT.sans, lineHeight: 20, paddingLeft: 44 },
  efRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border },
  efLabel: { fontSize: 11, color: C.textDim, fontFamily: FONT.mono, letterSpacing: 1 },
  efValue: { fontSize: 12, fontWeight: '700', color: C.textMid, fontFamily: FONT.mono },

  // Topics
  topicsScroll: { flex: 1 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, paddingBottom: S.lg },
  topicChip: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingHorizontal: S.lg, paddingVertical: S.md,
    borderRadius: R.xl, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.card, position: 'relative',
  },
  topicIcon: { fontSize: 15 },
  topicLabel: { fontSize: 13, fontWeight: '600', fontFamily: FONT.sans },
  topicDot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 6, right: 6 },
  topicFooter: { gap: S.md },
  topicCount: { fontSize: 12, color: C.textMid, fontFamily: FONT.mono, textAlign: 'center', letterSpacing: 0.5 },

  // Plan card
  planCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1, borderColor: C.border,
    padding: S.xl, gap: S.md, marginBottom: S.lg,
  },
  planDivider: { height: 1, backgroundColor: C.border },
  topicPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.xl },
  topicPreviewChip: {
    paddingHorizontal: S.md, paddingVertical: 6,
    borderRadius: R.full, borderWidth: 1,
  },
  topicPreviewText: { fontSize: 12, fontWeight: '600', fontFamily: FONT.sans },

  // Buttons
  primaryBtn: {
    backgroundColor: C.accent, borderRadius: R.lg,
    paddingVertical: 16, alignItems: 'center',
    marginTop: S.md,
    ...SHADOW.accent(C.accent),
  },
  primaryBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  primaryBtnGreen: { backgroundColor: C.green, ...SHADOW.accent(C.green) },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: C.bg, fontFamily: FONT.sans },
});
