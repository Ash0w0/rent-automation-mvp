import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner, Field, palette } from '../components/uiAirbnb';
import { CountryCodePicker } from '../components/CountryCodePicker';
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

export function AuthScreen({
  onLogin,
  onForgotPasswordRequestOtp,
  onForgotPasswordReset,
  isBusy = false,
  backendError = null,
}) {
  const [role, setRole] = useState('tenant');
  const [mode, setMode] = useState('login'); // login | forgot-request | forgot-reset
  const [phone, setPhone] = useState('');
  const [countryDialCode, setCountryDialCode] = useState(DEFAULT_DIAL_CODE);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(null);

  const resetForm = () => {
    setPhone('');
    setCountryDialCode(DEFAULT_DIAL_CODE);
    setPassword('');
    setOtp('');
    setNewPassword('');
    setMessage(null);
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setMode('login');
    resetForm();
  };

  const requireValidPhone = () => {
    const normalizedPhone = normalizePhoneForCountry(phone, countryDialCode);
    if (!normalizedPhone) {
      setMessage({ tone: 'danger', text: buildPhoneValidationMessage(countryDialCode) });
      return null;
    }
    return normalizedPhone;
  };

  const handleLogin = async () => {
    const normalizedPhone = requireValidPhone();
    if (!normalizedPhone) return;
    if (!password) {
      setMessage({ tone: 'danger', text: 'Enter your password.' });
      return;
    }

    try {
      await onLogin(role, normalizedPhone, password);
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const handleForgotRequest = async () => {
    const normalizedPhone = requireValidPhone();
    if (!normalizedPhone) return;

    try {
      await onForgotPasswordRequestOtp(role, normalizedPhone);
      setMode('forgot-reset');
      setMessage({ tone: 'info', text: 'OTP sent. Enter the code and your new password below.' });
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const handleForgotReset = async () => {
    const normalizedPhone = requireValidPhone();
    if (!normalizedPhone) return;
    if (!otp || !newPassword) {
      setMessage({ tone: 'danger', text: 'Enter the OTP and a new password (min 8 chars).' });
      return;
    }

    try {
      await onForgotPasswordReset(role, normalizedPhone, otp, newPassword);
      setMode('login');
      setOtp('');
      setNewPassword('');
      setPassword('');
      setMessage({ tone: 'info', text: 'Password updated. Please log in.' });
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const isTenant = role === 'tenant';
  const title =
    mode === 'forgot-request'
      ? 'Reset password'
      : mode === 'forgot-reset'
        ? 'Enter OTP & new password'
        : `${role === 'super_admin' ? 'Super admin' : role === 'owner' ? 'Owner' : 'Tenant'} sign in`;
  const subtitle =
    mode === 'login'
      ? 'Use phone and password.'
      : mode === 'forgot-request'
        ? 'We will send you a code via SMS.'
        : 'Check your phone for the OTP.';

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

            {message ? <Banner tone={message.tone} message={message.text} /> : null}
            {backendError ? <Banner tone="danger" message={backendError} /> : null}
            {isBusy ? <Banner tone="info" message="Connecting..." /> : null}

            <View style={styles.formBlock}>
              <CountryCodePicker
                dialCode={countryDialCode}
                onDialCodeChange={setCountryDialCode}
                phone={phone}
                onPhoneChange={setPhone}
                placeholder="Enter mobile number"
              />
              {mode === 'login' ? (
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  secureTextEntry
                />
              ) : null}
              {mode === 'forgot-reset' ? (
                <>
                  <Field
                    label="OTP"
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="6-digit OTP"
                    keyboardType="numeric"
                  />
                  <Field
                    label="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Min 8 characters"
                    secureTextEntry
                  />
                </>
              ) : null}
            </View>

            <Pressable
              onPress={
                mode === 'login'
                  ? handleLogin
                  : mode === 'forgot-request'
                    ? handleForgotRequest
                    : handleForgotReset
              }
              disabled={isBusy}
              style={({ pressed }) => [
                styles.primaryButton,
                isBusy && styles.primaryButtonDisabled,
                pressed && !isBusy && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {mode === 'login'
                  ? isBusy
                    ? 'Please wait...'
                    : 'Log in'
                  : mode === 'forgot-request'
                    ? 'Send OTP'
                    : 'Update password'}
              </Text>
              <Text style={styles.primaryButtonArrow}>{'>>'}</Text>
            </Pressable>

            {mode === 'login' ? (
              isTenant ? (
                <View style={styles.ownerLinkWrap}>
                  <Text style={styles.ownerText}>
                    Forgot password? <Text style={styles.ownerLinkText}>Ask your owner to reset it.</Text>
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setMode('forgot-request');
                    setMessage(null);
                  }}
                  style={({ pressed }) => [styles.ownerLinkWrap, pressed && styles.ownerLinkPressed]}
                >
                  <Text style={styles.ownerText}>
                    <Text style={styles.ownerLinkText}>Forgot password?</Text>
                  </Text>
                </Pressable>
              )
            ) : (
              <Pressable
                onPress={() => {
                  setMode('login');
                  setMessage(null);
                }}
                style={({ pressed }) => [styles.ownerLinkWrap, pressed && styles.ownerLinkPressed]}
              >
                <Text style={styles.ownerText}>
                  <Text style={styles.ownerLinkText}>Back to login</Text>
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
    maxWidth: 460,
    alignSelf: 'center',
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F1F5F4',
    alignItems: 'center',
  },
  rolePillActive: { backgroundColor: '#24C9AE' },
  rolePillPressed: { opacity: 0.85 },
  rolePillText: { fontSize: 13, fontWeight: '700', color: '#5C6470' },
  rolePillTextActive: { color: '#FFFFFF' },
  formBlock: { gap: 14 },
  primaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: '#24C9AE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonPressed: { transform: [{ scale: 0.988 }] },
  primaryButtonText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  primaryButtonArrow: { fontSize: 22, lineHeight: 22, fontWeight: '700', color: '#DFFBF6', marginTop: -2 },
  ownerLinkWrap: { alignItems: 'center', paddingTop: 2 },
  ownerLinkPressed: { opacity: 0.7 },
  ownerText: { fontSize: 12, lineHeight: 18, color: palette.muted, textAlign: 'center' },
  ownerLinkText: { color: '#24C9AE', fontWeight: '700' },
});
