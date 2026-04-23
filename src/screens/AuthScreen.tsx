/**
 * DistroLearn — Auth Screen
 *
 * Handles sign-in and sign-up with email/password.
 * On success: triggers SM-2 state pull → card content bootstrap → navigate to Home.
 *
 * Design: dark, geometric, "terminal meets learning" aesthetic.
 * Typography: monospace for the logo mark, clean sans for body.
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  ScrollView, StatusBar, Image,
} from 'react-native';
import { signIn, signUp, resetPassword, supabase } from '../services/auth';

// Google Sign-In — requires a native dev build (not available in Expo Go).
// Dynamic require so the import itself doesn't crash when the native binary is absent.
let GoogleSignin: any = null;
let statusCodes: any = {};
let googleSignInAvailable = false;
try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    scopes: ['profile', 'email'],
  });
  googleSignInAvailable = true;
} catch {
  // Native module not present (Expo Go) — Google Sign-In disabled
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'signin' | 'signup' | 'reset';

interface Props {
  onAuthSuccess: (userId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthScreen({ onAuthSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email';
    if (mode === 'reset') return null;
    if (!password) return 'Password is required';
    if (mode === 'signup') {
      if (password.length < 8) return 'Password must be at least 8 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    return null;
  }

  function shake() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  // ── Google Sign-In ──────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    if (!googleSignInAvailable) {
      setError('Google Sign-In requires a dev build — use email or the Dev Login button below.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) throw new Error('No ID token from Google');

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) { setError(error.message); shake(); return; }
      if (data.user) onAuthSuccess(data.user.id);
    } catch (e: any) {
      console.log('[google-signin] error code:', e.code, 'message:', e.message, 'full:', JSON.stringify(e));
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled — no error shown
      } else if (e.code === statusCodes.IN_PROGRESS) {
        // Already in progress
      } else {
        setError(`Google sign-in failed: ${e.message ?? e.code ?? 'unknown error'}`);
        shake();
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      shake();
      return;
    }

    setLoading(true);
    try {
      if (mode === 'reset') {
        const result = await resetPassword(email.trim().toLowerCase());
        if (result.error) { setError(result.error); shake(); }
        else setResetSent(true);
        return;
      }

      const result = mode === 'signin'
        ? await signIn(email.trim().toLowerCase(), password)
        : await signUp(email.trim().toLowerCase(), password);

      if (result.error) {
        setError(result.error);
        shake();
        return;
      }

      if (result.user) {
        onAuthSuccess(result.user.id);
      } else if (mode === 'signup') {
        // Email confirmation flow — Supabase sent a verification email
        setError(null);
        setMode('signin');
        // Show a gentle message (handled below by checking resetSent pattern)
        setResetSent(true); // Reuse the "check email" state
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
      shake();
    } finally {
      setLoading(false);
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const title = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password';
  const buttonLabel = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link';

  if (resetSent) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centeredBox}>
          <Text style={styles.emailSentIcon}>✉</Text>
          <Text style={styles.emailSentTitle}>Check your email</Text>
          <Text style={styles.emailSentBody}>
            {mode === 'reset' || mode === 'signin'
              ? `We sent a password reset link to ${email}`
              : `We sent a confirmation link to ${email}. Click it to activate your account.`}
          </Text>
          <TouchableOpacity style={styles.ghostButton} onPress={() => { setResetSent(false); setMode('signin'); }}>
            <Text style={styles.ghostButtonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <Image source={require('../../assets/icon.png')} style={styles.logoMark} />
          <Text style={styles.logoName}>DistroLearn</Text>
          <Text style={styles.logoTagline}>Master distributed systems and data structures</Text>
        </View>

        {/* Form card */}
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.cardTitle}>{title}</Text>

          {/* Email field */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#3D4466"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType={mode === 'reset' ? 'send' : 'next'}
              onSubmitEditing={() => mode !== 'reset' ? passwordRef.current?.focus() : handleSubmit()}
            />
          </View>

          {/* Password field */}
          {mode !== 'reset' && (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
                placeholderTextColor="#3D4466"
                secureTextEntry
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                returnKeyType={mode === 'signup' ? 'next' : 'done'}
                onSubmitEditing={() =>
                  mode === 'signup' ? confirmRef.current?.focus() : handleSubmit()
                }
              />
            </View>
          )}

          {/* Confirm password (sign up only) */}
          {mode === 'signup' && (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                ref={confirmRef}
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor="#3D4466"
                secureTextEntry
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          )}

          {/* Forgot password (sign-in only) */}
          {mode === 'signin' && (
            <TouchableOpacity
              style={styles.forgotWrapper}
              onPress={() => { setError(null); setMode('reset'); }}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Primary button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#0D0F1A" size="small" />
              : <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
            }
          </TouchableOpacity>

          {/* Google Sign-In (only on signin/signup modes) */}
          {mode !== 'reset' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <TouchableOpacity
                style={[styles.googleButton, loading && styles.primaryButtonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Mode switch */}
          <View style={styles.modeSwitchRow}>
            {mode === 'signin' ? (
              <>
                <Text style={styles.modeSwitchLabel}>No account?</Text>
                <TouchableOpacity onPress={() => { setError(null); setMode('signup'); }}>
                  <Text style={styles.modeSwitchAction}>Create one</Text>
                </TouchableOpacity>
              </>
            ) : mode === 'signup' ? (
              <>
                <Text style={styles.modeSwitchLabel}>Have an account?</Text>
                <TouchableOpacity onPress={() => { setError(null); setMode('signin'); }}>
                  <Text style={styles.modeSwitchAction}>Sign in</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modeSwitchLabel}>Remember it?</Text>
                <TouchableOpacity onPress={() => { setError(null); setMode('signin'); }}>
                  <Text style={styles.modeSwitchAction}>Back to sign in</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>

        {/* Footer note */}
        <Text style={styles.footer}>
          Powered by SM-2 spaced repetition — a scientifically proven algorithm
          that schedules each card exactly when you're about to forget it,
          so you learn more in less time.
        </Text>

        {/* Dev shortcut — remove before shipping */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devButton}
            onPress={() => onAuthSuccess('dev-user-local')}
          >
            <Text style={styles.devButtonText}>⚡ Dev Login (skip auth)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#080A14',
  surface: '#0F1120',
  card: '#141729',
  border: '#1E2240',
  accent: '#5B8EFF',
  accentDim: '#1A2340',
  green: '#2DD4BF',
  error: '#FF5B5B',
  errorBg: '#2A1010',
  text: '#E4E8FF',
  textMid: '#7A84AA',
  textDim: '#3D4466',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  sans: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoMark: {
    width: 120,
    height: 120,
    borderRadius: 30,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: C.green,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },
  logoName: {
    fontFamily: C.sans,
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  logoTagline: {
    fontFamily: C.sans,
    fontSize: 13,
    color: C.textMid,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    marginBottom: 24,
  },
  cardTitle: {
    fontFamily: C.sans,
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  fieldWrapper: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: C.mono,
    fontSize: 10,
    color: C.textMid,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: C.text,
    fontFamily: C.sans,
  },
  errorBox: {
    backgroundColor: C.errorBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3D1010',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    fontFamily: C.sans,
    lineHeight: 18,
  },
  forgotWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    color: C.accent,
    fontSize: 13,
    fontFamily: C.sans,
  },
  primaryButton: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  primaryButtonText: {
    color: '#080A14',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: C.sans,
    letterSpacing: 0.2,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  modeSwitchLabel: {
    color: C.textMid,
    fontSize: 13,
    fontFamily: C.sans,
  },
  modeSwitchAction: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: C.sans,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { color: C.textDim, fontSize: 12, fontFamily: C.sans },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingVertical: 14,
    marginBottom: 20,
  },
  googleIcon: {
    fontSize: 16, fontWeight: '900', color: '#EA4335', fontFamily: C.sans,
  },
  googleButtonText: {
    color: C.text, fontSize: 15, fontWeight: '600', fontFamily: C.sans,
  },
  footer: {
    textAlign: 'center',
    color: C.textMid,
    fontSize: 12,
    fontFamily: C.sans,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  // Email sent state
  centeredBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emailSentIcon: {
    fontSize: 48,
    marginBottom: 20,
    color: C.green,
  },
  emailSentTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    fontFamily: C.sans,
    marginBottom: 12,
  },
  emailSentBody: {
    fontSize: 14,
    color: C.textMid,
    fontFamily: C.sans,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  ghostButtonText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: C.sans,
  },
  devButton: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2D40',
    borderStyle: 'dashed',
  },
  devButtonText: {
    color: '#3D4466',
    fontSize: 12,
    fontFamily: C.mono,
    letterSpacing: 0.5,
  },
});
