import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner, Field, palette } from '../components/uiAirbnb';
import { CountryCodePicker } from '../components/CountryCodePicker';
const {
  buildPhoneValidationMessage,
  DEFAULT_DIAL_CODE,
  normalizePhoneForCountry,
} = require('../lib/countryPhone');

const RESEND_WAIT_SECONDS = 30;

function formatResendCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function maskPhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length < 8) {
    return 'your number';
  }

  return `${digits.slice(0, 2)}••••••${digits.slice(-2)}`;
}

export function AuthScreen({ onLogin, onRequestOtp, isBusy = false, backendError = null }) {
  const [role, setRole] = useState('tenant');
  const [phone, setPhone] = useState('');
  const [countryDialCode, setCountryDialCode] = useState(DEFAULT_DIAL_CODE);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('request');
  const [message, setMessage] = useState(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (step !== 'verify' || resendCountdown <= 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [step, resendCountdown]);

  const sendOtp = async (normalizedPhone) => {
    await onRequestOtp(role, normalizedPhone);
    setStep('verify');
    setPhone(normalizedPhone);
    setResendCountdown(RESEND_WAIT_SECONDS);
    setMessage({
      tone: 'info',
      text: 'OTP sent.',
    });
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setPhone('');
    setCountryDialCode(DEFAULT_DIAL_CODE);
    setOtp('');
    setStep('request');
    setMessage(null);
    setResendCountdown(0);
  };

  const handleRequestOtp = async () => {
    const normalizedPhone = normalizePhoneForCountry(phone, countryDialCode);
    if (!normalizedPhone) {
      setMessage({
        tone: 'danger',
        text: buildPhoneValidationMessage(countryDialCode),
      });
      return;
    }

    try {
      await sendOtp(normalizedPhone);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const handleResendOtp = async () => {
    const normalizedPhone = normalizePhoneForCountry(phone, countryDialCode);
    if (!normalizedPhone) {
      setMessage({
        tone: 'danger',
        text: buildPhoneValidationMessage(countryDialCode),
      });
      return;
    }

    try {
      await sendOtp(normalizedPhone);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const handleLogin = async () => {
    const normalizedPhone = normalizePhoneForCountry(phone, countryDialCode);
    if (!normalizedPhone) {
      setMessage({
        tone: 'danger',
        text: buildPhoneValidationMessage(countryDialCode),
      });
      return;
    }

    try {
      await onLogin(role, normalizedPhone, otp);
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const isOwner = role === 'owner';
  const title = step === 'verify' ? 'Verify OTP' : isOwner ? 'Owner sign in' : 'Tenant sign in';
  const subtitle =
    step === 'verify'
      ? `Code sent to ${maskPhoneNumber(phone)}.`
      : isOwner
        ? 'Manage your property.'
        : 'Use your invited number.';
  const buttonLabel = step === 'request' ? 'Send OTP' : isBusy ? 'Please wait...' : 'Verify';
  const resendCountdownLabel = formatResendCountdown(resendCountdown);

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
              {step === 'verify' ? (
                <Field
                  label="OTP"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6-digit OTP"
                  keyboardType="numeric"
                />
              ) : null}
            </View>

            <Pressable
              onPress={step === 'request' ? handleRequestOtp : handleLogin}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.primaryButton,
                isBusy && styles.primaryButtonDisabled,
                pressed && !isBusy && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
              <Text style={styles.primaryButtonArrow}>{'>>'}</Text>
            </Pressable>

            {step === 'verify' ? (
              <Pressable
                onPress={() => {
                  setStep('request');
                  setOtp('');
                  setMessage(null);
                  setResendCountdown(0);
                }}
                style={({ pressed }) => [styles.ownerLinkWrap, pressed && styles.ownerLinkPressed]}
              >
                <Text style={styles.ownerText}>
                  Wrong number? <Text style={styles.ownerLinkText}>Change</Text>
                </Text>
              </Pressable>
            ) : null}

            {step === 'verify' ? (
              resendCountdown > 0 ? (
                <View style={styles.ownerLinkWrap}>
                  <Text style={styles.ownerText}>Resend in {resendCountdownLabel}</Text>
                </View>
              ) : (
                <Pressable
                  onPress={handleResendOtp}
                  disabled={isBusy}
                  style={({ pressed }) => [
                    styles.ownerLinkWrap,
                    isBusy && styles.ownerLinkDisabled,
                    pressed && !isBusy && styles.ownerLinkPressed,
                  ]}
                >
                  <Text style={styles.ownerText}>
                    <Text style={styles.ownerLinkText}>Resend OTP</Text>
                  </Text>
                </Pressable>
              )
            ) : null}

            <Pressable
              onPress={() => handleRoleChange(isOwner ? 'tenant' : 'owner')}
              style={({ pressed }) => [styles.ownerLinkWrap, pressed && styles.ownerLinkPressed]}
            >
              <Text style={styles.ownerText}>
                <Text style={styles.ownerLinkText}>{isOwner ? 'Switch to tenant' : 'Switch to owner'}</Text>
              </Text>
            </Pressable>
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
  heroShapeLeft: {
    left: -12,
    top: 40,
  },
  heroShapeCenter: {
    left: 150,
    top: 22,
  },
  heroShapeRight: {
    right: -18,
    top: 52,
  },
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
  logoInner: {
    alignItems: 'center',
    gap: 2,
  },
  logoPrimary: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D4C4A',
    letterSpacing: 0.8,
  },
  logoSecondary: {
    fontSize: 8,
    fontWeight: '700',
    color: '#63A39E',
    letterSpacing: 1.4,
  },
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
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#2E3138',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#9097A3',
    textAlign: 'center',
    marginTop: -4,
  },
  formBlock: {
    gap: 14,
  },
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
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.988 }],
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  primaryButtonArrow: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
    color: '#DFFBF6',
    marginTop: -2,
  },
  ownerLinkWrap: {
    alignItems: 'center',
    paddingTop: 2,
  },
  ownerLinkPressed: {
    opacity: 0.7,
  },
  ownerLinkDisabled: {
    opacity: 0.55,
  },
  ownerText: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.muted,
    textAlign: 'center',
  },
  ownerLinkText: {
    color: '#24C9AE',
    fontWeight: '700',
  },
});
