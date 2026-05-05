import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Registers a hardware-back handler on Android. Return `true` from the handler
 * to consume the press; return `false` to let the default behavior happen
 * (which usually closes the app).
 *
 * `enabled` lets a screen toggle the handler without unmounting.
 */
export function useAndroidBackHandler(handler, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled || typeof handler !== 'function') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      try {
        return Boolean(handler());
      } catch (_error) {
        return false;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handler, enabled]);
}
