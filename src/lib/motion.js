// Motion design tokens — shared animation timings, springs, and curves.
// Use these to keep transitions consistent across screens.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const timing = {
  fast: 160,
  base: 240,
  slow: 360,
  page: 420,
};

// Reanimated spring configs (mass/damping/stiffness)
export const spring = {
  // Snappy press response — buttons, chips
  press: { mass: 0.6, damping: 18, stiffness: 320 },
  // Gentle entrance — cards sliding in
  gentle: { mass: 1, damping: 22, stiffness: 180 },
  // Bouncy attention — success states, focus pings
  bouncy: { mass: 0.9, damping: 12, stiffness: 240 },
  // Smooth pill indicator slide
  indicator: { mass: 0.8, damping: 20, stiffness: 260 },
};

// Easing presets (use with reanimated `withTiming`)
export const easing = {
  // CRED-style: very gentle decel
  out: [0.22, 1, 0.36, 1],
  // Material standard
  standard: [0.4, 0, 0.2, 1],
  // Sharp accel/decel
  emphasized: [0.2, 0, 0, 1],
};

// Lightweight haptics wrapper — no-op on web
export const haptic = {
  selection() {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  },
  light() {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium() {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  success() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  error() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};

// Stagger delay helper — for list entrance animations
export const staggerDelay = (index, base = 60) => Math.min(index * base, 320);
