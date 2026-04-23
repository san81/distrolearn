/**
 * DistroLearn — App Entry Point (complete)
 *
 * Navigation stack:
 *   loading → session restore
 *   auth    → email sign-in / sign-up
 *   onboarding → first-time level + topic selection
 *   main    → bottom tab bar (Home | Cards | Puzzles | Stats)
 *     └─ modal: flashcard session
 *     └─ modal: puzzle session
 *
 * Startup sequence:
 *   1. restoreSession() — checks SecureStore for JWT
 *   2a. JWT valid + not first time  → main tabs
 *   2b. JWT valid + first time      → onboarding
 *   2c. No JWT                      → auth screen
 *   3. Post-login: SM-2 state pull + today's cards
 *   4. Connectivity listener for background SM-2 sync
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, Animated, Image,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { store } from './src/store';
import { restoreSession, onAuthStateChange } from './src/services/auth';
import { startConnectivitySync } from './src/services/sync';
import { seedDevCards } from './src/db/database';
import { configurePurchases } from './src/services/purchases';
import { initAudio } from './src/services/audio';
import { initAnalytics, identifyUser, resetUser, trackPaywallViewed } from './src/services/analytics';
import { scheduleDailyReminder, requestNotificationPermission } from './src/services/notifications';
import { C, S, R, FONT, SHADOW, TOPIC_META } from './src/theme';
import type { UserLevel } from './src/engine/sm2';
import { getRandomPuzzles } from './src/qbank/loader';

// Screens
import AuthScreen        from './src/screens/AuthScreen';
import OnboardingScreen  from './src/screens/OnboardingScreen';
import HomeScreen        from './src/screens/HomeScreen';
import FlashCardScreen   from './src/screens/FlashCardScreen';
import PuzzleScreen      from './src/screens/PuzzleScreen';
import StatsScreen       from './src/screens/StatsScreen';
import VizQuizScreen     from './src/screens/VizQuizScreen';
import PaywallScreen     from './src/screens/PaywallScreen';

// ─── Constants ────────────────────────────────────────────────────────────────

const ONBOARDING_KEY = 'distrolearn_onboarding_done';
type Tab = 'home' | 'cards' | 'puzzles' | 'stats';
type AppScreen = 'loading' | 'auth' | 'onboarding' | 'main' | 'session_cards' | 'session_puzzles' | 'viz_quiz' | 'paywall';

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppInner />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}

// ─── App Inner ────────────────────────────────────────────────────────────────

function AppInner() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [sessionTopic, setSessionTopic] = useState<string | undefined>(undefined);
  const [sessionStats, setSessionStats] = useState<{
    cardsReviewed: number; xpEarned: number; streakDays: number;
  } | null>(null);

  // Connectivity cleanup
  const stopSync = useRef<(() => void) | null>(null);

  // ── Startup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const restoredUser = await restoreSession();
      initAnalytics();
      // Fire-and-forget — audio init must never block startup or crash the app
      initAudio().catch(e => console.warn('[audio] init error:', e));
      if (restoredUser) {
        setUser(restoredUser);
        identifyUser(restoredUser.id, restoredUser.email ?? undefined);
        configurePurchases(restoredUser.id);
        await seedDevCards(restoredUser.id);
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
        setScreen(onboardingDone ? 'main' : 'onboarding');
        stopSync.current = startConnectivitySync(restoredUser.id);
      } else {
        setScreen('auth');
      }
    }
    init();

    const unsub = onAuthStateChange(u => {
      if (!u) { setUser(null); setScreen('auth'); }
    });

    return () => {
      unsub();
      stopSync.current?.();
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAuthSuccess = useCallback(async (userId: string) => {
    const u = await restoreSession();
    // For dev login, restoreSession returns null — create a minimal User-like object
    if (u) setUser(u);
    else setUser({ id: userId, email: 'dev@local' } as any);
    identifyUser(userId, u?.email ?? undefined);
    configurePurchases(userId);
    await seedDevCards(userId);
    const done = await AsyncStorage.getItem(ONBOARDING_KEY);
    setScreen(done ? 'main' : 'onboarding');
    stopSync.current = startConnectivitySync(userId);
  }, []);

  const handleOnboardingComplete = useCallback(async (level: UserLevel, topics: string[]) => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    await AsyncStorage.setItem('distrolearn_level', level);
    await AsyncStorage.setItem('distrolearn_topics', JSON.stringify(topics));
    // Ask for notification permission after onboarding and schedule daily reminder
    await requestNotificationPermission();
    await scheduleDailyReminder();
    setScreen('main');
  }, []);

  const handleStartCards = useCallback((topic?: string) => {
    setSessionTopic(topic);
    setScreen('session_cards');
  }, []);

  const handleStartPuzzles = useCallback(() => {
    setScreen('session_puzzles');
  }, []);

  const handleStartVizQuiz = useCallback(() => {
    setScreen('viz_quiz');
  }, []);

  const handleShowPaywall = useCallback(() => {
    trackPaywallViewed();
    setScreen('paywall');
  }, []);

  const handleCardSessionComplete = useCallback((stats: typeof sessionStats) => {
    setSessionStats(stats);
    setScreen('main');
    setActiveTab('home');
    // Reschedule tomorrow's reminder since user practiced today
    scheduleDailyReminder();
  }, []);

  const handleSignOut = useCallback(() => {
    stopSync.current?.();
    resetUser();
    setUser(null);
    setScreen('auth');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (screen === 'loading') return <SplashScreen />;
  if (screen === 'auth')    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  if (screen === 'onboarding') return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  if (!user) return <SplashScreen />;

  if (screen === 'session_cards') return (
    <FlashCardScreen
      userId={user.id}
      topic={sessionTopic}
      onSessionComplete={handleCardSessionComplete}
      onExit={() => setScreen('main')}
    />
  );

  if (screen === 'session_puzzles') return (
    <PuzzleScreenLoader
      userId={user.id}
      onComplete={(xp) => { setScreen('main'); setActiveTab('home'); }}
      onExit={() => setScreen('main')}
    />
  );

  if (screen === 'viz_quiz') return (
    <VizQuizScreen onExit={() => setScreen('main')} />
  );

  if (screen === 'paywall') return (
    <PaywallScreen onPurchased={() => setScreen('main')} onDismiss={() => setScreen('main')} />
  );

  // Main: tab navigator
  return (
    <MainTabs
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      sessionStats={sessionStats}
      onStartCards={handleStartCards}
      onStartPuzzles={handleStartPuzzles}
      onStartVizQuiz={handleStartVizQuiz}
      onShowPaywall={handleShowPaywall}
      onSignOut={handleSignOut}
    />
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────

interface MainTabsProps {
  user: User;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  sessionStats: { cardsReviewed: number; xpEarned: number; streakDays: number } | null;
  onStartCards: (topic?: string) => void;
  onStartPuzzles: () => void;
  onStartVizQuiz: () => void;
  onShowPaywall: () => void;
  onSignOut: () => void;
}

function MainTabs({ user, activeTab, setActiveTab, sessionStats, onStartCards, onStartPuzzles, onStartVizQuiz, onShowPaywall, onSignOut }: MainTabsProps) {
  const insets = useSafeAreaInsets();
  const username = user.email?.split('@')[0] ?? 'User';

  const TAB_ITEMS: Array<{ id: Tab; icon: string; label: string }> = [
    { id: 'home',    icon: '⌂',  label: 'Home' },
    { id: 'cards',   icon: '◈',  label: 'Cards' },
    { id: 'puzzles', icon: '⊞',  label: 'Puzzles' },
    { id: 'stats',   icon: '◉',  label: 'Stats' },
  ];

  return (
    <View style={mt.container}>
      {/* Screen content */}
      <View style={mt.content}>
        {activeTab === 'home' && (
          <HomeScreen
            userId={user.id}
            username={username}
            onStartFlashCards={onStartCards}
            onStartPuzzles={onStartPuzzles}
            onStartVizQuiz={onStartVizQuiz}
            onOpenStats={() => setActiveTab('stats')}
          />
        )}
        {activeTab === 'cards' && (
          <FlashCardScreen
            userId={user.id}
            onSessionComplete={(stats) => {
              // Stay on cards tab but could show a completion sheet
            }}
            onExit={() => setActiveTab('home')}
          />
        )}
        {activeTab === 'puzzles' && (
          <PuzzleScreenLoader
            userId={user.id}
            onComplete={() => setActiveTab('home')}
            onExit={() => setActiveTab('home')}
          />
        )}
        {activeTab === 'stats' && (
          <StatsScreen
            userId={user.id}
            username={username}
            email={user.email ?? ''}
            onSignOut={onSignOut}
          />
        )}
      </View>

      {/* Bottom tab bar */}
      <View style={[mt.tabBar, { paddingBottom: insets.bottom || S.safeBot }]}>
        {TAB_ITEMS.map(tab => (
          <TabButton
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === tab.id}
            onPress={() => setActiveTab(tab.id)}
          />
        ))}
      </View>
    </View>
  );
}

