/**
 * DistroLearn — Level-Up Celebration Modal
 *
 * Shown as a full-screen overlay when the user crosses a level threshold.
 * Uses Animated for the burst / scale-in effect; no external dependencies.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Modal, Dimensions,
} from 'react-native';
import { C, FONT, R, S, SHADOW } from '../theme';

const { width: W } = Dimensions.get('window');

// ── Level flavour text ─────────────────────────────────────────────────────────

const LEVEL_TITLES: Record<number, string> = {
  2:  'Apprentice',  3:  'Learner',      4:  'Practitioner',
  5:  'Engineer',    6:  'Senior',        7:  'Principal',
  8:  'Architect',   9:  'Distinguished', 10: 'Fellow',
};
function levelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? `Level ${level}`;
}

const LEVEL_MESSAGES: Record<number, string> = {
  2:  'The journey begins. Keep reviewing every day.',
  3:  'Consistency is compounding. SM-2 is working.',
  4:  'Your recall is getting sharper.',
  5:  'Engineer-level intuition forming.',
  6:  "You're thinking in distributed systems now.",
  7:  'Principal-level depth. Rare territory.',
  8:  'You design for failure modes most miss.',
  9:  'Distinguished — your mental models are solid.',
  10: 'Fellow. You understand the fundamentals deeply.',
};
function levelMessage(level: number): string {
  return LEVEL_MESSAGES[level] ?? `You reached level ${level}. Outstanding work.`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  newLevel: number;
  xpTotal: number;
  onDismiss: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LevelUpModal({ visible, newLevel, xpTotal, onDismiss }: Props) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    scale.setValue(0.6);
    opacity.setValue(0);
    glow.setValue(0);

    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        ]),
      ),
    ]).start();
  }, [visible]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>

          {/* Pulsing glow ring */}
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />

          {/* Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeLevel}>{newLevel}</Text>
          </View>

          <Text style={styles.levelUpLabel}>LEVEL UP</Text>
          <Text style={styles.title}>{levelTitle(newLevel)}</Text>
          <Text style={styles.message}>{levelMessage(newLevel)}</Text>

          {/* XP chip */}
          <View style={styles.xpRow}>
            <View style={styles.xpChip}>
              <Text style={styles.xpChipText}>{xpTotal.toLocaleString()} XP total</Text>
            </View>
          </View>

          {/* Particle dots (static decorative) */}
          <View style={styles.particles} pointerEvents="none">
            {PARTICLE_POSITIONS.map((p, i) => (
              <View key={i} style={[styles.particle, { left: p.x, top: p.y, backgroundColor: p.color }]} />
            ))}
          </View>

          <TouchableOpacity style={styles.continueBtn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>Keep going ⚡</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Static particle data ───────────────────────────────────────────────────────

const PARTICLE_POSITIONS = [
  { x: 24,  y: 20,  color: C.accent  },
  { x: 260, y: 15,  color: C.green   },
  { x: 10,  y: 200, color: C.yellow  },
  { x: 270, y: 210, color: C.purple  },
  { x: 130, y: 8,   color: C.orange  },
  { x: 50,  y: 280, color: C.accent  },
  { x: 240, y: 270, color: C.green   },
];

// ── Styles ─────────────────────────────────────────────────────────────────────

const CARD_W = Math.min(W - 48, 340);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(8,10,20,0.88)',
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: CARD_W,
    backgroundColor: C.card,
    borderRadius: R.xxl,
    borderWidth: 1.5,
    borderColor: C.accent + '55',
    padding: S.xxxl,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOW.glow(C.accent),
  },

  // Glow ring behind badge
  glowRing: {
    position: 'absolute',
    top: 28,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: C.accent,
    opacity: 0.15,
  },

  // Level badge
  badge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.xl,
    ...SHADOW.glow(C.accent),
  },
  badgeLevel: {
    fontSize: 32, fontWeight: '900', color: C.bg, fontFamily: FONT.sans,
  },

  levelUpLabel: {
    fontSize: 11, fontWeight: '800', color: C.accent,
    fontFamily: FONT.mono, letterSpacing: 3, marginBottom: S.sm,
  },
  title: {
    fontSize: 26, fontWeight: '900', color: C.text,
    fontFamily: FONT.sans, letterSpacing: -0.5, marginBottom: S.md,
    textAlign: 'center',
  },
  message: {
    fontSize: 14, color: C.textMid, fontFamily: FONT.sans,
    lineHeight: 22, textAlign: 'center', marginBottom: S.xl,
  },

  xpRow: { marginBottom: S.xl },
  xpChip: {
    backgroundColor: C.accentDim, borderRadius: R.full,
    paddingHorizontal: S.lg, paddingVertical: S.sm,
    borderWidth: 1, borderColor: C.accent + '44',
  },
  xpChipText: {
    fontSize: 13, fontWeight: '700', color: C.accent, fontFamily: FONT.mono,
  },

  // Decorative particles
  particles: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  particle: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3, opacity: 0.6,
  },

  continueBtn: {
    width: '100%', backgroundColor: C.accent, borderRadius: R.lg,
    paddingVertical: 16, alignItems: 'center',
    ...SHADOW.accent(C.accent),
  },
  continueBtnText: {
    fontSize: 16, fontWeight: '800', color: C.bg, fontFamily: FONT.sans,
  },
});
