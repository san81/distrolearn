/**
 * DistroLearn — Audio Service
 *
 * Plays short sound effects on user actions.
 * All sounds are optional — silently skipped if file missing or audio disabled.
 *
 * Sound files go in assets/sounds/:
 *   flip.mp3       — card flip
 *   again.mp3      — rated Again (low tone)
 *   hard.mp3       — rated Hard
 *   good.mp3       — rated Good
 *   easy.mp3       — rated Easy (bright chime)
 *   complete.mp3   — session complete fanfare
 *   levelup.mp3    — level-up celebration
 *
 * Free sound packs: freesound.org, mixkit.co, pixabay.com/sound-effects
 *
 * NOTE: Using expo-av (deprecated in SDK 53, removed in SDK 54).
 * Migrate to expo-audio when doing the next native rebuild.
 */
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AUDIO_ENABLED_KEY = 'distrolearn_audio_enabled';

// ── State ─────────────────────────────────────────────────────────────────────

let _enabled = true;
let _loaded = false;

const _sounds: Record<string, Audio.Sound | null> = {
  flip:     null,
  again:    null,
  hard:     null,
  good:     null,
  easy:     null,
  complete: null,
  levelup:  null,
};

// Map sound keys to bundled asset requires
const SOUND_ASSETS: Record<string, any> = {
  flip:     require('../../assets/sounds/flip.mp3'),
  again:    require('../../assets/sounds/again.mp3'),
  hard:     require('../../assets/sounds/hard.mp3'),
  good:     require('../../assets/sounds/good.mp3'),
  easy:     require('../../assets/sounds/easy.mp3'),
  complete: require('../../assets/sounds/complete.mp3'),
  levelup:  require('../../assets/sounds/levelup.mp3'),
};

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initAudio(): Promise<void> {
  if (_loaded) return;
  try {
    // Restore user preference
    const stored = await AsyncStorage.getItem(AUDIO_ENABLED_KEY);
    _enabled = stored === null ? true : stored === 'true';

    // setAudioModeAsync can SIGABRT on some Android versions — iOS only
    if (Platform.OS === 'ios') {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
      });
    }

    // Pre-load all sounds (ignore individually missing files)
    await Promise.all(
      Object.entries(SOUND_ASSETS).map(async ([key, asset]) => {
        try {
          const { sound } = await Audio.Sound.createAsync(asset, { shouldPlay: false, volume: 0.6 });
          _sounds[key] = sound;
        } catch {
          _sounds[key] = null; // file not added yet — silently skip
        }
      }),
    );
    _loaded = true;
  } catch (e) {
    console.warn('[audio] init failed:', e);
  }
}

// ── Playback ──────────────────────────────────────────────────────────────────

export async function playSound(key: keyof typeof _sounds): Promise<void> {
  if (!_enabled) return;
  if (!_loaded) await initAudio();
  try {
    let sound = _sounds[key];
    // If the native player was destroyed (app backgrounded etc.), recreate it
    if (!sound) {
      const asset = SOUND_ASSETS[key];
      if (!asset) return;
      const { sound: newSound } = await Audio.Sound.createAsync(asset, { shouldPlay: false, volume: 0.6 });
      _sounds[key] = newSound;
      sound = newSound;
    }
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // Player destroyed since last use — recreate and try once more
      try {
        await sound.unloadAsync();
      } catch {}
      _sounds[key] = null;
      const asset = SOUND_ASSETS[key];
      if (!asset) return;
      const { sound: freshSound } = await Audio.Sound.createAsync(
        asset, { shouldPlay: true, volume: 0.6 }
      );
      _sounds[key] = freshSound;
    }
  } catch (e) {
    console.warn('[audio] playSound error:', key, e);
  }
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export async function setAudioEnabled(enabled: boolean): Promise<void> {
  _enabled = enabled;
  await AsyncStorage.setItem(AUDIO_ENABLED_KEY, String(enabled));
}

export async function isAudioEnabled(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(AUDIO_ENABLED_KEY);
  return stored === null ? true : stored === 'true';
}

export function getAudioEnabledSync(): boolean {
  return _enabled;
}
