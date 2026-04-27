/**
 * DistroLearn — Visualization Quiz Screen
 *
 * Interactive step-through of Raft leader election using react-native-svg.
 * Three phases:
 *   0 — Initial state: 5 followers, all grey
 *   1 — Election: N1's timeout fires, it becomes candidate, requests votes
 *   2 — Elected: N1 wins majority, becomes leader (crown)
 *
 * After watching the animation, user answers a comprehension question.
 * XP is awarded for correct answers.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, StatusBar, PanResponder,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S, R, FONT, SHADOW } from '../theme';
import { addXP } from '../db/database';
import { trackVizQuizCompleted } from '../services/analytics';

// ── Types ──────────────────────────────────────────────────────────────────────

interface VizNode {
  id: string;
  cx: number;
  cy: number;
  role: 'follower' | 'candidate' | 'leader';
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Props {
  userId?: string;
  onExit: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SVG_W = 340;
const SVG_H = 220;
const NODE_R = 22;

// Node positions (cx, cy) — roughly pentagon layout
const BASE_NODES: Omit<VizNode, 'role'>[] = [
  { id: 'N1', cx: 170, cy: 50  },   // top-centre → becomes candidate/leader
  { id: 'N2', cx: 290, cy: 120 },   // right
  { id: 'N3', cx: 240, cy: 200 },   // bottom-right
  { id: 'N4', cx: 100, cy: 200 },   // bottom-left
  { id: 'N5', cx: 50,  cy: 120 },   // left
];

// Edges between nodes (fully connected cluster)
const EDGES: [number, number][] = [
  [0,1],[0,2],[0,3],[0,4],
  [1,2],[1,4],
  [2,3],[3,4],
];

const PHASES = [
  {
    label: 'Initial',
    description: 'All nodes start as followers. They wait for heartbeats from a leader.',
    roles: ['follower','follower','follower','follower','follower'] as const,
    showVoteArrows: false,
    edgeActive: false,
  },
  {
    label: 'Election',
    description: "N1's election timeout fires first. It increments its term, votes for itself, and sends RequestVote RPCs to all other nodes.",
    roles: ['candidate','follower','follower','follower','follower'] as const,
    showVoteArrows: true,
    edgeActive: false,
  },
  {
    label: 'Elected',
    description: 'N1 receives votes from N3, N4, N5 — a majority (3/5). It becomes leader and begins sending heartbeats.',
    roles: ['leader','follower','follower','follower','follower'] as const,
    showVoteArrows: false,
    edgeActive: true,
  },
];

const QUESTIONS: Question[] = [
  {
    text: 'In a 5-node Raft cluster, what is the minimum number of votes (including its own) needed to win an election?',
    options: ['2 votes', '3 votes (majority)', '4 votes', 'All 5 votes'],
    correctIndex: 1,
    explanation: 'Raft requires a strict majority: ⌊n/2⌋ + 1 = 3 for n=5. This guarantees at most one leader can win in any given term.',
  },
  {
    text: 'What happens if two candidates start an election at the same time and split the vote?',
    options: [
      'The cluster permanently fails',
      'The node with the lower ID wins',
      'Both become leaders temporarily',
      'Both timeout and restart the election with a random delay',
    ],
    correctIndex: 3,
    explanation: "Raft uses randomised election timeouts (e.g. 150–300ms) so one candidate typically fires first. If votes split, both timeout and try again — this always eventually resolves.",
  },
  {
    text: "Why must a Raft candidate's log be at least as up-to-date as voters' logs to win?",
    options: [
      'To ensure the new leader has all committed entries',
      'To speed up log compaction',
      'To allow followers to skip the election',
      'To prevent network partitions',
    ],
    correctIndex: 0,
    explanation: 'If an outdated node became leader, it could overwrite committed entries. The log-up-to-date check ensures elected leaders have all entries that a majority has seen.',
  },
];

// ── Colours per role ──────────────────────────────────────────────────────────

function roleColor(role: VizNode['role']): string {
  if (role === 'leader')    return C.green;
  if (role === 'candidate') return C.orange;
  return C.accent;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VizQuizScreen({ userId, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase]       = useState(0);
  const [qIndex, setQIndex]     = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [allDone, setAllDone]   = useState(false);
  const [totalXp, setTotalXp]   = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

  const currentPhase = PHASES[phase];
  const question     = QUESTIONS[qIndex];
  const isLast       = qIndex === QUESTIONS.length - 1;

  const nodes: VizNode[] = BASE_NODES.map((n, i) => ({
    ...n,
    role: currentPhase.roles[i],
  }));

  // Crossfade when phase changes
  function changePhase(next: number) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setPhase(next);
  }

  async function handleAnswer(index: number) {
    if (answered !== null) return;
    setAnswered(index);
    const correct = index === question.correctIndex;
    Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    if (correct && userId) {
      const xp = 30;
      await addXP(userId, xp);
      setTotalXp(p => p + xp);
    }
  }

  function handleNext() {
    if (isLast) {
      trackVizQuizCompleted({ score: totalXp > 0 ? Math.round(totalXp / 30) : 0, totalQ: QUESTIONS.length, xpEarned: totalXp });
      setAllDone(true);
      return;
    }
    setAnswered(null);
    setQIndex(i => i + 1);
    setPhase(0); // Reset animation for next question
  }

  if (allDone) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.doneEmoji}>🎓</Text>
        <Text style={styles.doneTitle}>Viz Quiz complete!</Text>
        <Text style={styles.doneSub}>{QUESTIONS.length} questions · +{totalXp} XP earned</Text>
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>
            More visual quizzes coming soon — Paxos, Kafka, and more.
          </Text>
        </View>
        <TouchableOpacity style={styles.doneBtn} onPress={onExit}>
          <Text style={styles.doneBtnText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} {...swipeBack.panHandlers}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Visualization Quiz</Text>
          <Text style={styles.headerSub}>Raft Leader Election</Text>
        </View>
        <View style={styles.xpPill}>
          <Text style={styles.xpPillText}>+{totalXp} XP</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Progress dots */}
        <View style={styles.progressDots}>
          {QUESTIONS.map((_, i) => (
            <View key={i} style={[
              styles.dot,
              i === qIndex && styles.dotActive,
              i < qIndex && styles.dotDone,
            ]} />
          ))}
        </View>

        {/* SVG Visualisation */}
        <View style={styles.vizCard}>
          <View style={styles.vizHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.vizTitle}>Raft Cluster · 5 nodes</Text>
            <Text style={styles.phaseLabel}>{currentPhase.label}</Text>
          </View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={styles.svg}>

              {/* Edges */}
              {EDGES.map(([a, b], i) => {
                const na = nodes[a], nb = nodes[b];
                const color = currentPhase.edgeActive
                  ? C.green + '88'
                  : (currentPhase.showVoteArrows && (b === 0 || a === 0))
                    ? C.orange + '66'
                    : C.textXDim;
                return (
                  <Line key={i}
                    x1={na.cx} y1={na.cy}
                    x2={nb.cx} y2={nb.cy}
                    stroke={color} strokeWidth="1.5"
                    strokeDasharray={currentPhase.edgeActive ? '0' : '4,4'}
                  />
                );
              })}

              {/* Vote arrows from followers to N1 in election phase */}
              {currentPhase.showVoteArrows && nodes.slice(1).map((n, i) => (
                <Line key={`vote-${i}`}
                  x1={n.cx} y1={n.cy}
                  x2={nodes[0].cx} y2={nodes[0].cy}
                  stroke={C.orange} strokeWidth="2" opacity={0.7}
                  strokeDasharray="5,3"
                />
              ))}

              {/* Nodes */}
              {nodes.map(n => {
                const color = roleColor(n.role);
                return (
                  <G key={n.id}>
                    {/* Outer glow ring for leader */}
                    {n.role === 'leader' && (
                      <Circle cx={n.cx} cy={n.cy} r={NODE_R + 8}
                        fill="none" stroke={C.green} strokeWidth="1.5"
                        opacity={0.4} strokeDasharray="4,4"
                      />
                    )}
                    {/* Node circle */}
                    <Circle cx={n.cx} cy={n.cy} r={NODE_R}
                      fill={color + '22'} stroke={color} strokeWidth="2"
                    />
                    {/* Node ID */}
                    <SvgText x={n.cx} y={n.cy + 4}
                      textAnchor="middle" fontSize="11" fontWeight="700"
                      fill={color}>
                      {n.id}
                    </SvgText>
                    {/* Role icon */}
                    <SvgText x={n.cx} y={n.cy + NODE_R + 14}
                      textAnchor="middle" fontSize="10"
                      fill={color}>
                      {n.role === 'leader' ? '👑' : n.role === 'candidate' ? '✋' : ''}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </Animated.View>

          <Text style={styles.phaseDesc}>{currentPhase.description}</Text>

          {/* Phase stepper */}
          <View style={styles.phaseRow}>
            {PHASES.map((p, i) => (
              <TouchableOpacity key={i} style={[styles.phaseBtn, i === phase && styles.phaseBtnActive]}
                onPress={() => changePhase(i)}>
                <Text style={[styles.phaseBtnText, i === phase && styles.phaseBtnTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Question */}
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>QUESTION {qIndex + 1} OF {QUESTIONS.length}</Text>
          <Text style={styles.questionText}>{question.text}</Text>

          <View style={styles.options}>
            {question.options.map((opt, i) => {
              const isCorrect = i === question.correctIndex;
              const isChosen  = i === answered;
              const revealed  = answered !== null;

              let borderColor: string = C.border;
              let bgColor: string     = C.surface;
              let textColor: string   = C.text;

              if (revealed && isCorrect) { borderColor = C.green; bgColor = C.green + '18'; textColor = C.green; }
              else if (revealed && isChosen) { borderColor = C.red; bgColor = C.red + '18'; textColor = C.red; }

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.option, { borderColor, backgroundColor: bgColor }]}
                  onPress={() => handleAnswer(i)}
                  disabled={revealed}
                  activeOpacity={0.75}
                >
                  <View style={[styles.optionRadio, { borderColor }]}>
                    {isChosen && (
                      <View style={[styles.optionRadioFill, { backgroundColor: isCorrect ? C.green : C.red }]} />
                    )}
                    {revealed && !isChosen && isCorrect && (
                      <View style={[styles.optionRadioFill, { backgroundColor: C.green }]} />
                    )}
                  </View>
                  <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
                  {revealed && isCorrect && <Text style={styles.tick}>✓</Text>}
                  {revealed && isChosen && !isCorrect && <Text style={styles.cross}>✗</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explanation */}
          {answered !== null && (
            <View style={styles.explanation}>
              <Text style={styles.explanationLabel}>EXPLANATION</Text>
              <Text style={styles.explanationText}>{question.explanation}</Text>
              {answered === question.correctIndex && (
                <Text style={styles.xpEarned}>+30 XP earned</Text>
              )}
            </View>
          )}

          {answered !== null && (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>{isLast ? 'Finish' : 'Next question'} →</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.screenH, paddingVertical: S.lg,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  backIcon: { color: C.textMid, fontSize: 20 },
  headerMeta: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: C.text, fontFamily: FONT.sans },
  headerSub:   { fontSize: 11, color: C.textMid, fontFamily: FONT.mono },
  xpPill: {
    backgroundColor: C.accentDim, borderRadius: R.full,
    paddingHorizontal: S.md, paddingVertical: 4,
  },
  xpPillText: { fontSize: 12, fontWeight: '700', color: C.accent, fontFamily: FONT.sans },

  scroll: { paddingHorizontal: S.screenH, paddingTop: S.lg },

  progressDots: {
    flexDirection: 'row', gap: S.sm, justifyContent: 'center', marginBottom: S.xl,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.border,
  },
  dotActive: { width: 24, backgroundColor: C.accent },
  dotDone:   { backgroundColor: C.green },

  // Viz card
  vizCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.lg, marginBottom: S.xl,
  },
  vizHeader: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green,
  },
  vizTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text, fontFamily: FONT.sans },
  phaseLabel: { fontSize: 11, color: C.accent, fontFamily: FONT.mono, fontWeight: '700' },
  svg: {
    alignSelf: 'center', backgroundColor: C.bg, borderRadius: R.lg, marginBottom: S.md,
  },
  phaseDesc: {
    fontSize: 14, color: C.textMid, fontFamily: FONT.sans, lineHeight: 20,
    marginBottom: S.md, textAlign: 'center',
  },
  phaseRow: { flexDirection: 'row', gap: S.sm, justifyContent: 'center' },
  phaseBtn: {
    borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.lg, paddingVertical: S.sm,
  },
  phaseBtnActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  phaseBtnText: { fontSize: 11, color: C.textMid, fontFamily: FONT.sans },
  phaseBtnTextActive: { color: C.accent, fontWeight: '700' },

  // Question
  questionCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl,
  },
  questionLabel: {
    fontSize: 10, fontFamily: FONT.mono, color: C.accent,
    letterSpacing: 1.5, marginBottom: S.md,
  },
  questionText: {
    fontSize: 17, fontWeight: '600', color: C.text, fontFamily: FONT.sans,
    lineHeight: 23, marginBottom: S.xl,
  },
  options: { gap: S.sm, marginBottom: S.lg },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    borderRadius: R.lg, borderWidth: 1.5, padding: S.lg,
  },
  optionRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioFill: { width: 10, height: 10, borderRadius: 5 },
  optionText: { flex: 1, fontSize: 15, fontFamily: FONT.sans, lineHeight: 22 },
  tick:  { color: C.green, fontSize: 16, fontWeight: '700' },
  cross: { color: C.red,   fontSize: 16, fontWeight: '700' },

  explanation: {
    backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1,
    borderColor: C.border, padding: S.lg, gap: S.sm, marginBottom: S.lg,
  },
  explanationLabel: {
    fontSize: 9, fontFamily: FONT.mono, color: C.textDim, letterSpacing: 1.5,
  },
  explanationText: { fontSize: 15, color: C.text, fontFamily: FONT.sans, lineHeight: 23 },
  xpEarned: { fontSize: 13, fontWeight: '700', color: C.green, fontFamily: FONT.sans },

  nextBtn: {
    backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 14,
    alignItems: 'center', ...SHADOW.accent(C.accent),
  },
  nextBtnText: { fontSize: 15, fontWeight: '700', color: C.bg, fontFamily: FONT.sans },

  // Done screen
  doneEmoji: { fontSize: 64, textAlign: 'center', marginBottom: S.xl },
  doneTitle: {
    fontSize: 26, fontWeight: '800', color: C.text, fontFamily: FONT.sans,
    textAlign: 'center', marginBottom: S.sm,
  },
  doneSub: {
    fontSize: 14, color: C.textMid, fontFamily: FONT.sans,
    textAlign: 'center', marginBottom: S.xl,
  },
  comingSoonBadge: {
    borderWidth: 1, borderColor: C.border, borderRadius: R.lg,
    backgroundColor: C.surface, paddingVertical: 14, paddingHorizontal: 24,
    marginHorizontal: 32, marginBottom: S.xxxl,
  },
  comingSoonText: {
    fontSize: 14, color: C.textMid, fontFamily: FONT.sans,
    textAlign: 'center', lineHeight: 21, fontStyle: 'italic',
  },
  doneBtn: {
    backgroundColor: C.accent, borderRadius: R.lg,
    paddingVertical: 16, paddingHorizontal: 48,
    ...SHADOW.accent(C.accent),
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: C.bg, fontFamily: FONT.sans },
});
