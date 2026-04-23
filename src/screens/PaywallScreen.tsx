/**
 * DistroLearn — Pro Subscription Paywall
 *
 * Shows when a user tries to access a Pro feature.
 * Loads offerings from RevenueCat and displays monthly + annual packages.
 *
 * Free tier:   10 cards/day, puzzles, basic stats
 * Pro tier:    Unlimited cards, all viz quizzes, detailed SM-2 analytics,
 *              offline sync, no ads, priority support
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S, R, FONT, SHADOW } from '../theme';
import { getOfferings, purchasePackage, restorePurchases } from '../services/purchases';
import type { PurchasesPackage } from 'react-native-purchases';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  onPurchased: () => void;
  onDismiss:   () => void;
}

// ── Features list ──────────────────────────────────────────────────────────────

const FREE_FEATURES = [
  '10 flash cards per day',
  '3 puzzles per day',
  'Basic streak tracking',
  'Core topics only',
];

const PRO_FEATURES = [
  { icon: '∞',  text: 'Unlimited flash card sessions' },
  { icon: '⬡',  text: 'All Visualization Quiz topics' },
  { icon: '◉',  text: 'Deep SM-2 analytics & heatmaps' },
  { icon: '☁',  text: 'Cross-device sync via Supabase' },
  { icon: '⚡',  text: 'Early access to new content' },
  { icon: '◈',  text: 'Priority support' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function PaywallScreen({ onPurchased, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const [packages, setPackages]   = useState<PurchasesPackage[]>([]);
  const [selected, setSelected]   = useState<PurchasesPackage | null>(null);
  const [loading, setLoading]     = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    getOfferings().then(offering => {
      const pkgs = offering?.availablePackages ?? [];
      setPackages(pkgs);
      // Default select annual if available
      const annual = pkgs.find(p => p.packageType === 'ANNUAL') ?? pkgs[0] ?? null;
      setSelected(annual);
      setLoading(false);
    });
  }, []);

  async function handlePurchase() {
    if (!selected) return;
    setPurchasing(true);
    try {
      const success = await purchasePackage(selected);
      if (success) onPurchased();
    } catch (e: any) {
      Alert.alert('Purchase failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setPurchasing(true);
    try {
      const isPro = await restorePurchases();
      if (isPro) { onPurchased(); }
      else { Alert.alert('Nothing to restore', 'No active Pro subscription found.'); }
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Close */}
      <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>⚡</Text>
          </View>
          <Text style={styles.heroTitle}>DistroLearn Pro</Text>
          <Text style={styles.heroSub}>
            Master distributed systems faster with unlimited access and deep analytics.
          </Text>
        </View>

        {/* Pro features */}
        <View style={styles.featureCard}>
          {PRO_FEATURES.map(f => (
            <View key={f.text} style={styles.featureRow}>
              <View style={styles.featureIconBox}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
              <Text style={styles.featureCheck}>✓</Text>
            </View>
          ))}
        </View>

        {/* Packages */}
        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginVertical: 32 }} />
        ) : packages.length === 0 ? (
          // Fallback UI when RevenueCat not configured yet
          <View style={styles.devNotice}>
            <Text style={styles.devNoticeTitle}>RevenueCat not configured</Text>
            <Text style={styles.devNoticeText}>
              Add EXPO_PUBLIC_RC_APPLE_KEY / EXPO_PUBLIC_RC_GOOGLE_KEY to .env
              and create a "pro" entitlement in the RevenueCat dashboard.
            </Text>
          </View>
        ) : (
          <View style={styles.packages}>
            {packages.map(pkg => {
              const isSel = selected?.identifier === pkg.identifier;
              const isAnnual = pkg.packageType === 'ANNUAL';
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.packageCard, isSel && styles.packageCardSelected]}
                  onPress={() => setSelected(pkg)}
                  activeOpacity={0.8}
                >
                  {isAnnual && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>BEST VALUE</Text>
                    </View>
                  )}
                  <Text style={[styles.packageTitle, isSel && { color: C.accent }]}>
                    {pkg.product.title || (isAnnual ? 'Annual' : 'Monthly')}
                  </Text>
                  <Text style={[styles.packagePrice, isSel && { color: C.accent }]}>
                    {pkg.product.priceString}
                    <Text style={styles.packagePeriod}>
                      {isAnnual ? ' / year' : ' / month'}
                    </Text>
                  </Text>
                  {isAnnual && (
                    <Text style={styles.packageSaving}>Save ~40% vs monthly</Text>
                  )}
                  {isSel && <View style={styles.packageCheck}><Text style={styles.packageCheckText}>✓</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (purchasing || !selected) && { opacity: 0.6 }]}
          onPress={handlePurchase}
          disabled={purchasing || !selected}
          activeOpacity={0.85}
        >
          {purchasing
            ? <ActivityIndicator color={C.bg} />
            : <Text style={styles.ctaBtnText}>
                {selected ? `Subscribe · ${selected.product.priceString}` : 'Select a plan'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={purchasing}>
          <Text style={styles.restoreBtnText}>Restore purchases</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.
          Manage in your App Store / Play Store account settings.
        </Text>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: S.screenH, paddingTop: S.lg },

  closeBtn: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
  closeIcon: { color: C.textMid, fontSize: 18 },

  // Hero
  hero: { alignItems: 'center', paddingTop: S.xl, paddingBottom: S.xxl },
  heroIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: S.lg, ...SHADOW.glow(C.accent),
  },
  heroIconText: { fontSize: 32 },
  heroTitle: {
    fontSize: 26, fontWeight: '900', color: C.text, fontFamily: FONT.sans,
    marginBottom: S.sm, letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 14, color: C.textMid, fontFamily: FONT.sans,
    textAlign: 'center', lineHeight: 22,
  },

  // Features
  featureCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl, gap: S.md, marginBottom: S.xl,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  featureIconBox: {
    width: 32, height: 32, borderRadius: R.sm,
    backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  featureIcon: { fontSize: 14, color: C.accent },
  featureText: { flex: 1, fontSize: 13, color: C.text, fontFamily: FONT.sans },
  featureCheck: { color: C.green, fontSize: 14, fontWeight: '700' },

  // Packages
  packages: { gap: S.md, marginBottom: S.xl },
  packageCard: {
    backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1.5,
    borderColor: C.border, padding: S.xl, position: 'relative', overflow: 'hidden',
  },
  packageCardSelected: { borderColor: C.accent, backgroundColor: C.accentDim },
  bestValueBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: C.accent, paddingHorizontal: S.md, paddingVertical: 4,
    borderBottomLeftRadius: R.md,
  },
  bestValueText: { fontSize: 9, fontWeight: '800', color: C.bg, fontFamily: FONT.mono, letterSpacing: 1 },
  packageTitle: { fontSize: 15, fontWeight: '700', color: C.text, fontFamily: FONT.sans, marginBottom: 4 },
  packagePrice: { fontSize: 22, fontWeight: '900', color: C.text, fontFamily: FONT.sans },
  packagePeriod: { fontSize: 13, fontWeight: '400', color: C.textMid },
  packageSaving: { fontSize: 11, color: C.green, fontFamily: FONT.sans, marginTop: 4 },
  packageCheck: {
    position: 'absolute', top: S.lg, right: S.lg,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  packageCheckText: { color: C.bg, fontSize: 12, fontWeight: '800' },

  // Dev notice
  devNotice: {
    backgroundColor: C.surface, borderRadius: R.xl, borderWidth: 1,
    borderColor: C.border, padding: S.xl, marginBottom: S.xl, gap: S.sm,
    borderStyle: 'dashed',
  },
  devNoticeTitle: { fontSize: 14, fontWeight: '700', color: C.yellow, fontFamily: FONT.sans },
  devNoticeText: { fontSize: 12, color: C.textMid, fontFamily: FONT.mono, lineHeight: 18 },

  // CTA
  ctaBtn: {
    backgroundColor: C.accent, borderRadius: R.lg, paddingVertical: 18,
    alignItems: 'center', marginBottom: S.md, ...SHADOW.accent(C.accent),
  },
  ctaBtnText: { fontSize: 16, fontWeight: '800', color: C.bg, fontFamily: FONT.sans },

  restoreBtn: { alignItems: 'center', paddingVertical: S.md, marginBottom: S.lg },
  restoreBtnText: { fontSize: 13, color: C.textMid, fontFamily: FONT.sans },

  legal: {
    fontSize: 10, color: C.textDim, fontFamily: FONT.sans, textAlign: 'center', lineHeight: 16,
  },
});