const mt = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: S.sm,
  },
});

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({ icon, label, active, onPress }: {
  icon: string; label: string; active: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function press() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onPress();
  }

  return (
    <TouchableOpacity style={tb.btn} onPress={press} activeOpacity={1}>
      <Animated.View style={[tb.inner, { transform: [{ scale }] }]}>
        <Text style={[tb.icon, active && { color: C.accent }]}>{icon}</Text>
        <Text style={[tb.label, active && { color: C.accent }]}>{label}</Text>
        {active && <View style={tb.dot} />}
      </Animated.View>
    </TouchableOpacity>
  );
}

const tb = StyleSheet.create({
  btn: { flex: 1, alignItems: 'center' },
  inner: { alignItems: 'center', gap: 3, paddingTop: 4 },
  icon: { fontSize: 20, color: C.textDim },
  label: { fontSize: 10, color: C.textDim, fontFamily: FONT.sans, fontWeight: '500' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent },
});

// ─── Puzzle Screen Loader ─────────────────────────────────────────────────────
// Loads puzzle data from the bundled JSON bank, then renders PuzzleScreen.
// In production: fetch from Supabase instead.

function PuzzleScreenLoader({ userId, onComplete, onExit }: {
  userId: string; onComplete: (xp: number) => void; onExit: () => void;
}) {
  const [puzzles, setPuzzles] = useState<any[] | null>(null);

  useEffect(() => {
    setPuzzles(getRandomPuzzles(5));
  }, []);

  if (!puzzles) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.accent} />
    </View>
  );

  return (
    <PuzzleScreen
      userId={userId}
      puzzles={puzzles}
      onComplete={onComplete}
      onExit={onExit}
    />
  );
}

// ─── Splash Screen ────────────────────────────────────────────────────────────

function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[sp.container, { opacity: fadeAnim }]}>
      <Image source={require('./assets/icon.png')} style={sp.logo} />
      <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
    </Animated.View>
  );
}

const sp = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  logo: {
    width: 120, height: 120, borderRadius: 28,
    ...SHADOW.glow(C.accent),
  },
});
