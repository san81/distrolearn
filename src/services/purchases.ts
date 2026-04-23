/**
 * DistroLearn — RevenueCat In-App Purchases
 *
 * Setup:
 *   1. Create a RevenueCat project at app.revenuecat.com
 *   2. Add your API keys to .env:
 *        EXPO_PUBLIC_RC_APPLE_KEY=appl_xxxx
 *        EXPO_PUBLIC_RC_GOOGLE_KEY=goog_xxxx
 *   3. Create an Entitlement named "pro" in the RC dashboard
 *   4. Attach monthly + annual products to that entitlement
 *
 * This file wraps Purchases so the rest of the app never imports
 * react-native-purchases directly — easier to mock in tests.
 */
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const APPLE_KEY  = process.env.EXPO_PUBLIC_RC_APPLE_KEY  ?? '';
const GOOGLE_KEY = process.env.EXPO_PUBLIC_RC_GOOGLE_KEY ?? '';

// ── Init ───────────────────────────────────────────────────────────────────────

let _configured = false;

export function configurePurchases(userId?: string): void {
  if (_configured) return;
  const apiKey = Platform.OS === 'ios' ? APPLE_KEY : GOOGLE_KEY;
  if (!apiKey) {
    console.warn('[purchases] No RevenueCat API key set — paywall disabled');
    return;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey, appUserID: userId });
  _configured = true;
}

// ── Entitlement check ──────────────────────────────────────────────────────────

export async function isPro(): Promise<boolean> {
  if (!_configured) return false;
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}

// ── Offerings ──────────────────────────────────────────────────────────────────

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!_configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

// ── Purchase ───────────────────────────────────────────────────────────────────

/**
 * Purchase a package from the current offering.
 * Returns true on success, false if user cancelled, throws on real error.
 */
export async function purchasePackage(pkg: Awaited<ReturnType<typeof getOfferings>> extends null ? never : NonNullable<Awaited<ReturnType<typeof getOfferings>>>['availablePackages'][number]): Promise<boolean> {
  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

// ── Restore ────────────────────────────────────────────────────────────────────

export async function restorePurchases(): Promise<boolean> {
  if (!_configured) return false;
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}

// ── Identify user ──────────────────────────────────────────────────────────────

export async function identifyUser(userId: string): Promise<void> {
  if (!_configured) return;
  try {
    await Purchases.logIn(userId);
  } catch {}
}
