import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner, Field, PrimaryButton, palette } from '../components/uiAirbnb';
import { CountryCodePicker } from '../components/CountryCodePicker';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
const {
  buildPhoneValidationMessage,
  DEFAULT_DIAL_CODE,
  normalizePhoneForCountry,
} = require('../lib/countryPhone');

const ROLES = [
  { key: 'tenant', label: 'Tenant' },
  { key: 'owner', label: 'Owner' },
  { key: 'super_admin', label: 'Super Admin' },
];

const MODES = {
  LOGIN: 'login',
  FORGOT_REQUEST: 'forgot-request',
  FORGOT_RESET: 'forgot-reset',
};

export function AuthScreen({
  onLogin,
  onForgotPasswordRequestOtp,
  onForgotPasswordReset,
  isBusy = false,
  backendError = null,
}) {
  const [role, setRole] = useState('tenant');
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

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setMode(MODES.LOGIN);
    resetForm();
  };

  // Hardware back: forgot-reset → forgot-request → login → default exit
  useAndroidBackHandler(() => {
    if (mode === MODES.FORGOT_RESET) {
      goToMode(MODES.FORGOT_REQUEST);
      return true;
    }
    if (mode === MODES.FORGOT_REQUEST) {
      goToMode(MODES.LOGIN);
      return true;
    }
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
    await onLogin(role, normalizedPhone, password);
  });

  const forgotRequestAction = useAsyncAction(async () => {
    const normalizedPhone = validatePhone();
    if (!normalizedPhone) {
      setFieldErrors({ phone: buildPhoneValidationMessage(countryDialCode) });
      throw new Error('__validation__');
    }
    setServerMessage(null);
    await onForgotPasswordRequestOtp(role, normalizedPhone);
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
    await onForgotPasswordReset(role, normalizedPhone, otp, newPassword);
    goToMode(MODES.LOGIN);
    setPassword('');
    setServerMessage({ tone: 'info', text: 'Password updated. Please log in.' });
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

  const isTenant = role === 'tenant';
  const submitting = loginAction.isLoading || forgotRequestAction.isLoading || forgotResetAction.isLoading;

  const title =
    mode === MODES.FORGOT_REQUEST
      ? 'Reset password'
      : mode === MODES.FORGOT_RESET
        ? 'Enter OTP & new password'
        : `${role === 'super_admin' ? 'Super admin' : role === 'owner' ? 'Owner' : 'Tenant'} sign in`;

  const subtitle =
    mode === MODES.LOGIN
      ? 'Use phone and password.'
      : mode === MODES.FORGOT_REQUEST
        ? 'We will send you a code via SMS.'
        : 'Check your phone for the OTP.';

  const submitLabel =
    mode === MODES.LOGIN ? 'Log in' : mode === MODES.FORGOT_REQUEST ? 'Send OTP' : 'Update password';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.mobileShell}>
        <View style={styles.hero}>
          <View style={[styles.heroShape, styles.heroShapeLeft]} />
          <View style={[styles.heroShape, styles.heroShapeCenter]} />
          <View style={[styles.heroShape, styles.heroShapeRight]} />
        </View>

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoBadge}>
            <View style={styles.logoInner}>
              <Text style={styles.logoPrimary}>RENT</Text>
              <Text style={styles.logoSecondary}>AUTOMATION</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.roleRow}>
              {ROLES.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => handleRoleChange(option.key)}
                  android_ripple={{ color: 'rgba(255,255,255,0.22)', borderless: false }}
                  style={({ pressed }) => [
                    styles.rolePill,
                    role === option.key && styles.rolePillActive,
                    pressed && styles.rolePillPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      role === option.key && styles.rolePillTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {serverMessage ? <Banner tone={serverMessage.tone} message={serverMessage.text} /> : null}
            {!serverMessage && backendError ? <Banner tone="danger" message={backendError} /> : null}

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
                    placeholder="6-digit OTP"
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

            <PrimaryButton
              label={submitLabel}
              onPress={handleSubmit}
              loading={submitting || isBusy}
              disabled={submitting || isBusy}
            />

            {mode === MODES.LOGIN ? (
              isTenant ? (
                <View style={styles.footerLinkWrap}>
                  <Text style={styles.footerText}>
                    Forgot password? <Text style={styles.footerLinkText}>Ask your owner to reset it.</Text>
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => goToMode(MODES.FORGOT_REQUEST)}
                  android_ripple={{ color: 'rgba(36,201,174,0.2)', borderless: true }}
                  style={({ pressed }) => [styles.footerLinkWrap, pressed && styles.footerLinkPressed]}
                >
                  <Text style={styles.footerText}>
                    <Text style={styles.footerLinkText}>Forgot password?</Text>
                  </Text>
                </Pressable>
              )
            ) : (
              <Pressable
                onPress={() => goToMode(MODES.LOGIN)}
                android_ripple={{ color: 'rgba(36,201,174,0.2)', borderless: true }}
                style={({ pressed }) => [styles.footerLinkWrap, pressed && styles.footerLinkPressed]}
              >
                <Text style={styles.footerText}>
                  <Text style={styles.footerLinkText}>Back to login</Text>
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#DDE9E6',
  },
  mobileShell: {
    flex: 1,
    width: '100%',
    backgroundColor: '#24C9AE',
  },
  hero: {
    height: 210,
    backgroundColor: '#24C9AE',
    overflow: 'hidden',
  },
  heroShape: {
    position: 'absolute',
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '45deg' }],
  },
  heroShapeLeft: { left: -12, top: 40 },
  heroShapeCenter: { left: 150, top: 22 },
  heroShapeRight: { right: -18, top: 52 },
  sheet: {
    flex: 1,
    marginTop: -34,
    backgroundColor: '#EEF4F3',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  sheetContent: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 40,
    gap: 24,
  },
  logoBadge: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#C8F3EC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  logoInner: { alignItems: 'center', gap: 2 },
  logoPrimary: { fontSize: 15, fontWeight: '800', color: '#1D4C4A', letterSpacing: 0.8 },
  logoSecondary: { fontSize: 8, fontWeight: '700', color: '#63A39E', letterSpacing: 1.4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 18,
    shadowColor: '#214A47',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#2E3138',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#9097A3',
    textAlign: 'center',
    marginTop: -4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  rolePill: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F1F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rolePillActive: { backgroundColor: '#24C9AE' },
  rolePillPressed: { opacity: 0.9 },
  rolePillText: { fontSize: 13, fontWeight: '700', color: '#5C6470' },
  rolePillTextActive: { color: '#FFFFFF' },
  formBlock: { gap: 14 },
  fieldErrorText: {
    fontSize: 12,
    color: palette.danger,
    fontWeight: '700',
    marginTop: -8,
  },
  footerLinkWrap: { alignItems: 'center', paddingTop: 2, paddingVertical: 8 },
  footerLinkPressed: { opacity: 0.7 },
  footerText: { fontSize: 13, lineHeight: 18, color: palette.muted, textAlign: 'center' },
  footerLinkText: { color: '#24C9AE', fontWeight: '700' },
});
