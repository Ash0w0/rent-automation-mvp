import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'rent-automation-access-token';
const REFRESH_KEY = 'rent-automation-refresh-token';

// Memory fallback for Web or environments where SecureStore fails
let memoryTokens = {
  accessToken: null,
  refreshToken: null,
};

function canUseLocalStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && Boolean(window.localStorage);
}

function getMemoryKey(key) {
  return key === ACCESS_KEY ? 'accessToken' : 'refreshToken';
}

async function readSecureValue(key) {
  if (canUseLocalStorage()) {
    return window.localStorage.getItem(key);
  }

  try {
    // Check if we are in a native environment where SecureStore works
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      return await SecureStore.getItemAsync(key);
    }
  } catch (e) {
    // Fallback to memory if SecureStore is missing or fails
  }

  return memoryTokens[getMemoryKey(key)];
}

async function writeSecureValue(key, value) {
  if (canUseLocalStorage()) {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    return;
  }

  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      if (value === null) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      return;
    }
  } catch (e) {
    // Fallback to memory
  }

  memoryTokens[getMemoryKey(key)] = value;
}

export async function getStoredTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    readSecureValue(ACCESS_KEY),
    readSecureValue(REFRESH_KEY),
  ]);

  return {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
  };
}

export async function setStoredTokens(tokens) {
  await Promise.all([
    writeSecureValue(ACCESS_KEY, tokens?.accessToken || null),
    writeSecureValue(REFRESH_KEY, tokens?.refreshToken || null),
  ]);
}
