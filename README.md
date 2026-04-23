# DistroLearn

A gamified mobile app for learning distributed systems and data structures using spaced repetition (SM-2), puzzles, and visual quizzes.

Built with React Native + Expo, Supabase (auth + database), and EAS Build.

---

## Development Setup

### Prerequisites

- Node.js 18+
- Java 17 (`export JAVA_HOME=$(/usr/libexec/java_home -v 17)`)
- Android Studio + Android SDK (for Android builds)
- EAS CLI (`npm install -g eas-cli`)
- Expo CLI (`npm install -g expo`)

### Install dependencies

```bash
npm install
```

### Environment variables

Copy `.env` and fill in values:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=       # Web application client from Google Cloud Console
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_POSTHOG_KEY=
SENTRY_AUTH_TOKEN=
```

### Start Metro (requires a dev build on device)

```bash
npx expo start
```

---

## Building

### Development build (installs on device, connects to Metro)

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

After installing the APK/IPA on device, run `npx expo start` and scan the QR code.

### Production build

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

---

## Google Sign-In Configuration

Google Sign-In requires three things to be correctly wired together:

### 1. Google Cloud Console — OAuth Clients

In [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials:

| Client type | Purpose |
|---|---|
| **Web application** | `webClientId` passed to `GoogleSignin.configure()`. Also used in Supabase Google provider. |
| **Android** | Validates the app's package name + SHA-1 fingerprint. Not used in code directly. |
| **iOS** | Used for iOS sign-in. `iosClientId` in `app.json` plugin config. |

The Android OAuth client must have the SHA-1 fingerprint(s) of the signing keystore(s):

| Build type | How to get SHA-1 |
|---|---|
| Development build | `~/Library/Android/sdk/build-tools/37.0.0/apksigner verify --print-certs <apk> \| grep SHA-1` |
| Production build | `eas credentials --platform android` — look for the SHA-1 fingerprint |

Multiple SHA-1s can be added to the same Android client (dev + prod side by side).

### 2. Supabase — Google Provider

Supabase Dashboard → Authentication → Providers → Google:

- **Client ID:** Web application client ID from Google Cloud Console
- **Client Secret:** Web application client secret

### 3. app.json plugin

```json
["@react-native-google-signin/google-signin", {
  "iosClientId": "<iOS client ID>",
  "iosUrlScheme": "<iOS URL scheme>",
  "webClientId": "<Web application client ID>"
}]
```

---

## Production Release Checklist

### One-time setup (do before first release)

#### Google Play Store
1. Create a [Google Play Developer account](https://play.google.com/console) ($25 one-time fee)
2. Create a new app in Play Console → All apps → Create app
3. Fill in app details: name, default language, app/game, free/paid
4. Complete the store listing:
   - Short description (80 chars), full description (4000 chars)
   - At least 2 screenshots per device type (phone required, tablet optional)
   - Feature graphic (1024×500 px)
   - App icon (512×512 px, already in `assets/`)
5. Complete the Content rating questionnaire (Play Console → Policy → App content)
6. Set up a Privacy Policy URL (required — host a page or use a generator)
7. Complete Data safety form (Play Console → Policy → Data safety)
8. Set pricing and distribution (countries, free/paid)
9. Set up **Play App Signing**:
   - Play Console → Setup → App signing → opt in to Play-managed signing
   - EAS will upload the AAB; Google re-signs it with the Play signing key
   - After first upload, get the Play signing SHA-1 from Play Console → Setup → App signing → App signing key certificate → SHA-1
   - Add that SHA-1 to the Android OAuth client in Google Cloud Console (alongside the dev SHA-1)

#### Apple App Store
1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create the app in [App Store Connect](https://appstoreconnect.apple.com):
   - My Apps → + → New App
   - Bundle ID: `com.raft.distrolearn` (must match `app.json`)
   - SKU: any unique string (e.g. `distrolearn`)
3. Fill in store listing:
   - Name, subtitle, description, keywords (100 char limit), support URL
   - Screenshots: at least iPhone 6.5" and 5.5" sizes
   - App icon is bundled in the build — no separate upload needed
4. Set up a Privacy Policy URL (required)
5. Complete age rating questionnaire
6. Set pricing (free or paid)
7. Configure Sign in with Apple if adding it later (requires separate Capability)

---

### Every release

#### Step 1 — Bump the version

In `app.json`, increment `version` (user-facing) and `buildNumber`/`versionCode` (must increase with every store upload):

```json
{
  "expo": {
    "version": "1.1.0",
    "ios": {
      "buildNumber": "2"
    },
    "android": {
      "versionCode": 2
    }
  }
}
```

#### Step 2 — Build

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

Android produces an **AAB** (Android App Bundle) — required by Play Store.
iOS produces an **IPA** — uploaded to App Store Connect.

#### Step 3 — Register the release keystore SHA-1 (first production build only)

```bash
eas credentials --platform android
```

Look for the `SHA1:` line under "Keystore credentials". Add it to:
- Google Cloud Console → Credentials → Android OAuth client (`com.raft.distrolearn`) → add as additional fingerprint alongside the dev SHA-1

After enabling Play App Signing, also add the **Play signing key SHA-1** (from Play Console → Setup → App signing).

#### Step 4 — Submit to stores

```bash
eas submit --platform android   # uploads AAB to Play Console internal track
eas submit --platform ios       # uploads IPA to App Store Connect TestFlight
```

Or upload manually:
- Android: Play Console → Production → Create new release → upload AAB
- iOS: Use Transporter app (free, Mac App Store) to upload the IPA

#### Step 5 — Test before publishing

- **Android:** Play Console → Testing → Internal testing → promote to Production after testing
- **iOS:** App Store Connect → TestFlight → test on device → submit for App Review

#### Step 6 — Submit for review

- **Android:** Play Console → Production → Review release → Start rollout (usually auto-approved within hours)
- **iOS:** App Store Connect → App Review → Submit for review (typically 1-3 days)

---

### Subsequent releases (no native changes)

If only JS/assets changed, skip the full build and use OTA:

```bash
eas update --branch production --message "what changed"
```

If native modules, `app.json` plugins, or `package.json` native deps changed → full `eas build` required.

---

## OTA Updates

JS-only changes can be pushed without a store release:

```bash
eas update --branch production --message "describe the change"
```

Native changes (new packages with native modules, app.json plugin changes) require a full `eas build`.

---

## Sentry

- Organization slug: `raft-b2`
- Project slug: `distrolearn`
- Auth token in `.env` as `SENTRY_AUTH_TOKEN`
- Sentry is disabled in `__DEV__` mode by default — use device logs / Metro for debugging

---

## Key dependencies

| Package | Purpose |
|---|---|
| `expo-sqlite` | Local SM-2 card state |
| `expo-av` | Sound effects (migrate to `expo-audio` on next native rebuild) |
| `expo-notifications` | Daily streak reminders |
| `@react-native-google-signin/google-signin` | Google OAuth |
| `react-native-draggable-flatlist` | Drag-to-reorder puzzles |
| `@supabase/supabase-js` | Auth + remote database |
| `@sentry/react-native` | Crash reporting |
| `posthog-react-native` | Product analytics |
