/**
 * DistroLearn — Stats Screen
 *
 * Sections:
 *   1. XP + level with progress bar
 *   2. Weekly activity bar chart
 *   3. Per-topic mastery bars
 *   4. SM-2 health (EF, retention, card counts)
 *   5. Badges / achievements
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S, R, FONT, SHADOW, TOPIC_META, xpToLevel, xpProgress, xpToNextLevel } from '../theme';
import { getProgress, getSM2Metrics } from '../db/database';
import { signOut } from '../services/auth';
import { isAudioEnabled, setAudioEnabled } from '../services/audio';
import { isReminderScheduled, scheduleDailyReminder, cancelDailyReminder } from '../services/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  totalXp: number;
  level: number;
  streak: number;
  longestStreak: number;
  dueCount: number;
  avgEasiness: number;
  retentionRate: number;
}

interface Props {
  userId: string;
  username: string;
  email: string;
  onSignOut: () => void;
}

// ─── Badges config ────────────────────────────────────────────────────────────

const BADGES = [
  { id: 'first_review',    icon: '⚡', label: 'First Review',     desc: 'Complete your first session',    xpReq: 1 },
  { id: 'streak_7',        icon: '🔥', label: 'Streak Warrior',   desc: '7-day streak',                   streakReq: 7 },
  { id: 'streak_30',       icon: '🌟', label: 'Month Master',     desc: '30-day streak',                  streakReq: 30 },
  { id: 'level_5',         icon: '🎯', label: 'Level 5',          desc: 'Reach level 5',                  levelReq: 5 },
  { id: 'level_10',        icon: '🏆', label: 'Level 10',         desc: 'Reach level 10',                 levelReq: 10 },
  { id: 'retention_80',    icon: '🧠', label: 'Sharp Mind',       desc: '80%+ retention rate',            retentionReq: 80 },
  { id: 'puzzle_10',       icon: '⊞', label: 'Puzzle Solver',    desc: 'Complete 10 puzzles',             xpReq: 500 },
  { id: 'consensus_master',icon: '◈', label: 'Consensus Expert', desc: 'Master all consensus cards',     xpReq: 1000 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function StatsScreen({ userId, username, email, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<StatsData | null>(null);
  const [audioOn, setAudioOn]         = useState(true);
  const [remindersOn, setRemindersOn] = useState(false);

  useEffect(() => {
    isAudioEnabled().then(setAudioOn);
    isReminderScheduled().then(setRemindersOn);
  }, []);

  async function handleAudioToggle(val: boolean) {
    setAudioOn(val);
    await setAudioEnabled(val);
  }

  async function handleRemindersToggle(val: boolean) {
    setRemindersOn(val);
    if (val) await scheduleDailyReminder();
    else     await cancelDailyReminder();
  }

  useEffect(() => {
    async function load() {
      const [progress, metrics] = await Promise.all([
        getProgress(userId),
        getSM2Metrics(userId),
      ]);
      setData({
        totalXp: progress.totalXp,
        level: progress.level,
        streak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        dueCount: metrics.dueCount,
        avgEasiness: metrics.avgEasiness,
        retentionRate: metrics.retentionRate,
      });
    }
    load();
  }, [userId]);

  async function handleSignOut() {
    await signOut();
    onSignOut();
  }

  if (!data) return (
    <View style={[s.container, s.centered, { paddingTop: insets.top }]}>
      <ActivityIndicator color={C.accent} />
    </View>
  );

  const level = xpToLevel(data.totalXp);
  const lvlPct = xpProgress(data.totalXp);
  const toNext = xpToNextLevel(data.totalXp);

  // Simulated weekly data (replace with real DB query)
  const weeklyXp = [18, 45, 12, 38, 52, 24, data.totalXp % 60 || 30];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxWkXp = Math.max(...weeklyXp);

  // Topic mastery — simulated with realistic variance
  const topicMastery = Object.entries(TOPIC_META).map(([id, meta], i) => ({
    id, ...meta,
    score: [72, 58, 81, 45, 90, 33, 67, 55, 78][i % 9],
  }));

  // Badge unlocked logic
  const unlockedBadge = (b: typeof BADGES[0]) => {
    if (b.xpReq && data.totalXp < b.xpReq) return false;
    if (b.levelReq && level < b.levelReq) return false;
    if (b.streakReq && data.streak < b.streakReq) return false;
    if (b.retentionReq && data.retentionRate < b.retentionReq) return false;
    return true;
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Progress</Text>
        <TouchableOpacity style={s.settingsBtn} onPress={handleSignOut}>
          <Text style={s.settingsIcon}>⎋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Profile + XP card ── */}
        <View style={s.profileCard}>
          <View style={s.profileTop}>
            <View style={s.avatarLg}>
              <Text style={s.avatarText}>{username[0]?.toUpperCase() ?? 'U'}</Text>
            </View>
            <View style={s.profileText}>
              <Text style={s.profileName}>{username}</Text>
              <Text style={s.profileEmail}>{email}</Text>
            </View>
            <View style={s.levelBadge}>
              <Text style={s.levelBadgeNum}>Lv</Text>
              <Text style={s.levelBadgeLvl}>{level}</Text>
            </View>
          </View>
          <View style={s.xpRow}>
            <Text style={s.xpTotal}>{data.totalXp.toLocaleString()} XP</Text>
            <Text style={s.xpNext}>{toNext} to next level</Text>
          </View>
          <View style={s.xpTrack}>
            <View style={[s.xpFill, { width: `${lvlPct * 100}%` }]} />
          </View>
        </View>

        {/* ── Streak cards ── */}
        <View style={s.twoCol}>
          <StatCard icon="🔥" label="Current streak" value={`${data.streak} days`} color={C.orange} />
          <StatCard icon="🏅" label="Longest streak" value={`${data.longestStreak} days`} color={C.yellow} />
        </View>

        {/* ── Weekly XP bar chart ── */}
        <SectionLabel text="THIS WEEK" />
        <View style={s.chartCard}>
          <View style={s.chartBars}>
            {weeklyXp.map((v, i) => (
              <View key={i} style={s.barWrap}>
                <View style={s.barTrack}>
                  <View style={[
                    s.barFill,
                    { height: `${Math.max(4, (v / maxWkXp) * 100)}%` },
                    i === 6 && { backgroundColor: C.accent },
                  ]} />
                </View>
                <Text style={[s.barDay, i === 6 && { color: C.accent }]}>{days[i]}</Text>
                <Text style={s.barVal}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Topic mastery ── */}
        <SectionLabel text="TOPIC MASTERY" />
        <View style={s.masteryCard}>
          {topicMastery.map(t => (
            <View key={t.id} style={s.masteryRow}>
              <Text style={[s.masteryIcon, { color: t.color }]}>{t.icon}</Text>
              <View style={s.masteryContent}>
                <View style={s.masteryTop}>
                  <Text style={s.masteryLabel}>{t.label}</Text>
                  <Text style={[s.masteryScore, { color: t.score >= 75 ? C.green : t.score >= 50 ? C.yellow : C.red }]}>
                    {t.score}%
                  </Text>
                </View>
                <View style={s.masteryTrack}>
                  <View style={[
                    s.masteryFill,
                    { width: `${t.score}%`, backgroundColor: t.color },
                  ]} />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── SM-2 health ── */}
        <SectionLabel text="SM-2 HEALTH" />
        <View style={s.sm2Card}>
          <View style={s.sm2Grid}>
            <SM2Stat label="Cards Due" value={String(data.dueCount)} color={data.dueCount > 10 ? C.orange : C.green} />
            <SM2Stat label="Avg Easiness" value={data.avgEasiness.toFixed(2)} color={C.accent} />
            <SM2Stat label="30d Retention" value={`${data.retentionRate}%`} color={data.retentionRate >= 80 ? C.green : C.yellow} />
          </View>
          <View style={s.sm2Legend}>
            <SM2Legend color={C.green}  label="EF > 2.5 = learning well" />
            <SM2Legend color={C.yellow} label="EF 1.8–2.5 = needs work" />
            <SM2Legend color={C.red}    label="EF < 1.8 = struggling" />
          </View>
        </View>

        {/* ── Badges ── */}
        <SectionLabel text="ACHIEVEMENTS" />
        <View style={s.badgeGrid}>
          {BADGES.map(b => {
            const unlocked = unlockedBadge(b);
            return (
              <View key={b.id} style={[s.badge, !unlocked && s.badgeLocked]}>
                <Text style={[s.badgeIcon, !unlocked && s.badgeIconLocked]}>{b.icon}</Text>
                <Text style={[s.badgeLabel, !unlocked && { color: C.textDim }]}>{b.label}</Text>
                <Text style={s.badgeDesc} numberOfLines={2}>{b.desc}</Text>
                {!unlocked && <View style={s.badgeLock}><Text style={s.badgeLockIcon}>🔒</Text></View>}
              </View>
            );
          })}
        </View>

        {/* Settings */}
        <SectionLabel text="SETTINGS" />
        <View style={s.settingsCard}>
          <View style={s.settingRow}>
            <Text style={s.settingIcon}>🔊</Text>
            <View style={s.settingText}>
              <Text style={s.settingLabel}>Sound effects</Text>
              <Text style={s.settingDesc}>Play audio on card actions</Text>
            </View>
            <Switch
              value={audioOn}
              onValueChange={handleAudioToggle}
              trackColor={{ false: C.border, true: C.accentDim }}
              thumbColor={audioOn ? C.accent : C.textMid}
            />
          </View>
          <View style={[s.settingRow, { borderTopWidth: 1, borderTopColor: C.border }]}>
            <Text style={s.settingIcon}>🔔</Text>
            <View style={s.settingText}>
              <Text style={s.settingLabel}>Daily reminder</Text>
              <Text style={s.settingDesc}>Notify me at 9am to practice</Text>
            </View>
            <Switch
              value={remindersOn}
              onValueChange={handleRemindersToggle}
              trackColor={{ false: C.border, true: C.accentDim }}
              thumbColor={remindersOn ? C.accent : C.textMid}
            />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={sl.text}>{text}</Text>;
}
const sl = StyleSheet.create({
  text: {
    fontSize: 10, fontFamily: FONT.mono, color: C.textDim,
    letterSpacing: 1.5, marginTop: S.xl, marginBottom: S.md,
  },
});

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: string;
}) {
  return (
    <View style={[sc.card, { borderColor: color + '33' }]}>
      <Text style={sc.icon}>{icon}</Text>
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1,
    padding: S.lg, alignItems: 'center', gap: S.sm,
  },
  icon: { fontSize: 24 },
  value: { fontSize: 20, fontWeight: '900', fontFamily: FONT.sans },
  label: { fontSize: 11, color: C.textMid, fontFamily: FONT.sans, textAlign: 'center' },
});

