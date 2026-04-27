/**
 * DistroLearn — Home Screen
 *
 * Sections:
 *   1. Greeting + streak widget
 *   2. Daily missions with live progress
 *   3. SM-2 review queue (due cards)
 *   4. Quick launch grid (Cards / Puzzles / Viz)
 *   5. Topic mastery mini-bars
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S, R, FONT, SHADOW, TOPIC_META, xpToLevel, xpProgress, xpToNextLevel } from '../theme';
import { getProgress, getDueCards, getSM2Metrics, getCardsByTopic, resetAllCardsDueToday } from '../db/database';
import { pullUserSM2State } from '../services/sync';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeProps {
  userId: string;
  username: string;
  onStartFlashCards: (topic?: string) => void;
  onStartPuzzles: () => void;
  onStartVizQuiz: () => void;
  onOpenStats: () => void;
}

interface HomeData {
  totalXp: number;
  level: number;
  streak: number;
  dueCount: number;
  avgEasiness: number;
  retentionRate: number;
  topicDue: Record<string, number>;
  recentTopics: string[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen({
  userId, username, onStartFlashCards, onStartPuzzles, onStartVizQuiz, onOpenStats,
}: HomeProps) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HomeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [progress, dueCards, metrics] = await Promise.all([
        getProgress(userId),
        getDueCards(userId),
        getSM2Metrics(userId),
      ]);

      // Group due cards by topic
      const topicDue: Record<string, number> = {};
      dueCards.forEach(c => {
        // cardId prefix encodes topic: "rep-001" → "replication"
        // In practice this join comes from getDueCardsWithContent
        // For now we just count total
      });

      setData({
        totalXp: progress.totalXp,
        level: progress.level,
        streak: progress.currentStreak,
        dueCount: metrics.dueCount,
        avgEasiness: metrics.avgEasiness,
        retentionRate: metrics.retentionRate,
        topicDue,
        recentTopics: Object.keys(TOPIC_META).slice(0, 4),
      });
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => load(true);

  const onResetCards = () => {
    Alert.alert(
      'Reset all cards',
      'Set every card as due today? Your SM-2 scores are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            const count = await resetAllCardsDueToday(userId);
            await load();
            Alert.alert('Done', `${count} cards are now due today.`);
          },
        },
      ],
    );
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (!data) return (
    <View style={[styles.container, styles.centered]}>
      <ActivityIndicator color={C.accent} />
    </View>
  );

  const level = xpToLevel(data.totalXp);
  const lvlProgress = xpProgress(data.totalXp);
  const toNext = xpToNextLevel(data.totalXp);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={C.accent} colors={[C.accent]} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>{greeting()}</Text>
            <Text style={styles.greetingName}>{username} 👋</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} onPress={onOpenStats}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{username[0]?.toUpperCase() ?? 'U'}</Text>
            </View>
            <View style={styles.levelPip}>
              <Text style={styles.levelPipText}>{level}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Streak + XP card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.streakFire}>🔥</Text>
            <View>
              <Text style={styles.streakNum}>{data.streak}-day streak</Text>
              <Text style={styles.streakSub}>
                {data.dueCount > 0 ? `${data.dueCount} cards due today` : 'All caught up!'}
              </Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.xpNum}>{data.totalXp.toLocaleString()}</Text>
            <Text style={styles.xpLabel}>XP · Lv {level}</Text>
          </View>
        </View>

        {/* XP progress bar */}
        <View style={styles.xpBarTrack}>
          <View style={[styles.xpBarFill, { width: `${lvlProgress * 100}%` }]} />
        </View>
        <Text style={styles.xpToNext}>{toNext} XP to level {level + 1}</Text>

        {/* ── Daily missions ── */}
        <SectionHeader title="TODAY'S MISSIONS" />
        <View style={styles.missionsCol}>
          <MissionRow
            icon="◈" color={C.accent}
            label="Review due cards"
            progress={0} total={data.dueCount || 8}
            onPress={() => onStartFlashCards()}
          />
          <MissionRow
            icon="⊞" color={C.orange}
            label="Complete a puzzle"
            progress={0} total={2}
            onPress={onStartPuzzles}
          />
          <MissionRow
            icon="⬡" color={C.green}
            label="Watch a visualization"
            progress={0} total={1}
            onPress={onStartVizQuiz}
          />
        </View>

        {/* ── Quick launch ── */}
        <SectionHeader title="START STUDYING" />
        <View style={styles.quickRow}>
          <QuickLaunch
            icon="◈" label="Flash Cards" sublabel={`${data.dueCount} due`}
            color={C.accent} onPress={() => onStartFlashCards()}
          />
          <QuickLaunch
            icon="⊞" label="Puzzles" sublabel="3 types"
            color={C.orange} onPress={onStartPuzzles}
          />
          <QuickLaunch
            icon="⬡" label="Viz Quiz" sublabel="Raft election"
            color={C.green} onPress={onStartVizQuiz}
          />
        </View>

        {/* ── SM-2 health ── */}
        <SectionHeader title="SM-2 HEALTH" />
        <View style={styles.metricsRow}>
          <MetricCard label="Due" value={String(data.dueCount)} color={C.orange} icon="◈" />
          <MetricCard label="Avg EF" value={data.avgEasiness.toFixed(1)} color={C.accent} icon="⚙" />
          <MetricCard label="Retention" value={`${data.retentionRate}%`} color={C.green} icon="◉" />
        </View>

        {/* ── Topics ── */}
        <SectionHeader title="TOPICS" />
        <View style={styles.topicGrid}>
          {Object.entries(TOPIC_META).map(([id, meta]) => (
            <TouchableOpacity
              key={id}
              style={styles.topicCard}
              onPress={() => onStartFlashCards(id)}
              activeOpacity={0.75}
            >
              <View style={[styles.topicIconBox, { backgroundColor: meta.color + '18', borderColor: meta.color + '33' }]}>
                <Text style={styles.topicIconText}>{meta.icon}</Text>
              </View>
              <Text style={styles.topicCardLabel} numberOfLines={2}>{meta.label}</Text>
              <View style={styles.topicBarTrack}>
                <View style={[styles.topicBarFill, { width: '45%', backgroundColor: meta.color }]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Dev tools (debug builds only) ── */}
        {__DEV__ && (
          <>
            <SectionHeader title="DEV TOOLS" />
            <TouchableOpacity style={devStyles.btn} onPress={onResetCards} activeOpacity={0.75}>
              <Text style={devStyles.btnText}>Reset all cards to due today</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={sh.title}>{title}</Text>;
}
const sh = StyleSheet.create({
  title: {
    fontSize: 10, fontFamily: FONT.mono, color: C.textDim,
    letterSpacing: 1.5, marginTop: S.xl, marginBottom: S.md,
  },
});

function MissionRow({ icon, color, label, progress, total, onPress }: {
  icon: string; color: string; label: string; progress: number; total: number; onPress: () => void;
}) {
  const pct = total > 0 ? Math.min(1, progress / total) : 0;
  const done = progress >= total;
  return (
    <TouchableOpacity style={mission.row} onPress={onPress} activeOpacity={0.8}>
      <View style={[mission.iconBox, { backgroundColor: color + '18', borderColor: color + '33' }]}>
        <Text style={[mission.icon, { color }]}>{icon}</Text>
      </View>
      <View style={mission.content}>
        <View style={mission.top}>
          <Text style={[mission.label, done && { color: C.green }]}>{label}</Text>
          <Text style={[mission.count, { color }]}>{progress}/{total}</Text>
        </View>
        <View style={mission.track}>
          <View style={[mission.fill, { width: `${pct * 100}%`, backgroundColor: done ? C.green : color }]} />
        </View>
      </View>
      {done && <Text style={mission.check}>✓</Text>}
    </TouchableOpacity>
  );
}
const mission = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1,
    borderColor: C.border, padding: S.lg, marginBottom: S.sm,
  },
  iconBox: { width: 38, height: 38, borderRadius: R.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 16 },
  content: { flex: 1, gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: '600', color: C.text, fontFamily: FONT.sans },
  count: { fontSize: 12, fontWeight: '700', fontFamily: FONT.sans },
  track: { height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  check: { color: C.green, fontSize: 18 },
});

function QuickLaunch({ icon, label, sublabel, color, onPress }: {
  icon: string; label: string; sublabel: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ql.card, { borderColor: color + '33' }]}
      onPress={onPress} activeOpacity={0.75}
    >
      <View style={[ql.iconBox, { backgroundColor: color + '18' }]}>
        <Text style={[ql.icon, { color }]}>{icon}</Text>
      </View>
      <Text style={ql.label}>{label}</Text>
      <Text style={[ql.sub, { color }]}>{sublabel}</Text>
    </TouchableOpacity>
  );
}
const ql = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1,
    padding: S.md, alignItems: 'center', gap: S.sm,
  },
  iconBox: { width: 44, height: 44, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  label: { fontSize: 12, fontWeight: '700', color: C.text, fontFamily: FONT.sans },
  sub: { fontSize: 10, fontFamily: FONT.sans },
});

