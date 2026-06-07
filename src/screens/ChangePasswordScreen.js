import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing as RNEasing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Banner, Field, PrimaryButton, palette, elevation } from '../components/uiAirbnb';
import { useToast } from '../components/ToastHost';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { spring as springTokens, haptic } from '../lib/motion';

function FloatingShape({ style, delay = 0, distance = 8, duration = 4400 }) {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: RNEasing.inOut(RNEasing.quad) }),
          withTiming(0, { duration, easing: RNEasing.inOut(RNEasing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(offset);
  }, [delay, duration, offset]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: '45deg' },
      { translateY: interpolate(offset.value, [0, 1], [0, -distance]) },
      { translateX: interpolate(offset.value, [0, 1], [0, distance / 2]) },
    ],
  }));
  return <Animated.View style={[style, animatedStyle]} pointerEvents="none" />;
}

const STRENGTH_LABELS = ['Too short', 'Weak', 'Okay', 'Strong', 'Excellent'];
const STRENGTH_COLORS = ['#E1E5EA', palette.danger, palette.warning, palette.accent, palette.success];

function StrengthSegment({ index, fill, color }) {
  const segStyle = useAnimatedStyle(() => {
    const active = fill.value > index;
    return {
      backgroundColor: active ? color : '#E8ECF1',
      opacity: active ? 1 : 0.6,
    };
  });
  return <Animated.View style={[styles.strengthSeg, segStyle]} />;
}

function StrengthMeter({ password }) {
  const score = scorePassword(password);
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withSpring(score, springTokens.gentle);
  }, [score, fill]);

  const color = STRENGTH_COLORS[Math.min(score, 4)];

  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBars}>
        {[0, 1, 2, 3].map((i) => (
          <StrengthSegment key={i} index={i} fill={fill} color={color} />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color }]}>
        {password ? STRENGTH_LABELS[Math.min(score, 4)] : ' '}
      </Text>
    </View>
  );
}

function scorePassword(pw) {
  if (!pw) return 0;
  if (pw.length < 8) return 0;
  let score = 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score += 1;
  return score;
}

export function ChangePasswordScreen({
  onChangePassword,
  isBusy = false,
  backendError = null,
  forced = false,
  onLogout,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverMessage, setServerMessage] = useState(null);
  const toast = useToast();

  const newPasswordRef = useRef(null);
  const confirmRef = useRef(null);

  // Card entrance
  const cardOpacity = useSharedValue(0);
  const cardTy = useSharedValue(20);
  useEffect(() => {
    cardOpacity.value = withTiming(1, { duration: 380 });
    cardTy.value = withSpring(0, springTokens.gentle);
  }, [cardOpacity, cardTy]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTy.value }],
  }));

  const action = useAsyncAction(async () => {
    const errors = {};
    if (!currentPassword) errors.currentPassword = 'Enter your current password.';
    if (!newPassword) errors.newPassword = 'Enter a new password.';
    else if (newPassword.length < 8) errors.newPassword = 'Min 8 characters.';
    if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      throw new Error('__validation__');
    }

    setFieldErrors({});
    setServerMessage(null);
    await onChangePassword(currentPassword, newPassword);
    haptic.success();
    toast.show({ tone: 'success', message: 'Password updated successfully.' });
  });

  const handleSubmit = async () => {
    try {
      await action.run();
    } catch (error) {
      if (error?.message === '__validation__') return;
      setServerMessage({ tone: 'danger', text: error.message });
    }
  };

  useAndroidBackHandler(() => {
    if (forced && onLogout) {
      onLogout();
      return true;
    }
    return false;
  });

  const submitting = action.isLoading || isBusy;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.hero}>
        <LinearGradient
          colors={['#1A1A2E', '#0B0E13', '#05050A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <FloatingShape style={[styles.heroShape, styles.heroShapeLeft]} delay={0} />
        <FloatingShape style={[styles.heroShape, styles.heroShapeRight]} delay={400} duration={5000} />
        <View style={styles.heroContent}>
          <Text style={styles.heroEyebrow}>{forced ? 'One last step' : 'Account security'}</Text>
          <Text style={styles.heroTitle}>{forced ? 'Set a new password' : 'Change password'}</Text>
          <Text style={styles.heroSubtitle}>
            {forced
              ? 'You are using a temporary password. Pick a new one to continue.'
              : 'Update the password on your account.'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          {serverMessage ? <Banner tone={serverMessage.tone} message={serverMessage.text} /> : null}
          {!serverMessage && backendError ? <Banner tone="danger" message={backendError} /> : null}

          <Field
            label="Current password"
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              if (fieldErrors.currentPassword) setFieldErrors((c) => ({ ...c, currentPassword: null }));
            }}
            placeholder="Temporary or current password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
            blurOnSubmit={false}
            error={fieldErrors.currentPassword}
          />

          <View style={styles.newPasswordBlock}>
            <Field
              ref={newPasswordRef}
              label="New password"
              value={newPassword}
              onChangeText={(value) => {
                setNewPassword(value);
                if (fieldErrors.newPassword) setFieldErrors((c) => ({ ...c, newPassword: null }));
              }}
              placeholder="Min 8 characters"
              secureTextEntry
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
              error={fieldErrors.newPassword}
            />
            <StrengthMeter password={newPassword} />
          </View>

          <Field
            ref={confirmRef}
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              if (fieldErrors.confirmPassword) setFieldErrors((c) => ({ ...c, confirmPassword: null }));
            }}
            placeholder="Type it again"
            secureTextEntry
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            blurOnSubmit
            error={fieldErrors.confirmPassword}
          />

          <PrimaryButton
            label="Update password"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
          />

          {onLogout && !forced ? (
            <Pressable
              onPress={onLogout}
              android_ripple={{ color: 'rgba(11,14,19,0.10)', borderless: true }}
              style={({ pressed }) => [styles.ghostLink, pressed && styles.ghostLinkPressed]}
            >
              <Text style={styles.ghostLinkText}>Log out instead</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  hero: {
    height: 240,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 58,
    paddingBottom: 36,
    justifyContent: 'flex-end',
  },
  heroShape: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroShapeLeft: { left: -32, top: 28 },
  heroShapeRight: { right: -36, top: 56 },
  heroContent: { gap: 8 },
  heroEyebrow: {
    color: '#D6FBF1',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: palette.white,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    lineHeight: 21,
  },
  sheet: {
    flex: 1,
    marginTop: -42,
    backgroundColor: palette.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },
  sheetContent: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 28,
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: palette.border,
    ...elevation.e2,
  },
  newPasswordBlock: { gap: 8 },
  strengthWrap: { gap: 6 },
  strengthBars: { flexDirection: 'row', gap: 6 },
  strengthSeg: {
    flex: 1,
    height: 5,
    borderRadius: 4,
    backgroundColor: '#E8ECF1',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghostLink: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  ghostLinkPressed: { opacity: 0.6 },
  ghostLinkText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
});
