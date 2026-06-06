import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { CountryCodePicker } from '../components/CountryCodePicker';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { spring as springTokens, haptic } from '../lib/motion';
const {
  buildPhoneValidationMessage,
  DEFAULT_DIAL_CODE,
  normalizePhoneForCountry,
} = require('../lib/countryPhone');

const MODES = {
  LOGIN: 'login',
  FORGOT_REQUEST: 'forgot-request',
  FORGOT_RESET: 'forgot-reset',
};

// Floating decorative shape with looped parallax
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

// Mode-content cross-fade — re-runs animation on mode change
function ModeFader({ mode, children }) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(10);

  useEffect(() => {
    opacity.value = 0;
    ty.value = 10;
    opacity.value = withTiming(1, { duration: 240 });
    ty.value = withSpring(0, springTokens.gentle);
  }, [mode, opacity, ty]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function AuthScreen({
  onLogin,
  onForgotPasswordRequestOtp,
  onForgotPasswordReset,
  isBusy = false,
  backendError = null,
  loginHint = null,
  onClearLoginHint = null,
}) {
  const [mode, setMode] = useState(MODES.LOGIN);
  const [phone, setPhone] = useState('');
  const [countryDialCode, setCountryDialCode] = useState(DEFAULT_DIAL_CODE);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverMessage, setServerMessage] = useState(null);

  const passwordRef = useRef(null);
  const otpRef = useRef(null);
  const newPasswordRef = useRef(null);

  // Logo entry
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);
  const cardTy = useSharedValue(24);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 420 });
    logoScale.value = withSpring(1, springTokens.bouncy);
    cardOpacity.value = withDelay(120, withTiming(1, { duration: 420 }));
    cardTy.value = withDelay(120, withSpring(0, springTokens.gentle));
  }, [logoOpacity, logoScale, cardOpacity, cardTy]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTy.value }],
  }));

  const resetForm = useCallback(() => {
    setPhone('');
    setCountryDialCode(DEFAULT_DIAL_CODE);
    setPassword('');
    setOtp('');
    setNewPassword('');
    setFieldErrors({});
    setServerMessage(null);
  }, []);

  const goToMode = useCallback((nextMode) => {
    setMode(nextMode);
    setFieldErrors({});
    setServerMessage(null);
    if (nextMode === MODES.LOGIN) {
      setOtp('');
      setNewPassword('');
    }
  }, []);

  useAndroidBackHandler(() => {
    if (mode === MODES.FORGOT_RESET) { goToMode(MODES.FORGOT_REQUEST); return true; }
    if (mode === MODES.FORGOT_REQUEST) { goToMode(MODES.LOGIN); return true; }
    return false;
  });

  const validatePhone = () => {
    const normalizedPhone = normalizePhoneForCountry(phone, countryDialCode);
    if (!normalizedPhone) {
      setFieldErrors((current) => ({ ...current, phone: buildPhoneValidationMessage(countryDialCode) }));
      return null;
    }
    setFieldErrors((current) => ({ ...current, phone: null }));
    return normalizedPhone;
  };

  const loginAction = useAsyncAction(async () => {
    const normalizedPhone = validatePhone();
    const errors = {};
    if (!normalizedPhone) errors.phone = buildPhoneValidationMessage(countryDialCode);
    if (!password) errors.password = 'Enter your password.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      throw new Error('__validation__');
    }
    setServerMessage(null);
    await onLogin(normalizedPhone, password);
    haptic.success();
  });

  const forgotRequestAction = useAsyncAction(async () => {
    const normalizedPhone = validatePhone();
    if (!normalizedPhone) {
      setFieldErrors({ phone: buildPhoneValidationMessage(countryDialCode) });
      throw new Error('__validation__');
    }
    setServerMessage(null);
    await onForgotPasswordRequestOtp(normalizedPhone);
    goToMode(MODES.FORGOT_RESET);
    setServerMessage({ tone: 'info', text: 'OTP sent. Enter the code and your new password below.' });
  });

  const forgotResetAction = useAsyncAction(async () => {
    const normalizedPhone = validatePhone();
    const errors = {};
    if (!normalizedPhone) errors.phone = buildPhoneValidationMessage(countryDialCode);
    if (!otp) errors.otp = 'Enter the OTP.';
    if (!newPassword) errors.newPassword = 'Enter a new password.';
    else if (newPassword.length < 8) errors.newPassword = 'Min 8 characters.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      throw new Error('__validation__');
    }
    setServerMessage(null);
    await onForgotPasswordReset(normalizedPhone, otp, newPassword);
    goToMode(MODES.LOGIN);
    setPassword('');
    setServerMessage({ tone: 'success', text: 'Password updated. Please log in.' });
    haptic.success();
  });

  const handleSubmit = async () => {
    try {
      if (mode === MODES.LOGIN) await loginAction.run();
      else if (mode === MODES.FORGOT_REQUEST) await forgotRequestAction.run();
      else await forgotResetAction.run();
    } catch (error) {
      if (error?.message === '__validation__') return;
      setServerMessage({ tone: 'danger', text: error.message });
    }
  };

  const submitting = loginAction.isLoading || forgotRequestAction.isLoading || forgotResetAction.isLoading;

  const title =
    mode === MODES.FORGOT_REQUEST ? 'Reset password'
    : mode === MODES.FORGOT_RESET ? 'Verify & reset'
    : `Welcome back`;

  const subtitle =
    mode === MODES.LOGIN
      ? 'Sign in with your phone number and password.'
      : mode === MODES.FORGOT_REQUEST
        ? `We'll send a one-time code via SMS.`
        : 'Enter the OTP and choose a new password.';

  const submitLabel =
    mode === MODES.LOGIN ? 'Log in' : mode === MODES.FORGOT_REQUEST ? 'Send OTP' : 'Update password';

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
        <FloatingShape style={[styles.heroShape, styles.heroShapeCenter]} delay={400} duration={5400} />
        <FloatingShape style={[styles.heroShape, styles.heroShapeRight]} delay={800} duration={4800} />
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.logoBadge, logoStyle]}>
          <LinearGradient
            colors={['#FFFFFF', '#F2FBF8']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.logoInner}>
            <Text style={styles.logoPrimary}>PAKKA</Text>
            <Text style={styles.logoSecondary}>RENT, SEALED.</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {loginHint ? <Banner tone="success" message={loginHint} onDismiss={onClearLoginHint} /> : null}
          {!loginHint && serverMessage ? <Banner tone={serverMessage.tone} message={serverMessage.text} /> : null}
          {!loginHint && !serverMessage && backendError ? <Banner tone="danger" message={backendError} /> : null}

          <ModeFader mode={mode}>
            <View style={styles.formBlock}>
              <CountryCodePicker
                dialCode={countryDialCode}
                onDialCodeChange={setCountryDialCode}
                phone={phone}
                onPhoneChange={(value) => {
                  setPhone(value);
                  if (fieldErrors.phone) setFieldErrors((c) => ({ ...c, phone: null }));
                }}
                placeholder="Mobile number"
              />
              {fieldErrors.phone ? <Text style={styles.fieldErrorText}>{fieldErrors.phone}</Text> : null}

              {mode === MODES.LOGIN ? (
                <Field
                  ref={passwordRef}
                  label="Password"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (fieldErrors.password) setFieldErrors((c) => ({ ...c, password: null }));
                  }}
                  placeholder="Your password"
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  blurOnSubmit
                  error={fieldErrors.password}
                />
              ) : null}
              {mode === MODES.FORGOT_RESET ? (
                <>
                  <Field
                    ref={otpRef}
                    label="OTP"
                    value={otp}
                    onChangeText={(value) => {
                      setOtp(value);
                      if (fieldErrors.otp) setFieldErrors((c) => ({ ...c, otp: null }));
                    }}
                    placeholder="6-digit code"
                    keyboardType="number-pad"
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    returnKeyType="next"
                    onSubmitEditing={() => newPasswordRef.current?.focus()}
                    blurOnSubmit={false}
                    error={fieldErrors.otp}
                  />
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
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit}
                    blurOnSubmit
                    error={fieldErrors.newPassword}
                  />
                </>
              ) : null}
            </View>
          </ModeFader>

          <PrimaryButton
            label={submitLabel}
            onPress={handleSubmit}
            loading={submitting || isBusy}
            disabled={submitting || isBusy}
          />

          {mode === MODES.LOGIN ? (
            <Pressable
              onPress={() => goToMode(MODES.FORGOT_REQUEST)}
              android_ripple={{ color: 'rgba(11,14,19,0.10)', borderless: true }}
              style={({ pressed }) => [styles.footerLinkWrap, pressed && styles.footerLinkPressed]}
            >
              <Text style={styles.footerText}>
                <Text style={styles.footerLinkText}>Forgot password?</Text>
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => goToMode(MODES.LOGIN)}
              android_ripple={{ color: 'rgba(11,14,19,0.10)', borderless: true }}
              style={({ pressed }) => [styles.footerLinkWrap, pressed && styles.footerLinkPressed]}
            >
              <Text style={styles.footerText}>
                <Text style={styles.footerLinkText}>← Back to login</Text>
              </Text>
            </Pressable>
          )}
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
  },
  heroShape: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroShapeLeft: { left: -36, top: 36 },
  heroShapeCenter: { left: 140, top: 0 },
  heroShapeRight: { right: -40, top: 60 },
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
    gap: 24,
  },
  logoBadge: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D8F1EA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...elevation.e2,
  },
  logoInner: { alignItems: 'center', gap: 2 },
  logoPrimary: { fontSize: 15, fontWeight: '900', color: '#024F45', letterSpacing: 1.0 },
  logoSecondary: { fontSize: 8, fontWeight: '800', color: '#3F8C7E', letterSpacing: 1.6 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 18,
    borderWidth: 1,
    borderColor: palette.border,
    ...elevation.e2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: palette.ink,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.muted,
    textAlign: 'center',
    marginTop: -8,
  },
  formBlock: { gap: 14 },
  fieldErrorText: {
    fontSize: 12,
    color: palette.danger,
    fontWeight: '700',
    marginTop: -8,
  },
  footerLinkWrap: { alignItems: 'center', paddingTop: 2, paddingVertical: 8 },
  footerLinkPressed: { opacity: 0.6 },
  footerText: { fontSize: 13, lineHeight: 18, color: palette.muted, textAlign: 'center' },
  footerLinkText: { color: palette.accentDeep, fontWeight: '800' },
});
