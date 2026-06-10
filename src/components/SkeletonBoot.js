import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from './uiAirbnb';

// Pulsing placeholder block — shared opacity loop driven by the parent.
function Bone({ width, height, radius = 12, style }) {
  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: palette.surfaceTint },
        style,
      ]}
    />
  );
}

/**
 * Branded loading skeleton shown while the app hydrates the session.
 * Mirrors the workspace layout (hero, stat tiles, list cards) so the real
 * screen appears to "fill in" rather than pop out of a spinner.
 */
export function SkeletonBoot() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.45, 1]),
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.content, pulseStyle]}>
        {/* Hero */}
        <Bone width={90} height={12} radius={6} />
        <Bone width={210} height={30} radius={10} />

        {/* Stat tiles */}
        <View style={styles.tileRow}>
          <Bone width="23%" height={76} radius={20} />
          <Bone width="23%" height={76} radius={20} />
          <Bone width="23%" height={76} radius={20} />
          <Bone width="23%" height={76} radius={20} />
        </View>

        {/* List cards */}
        <Bone width="100%" height={88} radius={24} />
        <Bone width="100%" height={88} radius={24} />
        <Bone width="100%" height={88} radius={24} />
      </Animated.View>

      {/* Bottom tab placeholder */}
      <Animated.View style={[styles.bottomBar, pulseStyle]}>
        <Bone width="100%" height={56} radius={24} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 72,
    gap: 16,
  },
  tileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
  },
  bottomBar: {
    paddingHorizontal: 18,
    paddingBottom: 34,
  },
});
