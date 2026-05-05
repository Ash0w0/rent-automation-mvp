import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { palette } from './uiAirbnb';

const ToastContext = createContext({
  show: () => {},
  hide: () => {},
});

const DEFAULT_DURATION = 3000;

/**
 * Mount near the root of the app (inside SafeAreaView). Children call
 * `useToast().show({tone, message})`. Material-Snackbar style: bottom-center,
 * single line preferred, auto-dismiss in 3s.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(40)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(translate, { toValue: 40, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start(() => setToast(null));
  }, [opacity, translate]);

  const show = useCallback(
    (next) => {
      if (!next || !next.message) return;
      setToast({ tone: next.tone || 'info', message: next.message });
      if (timer.current) clearTimeout(timer.current);
      opacity.setValue(0);
      translate.setValue(40);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(translate, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      ]).start();
      timer.current = setTimeout(hide, next.duration || DEFAULT_DURATION);
    },
    [opacity, translate, hide],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={styles.viewport}>
          <Animated.View
            style={[
              styles.snackbar,
              toast.tone === 'danger' && styles.snackbarDanger,
              toast.tone === 'success' && styles.snackbarSuccess,
              { opacity, transform: [{ translateY: translate }] },
            ]}
          >
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'android' ? 96 : 110,
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  snackbar: {
    maxWidth: 460,
    width: '100%',
    backgroundColor: '#1F2733',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  snackbarDanger: {
    backgroundColor: palette.danger,
  },
  snackbarSuccess: {
    backgroundColor: palette.success,
  },
  message: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },
});
