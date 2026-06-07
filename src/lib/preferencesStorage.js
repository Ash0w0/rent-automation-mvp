import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PREFS_KEY = 'rent-automation-preferences';

let memoryPrefs = null;

function canUseLocalStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && Boolean(window.localStorage);
}

async function readRaw() {
  if (canUseLocalStorage()) {
    return window.localStorage.getItem(PREFS_KEY);
  }
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      return await SecureStore.getItemAsync(PREFS_KEY);
    }
  } catch (_e) {}
  return memoryPrefs;
}

async function writeRaw(value) {
  if (canUseLocalStorage()) {
    if (value === null) { window.localStorage.removeItem(PREFS_KEY); }
    else { window.localStorage.setItem(PREFS_KEY, value); }
    return;
  }
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      if (value === null) { await SecureStore.deleteItemAsync(PREFS_KEY); }
      else { await SecureStore.setItemAsync(PREFS_KEY, value); }
      return;
    }
  } catch (_e) {}
  memoryPrefs = value;
}

export async function loadPreferences() {
  try {
    const raw = await readRaw();
    if (raw) return JSON.parse(raw);
  } catch (_e) {}
  return null;
}

export async function savePreferences(prefs) {
  try {
    await writeRaw(JSON.stringify(prefs));
  } catch (_e) {}
}
