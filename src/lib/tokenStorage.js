import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'rent-automation-access-token';
const REFRESH_KEY = 'rent-automation-refresh-token';

// Memory fallback for Web or environments where SecureStore fails
let memoryTokens = {
  accessToken: null,
  refreshToken: null,
};

async function readSecureValue(key) {
  try {
    // Check if we are in a native environment where SecureStore works
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      return await SecureStore.getItemAsync(key);
    }
  } catch (e) {
    // Fallback to memory if SecureStore is missing or fails
  }

  return memoryTokens[key === ACCESS_KEY ? 'accessToken' : 'refreshToken'];
}

async function writeSecureValue(key, value) {
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

  if (key === ACCESS_KEY) {
    memoryTokens.accessToken = value;
  } else {
    memoryTokens.refreshToken = value;
  }
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
