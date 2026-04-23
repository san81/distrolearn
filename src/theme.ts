/**
 * DistroLearn — Design Tokens
 * Single source of truth for colors, typography, spacing, and shadows.
 * Imported by every screen component.
 */
import { Platform, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

export const SCREEN = { W, H };

// ─── Colors ───────────────────────────────────────────────────────────────────
export const C = {
  // Backgrounds — stepped clearly so cards/surfaces read as layers
  bg:         '#070912',
  surface:    '#0C1020',
  card:       '#101525',
  cardHover:  '#162038',
  border:     '#222B4A',   // lifted so card edges are visible
  borderSoft: '#181F38',

  // Accent palette — slightly more saturated for less dullness
  accent:     '#6B9FFF',   // brighter blue
  accentGlow: 'rgba(107,159,255,0.18)',
  accentDim:  '#0E1B3A',
  green:      '#1EE8C0',   // more vivid teal
  greenGlow:  'rgba(30,232,192,0.15)',
  orange:     '#FB923C',
  orangeGlow: 'rgba(251,146,60,0.15)',
  yellow:     '#FCD34D',   // slightly brighter
  red:        '#FF6B6B',
  redGlow:    'rgba(255,107,107,0.15)',
  purple:     '#B79FFB',   // slightly lighter purple
  purpleGlow: 'rgba(183,159,251,0.15)',

  // Text — stronger primary contrast
  text:       '#EEF1FF',
  textMid:    '#8B95BE',
  textDim:    '#454E72',
  textXDim:   '#2A3055',

  // Ratings
  ratingAgain: '#FF6B6B',
  ratingHard:  '#FB923C',
  ratingGood:  '#6B9FFF',
  ratingEasy:  '#1EE8C0',

  // Levels
  L1: '#1EE8C0',
  L2: '#6B9FFF',
  L3: '#FCD34D',
  L4: '#FB923C',
  L5: '#FF6B6B',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const FONT = {
  sans:   Platform.OS === 'ios' ? 'System'    : 'sans-serif',
  mono:   Platform.OS === 'ios' ? 'Menlo'     : 'monospace',
  sansBold: Platform.OS === 'ios' ? 'System' : 'sans-serif',
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  screenH: 20,  // horizontal screen padding
  safeTop: Platform.OS === 'ios' ? 54 : 24,
  safeBot: Platform.OS === 'ios' ? 34 : 16,
} as const;

// ─── Radius ───────────────────────────────────────────────────────────────────
export const R = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  accent: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  }),
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  }),
} as const;

// ─── Topic metadata ───────────────────────────────────────────────────────────
export const TOPIC_META: Record<string, { label: string; icon: string; color: string }> = {
  replication:              { label: 'Replication',       icon: '⬡', color: C.accent },
  partitioning:             { label: 'Partitioning',      icon: '⊞', color: C.green },
  consensus:                { label: 'Consensus',         icon: '◈', color: C.purple },
  transactions:             { label: 'Transactions',      icon: '⚡', color: C.yellow },
  storage_engines:          { label: 'Storage Engines',   icon: '◉', color: C.orange },
  distributed_systems_faults:{ label: 'Fault Tolerance',  icon: '⚠', color: C.red },
  stream_processing:        { label: 'Stream Processing', icon: '⟶', color: C.green },
  batch_processing:         { label: 'Batch Processing',  icon: '⊟', color: C.accent },
  data_structures:          { label: 'Data Structures',   icon: '⬢', color: C.purple },
};

// ─── Level colors ─────────────────────────────────────────────────────────────
export function levelColor(level: string): string {
  return (C as any)[level] ?? C.textMid;
}

// ─── XP to level ─────────────────────────────────────────────────────────────
export function xpToLevel(xp: number): number {
  return Math.floor(xp / 400) + 1;
}
export function xpProgress(xp: number): number {
  return (xp % 400) / 400;
}
export function xpToNextLevel(xp: number): number {
  return 400 - (xp % 400);
}
