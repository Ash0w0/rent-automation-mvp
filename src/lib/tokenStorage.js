const { Platform } = require('react-native');

let SecureStore = null;
try {
  SecureStore = require('expo-secure-store');
} catch (_error) {
  SecureStore = null;
}

const ACCESS_KEY = 'rent-automation-access-token';
const REFRESH_KEY = 'rent-automation-refresh-token';

let memoryTokens = {
  accessToken: null,
  refreshToken: null,
};

function canUseWebStorage() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage;
}

async function readSecureValue(key) {
  if (canUseWebStorage()) {
    return window.localStorage.getItem(key);
  }

  if (SecureStore?.getItemAsync) {
    return SecureStore.getItemAsync(key);
  }

  return memoryTokens[key === ACCESS_KEY ? 'accessToken' : 'refreshToken'];
}

async function writeSecureValue(key, value) {
  if (canUseWebStorage()) {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    return;
  }

  if (SecureStore?.setItemAsync && SecureStore?.deleteItemAsync) {
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
    return;
  }

  if (key === ACCESS_KEY) {
    memoryTokens.accessToken = value;
  } else {
    memoryTokens.refreshToken = value;
  }
}

async function getStoredTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    readSecureValue(ACCESS_KEY),
    readSecureValue(REFRESH_KEY),
  ]);

  return {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
  };
}

async function setStoredTokens(tokens) {
  await Promise.all([
    writeSecureValue(ACCESS_KEY, tokens?.accessToken || null),
    writeSecureValue(REFRESH_KEY, tokens?.refreshToken || null),
  ]);
}

module.exports = {
  getStoredTokens,
  setStoredTokens,
};