function MetricCard({ label, value, color, icon }: {
  label: string; value: string; color: string; icon: string;
}) {
  return (
    <View style={[mc.card, { borderColor: color + '33' }]}>
      <Text style={[mc.icon, { color }]}>{icon}</Text>
      <Text style={[mc.value, { color }]}>{value}</Text>
      <Text style={mc.label}>{label}</Text>
    </View>
  );
}
const mc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: C.card, borderRadius: R.lg,
    borderWidth: 1, padding: S.lg, alignItems: 'center', gap: S.sm,
  },
  icon: { fontSize: 18 },
  value: { fontSize: 22, fontWeight: '900', fontFamily: FONT.sans },
  label: { fontSize: 11, color: C.textMid, fontFamily: FONT.mono, letterSpacing: 0.5 },
});

const devStyles = StyleSheet.create({
  btn: {
    backgroundColor: '#1A0A0A', borderRadius: R.lg, borderWidth: 1,
    borderColor: '#FF6B6B44', padding: S.lg, alignItems: 'center',
  },
  btnText: { color: '#FF6B6B', fontSize: 13, fontWeight: '600', fontFamily: FONT.sans },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: S.screenH, paddingTop: S.lg },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.xl },
  greetingSub: { fontSize: 12, color: C.textMid, fontFamily: FONT.sans },
  greetingName: { fontSize: 22, fontWeight: '800', color: C.text, fontFamily: FONT.sans, letterSpacing: -0.3 },
  avatarBtn: { position: 'relative' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.accentDim, borderWidth: 2, borderColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: C.accent, fontFamily: FONT.sans },
  levelPip: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: C.accent, borderRadius: R.full,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1.5, borderColor: C.bg,
  },
  levelPipText: { fontSize: 9, fontWeight: '800', color: C.bg, fontFamily: FONT.mono },

  // Hero
  heroCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: S.sm,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  streakFire: { fontSize: 32 },
  streakNum: { fontSize: 17, fontWeight: '800', color: C.text, fontFamily: FONT.sans },
  streakSub: { fontSize: 12, color: C.textMid, fontFamily: FONT.sans, marginTop: 2 },
  heroRight: { alignItems: 'flex-end' },
  xpNum: { fontSize: 22, fontWeight: '900', color: C.accent, fontFamily: FONT.sans },
  xpLabel: { fontSize: 11, color: C.textMid, fontFamily: FONT.mono },

  // XP bar
  xpBarTrack: { height: 4, backgroundColor: C.surface, borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: C.accent, borderRadius: 2 },
  xpToNext: { fontSize: 11, color: C.textDim, fontFamily: FONT.mono, letterSpacing: 0.5, marginBottom: S.sm },

  // Quick row
  quickRow: { flexDirection: 'row', gap: S.sm },

  // Metrics
  metricsRow: { flexDirection: 'row', gap: S.sm },

  // Topic grid
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  topicCard: {
    width: '30.5%', backgroundColor: C.card, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, padding: S.md, gap: S.sm,
  },
  topicIconBox: { width: 36, height: 36, borderRadius: R.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topicIconText: { fontSize: 16 },
  topicCardLabel: { fontSize: 11, fontWeight: '600', color: C.text, fontFamily: FONT.sans, lineHeight: 15 },
  topicBarTrack: { height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  topicBarFill: { height: '100%', borderRadius: 2, opacity: 0.8 },

  missionsCol: { gap: 0 },
});