function SM2Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={sm2.statBox}>
      <Text style={[sm2.val, { color }]}>{value}</Text>
      <Text style={sm2.lbl}>{label}</Text>
    </View>
  );
}

function SM2Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={sm2.legendRow}>
      <View style={[sm2.legendDot, { backgroundColor: color }]} />
      <Text style={sm2.legendText}>{label}</Text>
    </View>
  );
}

const sm2 = StyleSheet.create({
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  val: { fontSize: 24, fontWeight: '900', fontFamily: FONT.sans },
  lbl: { fontSize: 10, color: C.textMid, fontFamily: FONT.mono, letterSpacing: 0.5, textAlign: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: C.textMid, fontFamily: FONT.sans },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: S.screenH, paddingVertical: S.lg,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text, fontFamily: FONT.sans },
  settingsBtn: { padding: 6 },
  settingsIcon: { fontSize: 20, color: C.textMid },
  scroll: { paddingHorizontal: S.screenH, paddingTop: S.lg },

  // Profile card
  profileCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl, gap: S.md,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  avatarLg: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accentDim, borderWidth: 2, borderColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: C.accent, fontFamily: FONT.sans },
  profileText: { flex: 1, gap: 3 },
  profileName: { fontSize: 16, fontWeight: '700', color: C.text, fontFamily: FONT.sans },
  profileEmail: { fontSize: 12, color: C.textMid, fontFamily: FONT.sans },
  levelBadge: {
    backgroundColor: C.accentDim, borderRadius: R.md, borderWidth: 1, borderColor: C.accent,
    paddingHorizontal: S.md, paddingVertical: S.sm, alignItems: 'center',
  },
  levelBadgeNum: { fontSize: 9, color: C.accent, fontFamily: FONT.mono, letterSpacing: 1 },
  levelBadgeLvl: { fontSize: 20, fontWeight: '900', color: C.accent, fontFamily: FONT.sans },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  xpTotal: { fontSize: 22, fontWeight: '900', color: C.text, fontFamily: FONT.sans },
  xpNext: { fontSize: 12, color: C.textMid, fontFamily: FONT.mono },
  xpTrack: { height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: C.accent, borderRadius: 3 },

  // Two-col
  twoCol: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },

  // Chart
  chartCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl,
  },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 8 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: {
    flex: 1, width: '100%', backgroundColor: C.surface,
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  barFill: { width: '100%', backgroundColor: C.border, borderRadius: 4, minHeight: 4 },
  barDay: { fontSize: 10, color: C.textMid, fontFamily: FONT.mono },
  barVal: { fontSize: 9, color: C.textDim, fontFamily: FONT.mono },

  // Mastery
  masteryCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl, gap: S.lg,
  },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  masteryIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  masteryContent: { flex: 1, gap: 6 },
  masteryTop: { flexDirection: 'row', justifyContent: 'space-between' },
  masteryLabel: { fontSize: 13, color: C.text, fontFamily: FONT.sans },
  masteryScore: { fontSize: 13, fontWeight: '700', fontFamily: FONT.sans },
  masteryTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  masteryFill: { height: '100%', borderRadius: 2, opacity: 0.85 },

  // SM2
  sm2Card: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl, gap: S.xl,
  },
  sm2Grid: { flexDirection: 'row', justifyContent: 'space-around' },
  sm2Legend: { gap: S.sm, borderTopWidth: 1, borderTopColor: C.border, paddingTop: S.lg },

  // Badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  badge: {
    width: '47%', backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1,
    borderColor: C.border, padding: S.lg, gap: S.sm, alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  badgeLocked: { opacity: 0.45 },
  badgeIcon: { fontSize: 28 },
  badgeIconLocked: { opacity: 0.5 },
  badgeLabel: { fontSize: 12, fontWeight: '700', color: C.text, fontFamily: FONT.sans, textAlign: 'center' },
  badgeDesc: { fontSize: 10, color: C.textMid, fontFamily: FONT.sans, textAlign: 'center', lineHeight: 14 },
  badgeLock: { position: 'absolute', top: 6, right: 6 },
  badgeLockIcon: { fontSize: 10 },

  settingsCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.xl, paddingVertical: S.lg,
  },
  settingIcon: { fontSize: 20 },
  settingText: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: C.text, fontFamily: FONT.sans },
  settingDesc: { fontSize: 11, color: C.textMid, fontFamily: FONT.sans },

  signOutBtn: {
    marginTop: S.xl, borderWidth: 1, borderColor: C.border,
    borderRadius: R.lg, paddingVertical: 14, alignItems: 'center',
  },
  signOutText: { fontSize: 14, color: C.textMid, fontFamily: FONT.sans },
});
