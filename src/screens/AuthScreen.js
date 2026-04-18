import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner, Field, palette } from '../components/uiAirbnb';

export function AuthScreen({ onLogin, isBusy = false, backendError = null, isDemoMode = false }) {
  const [role, setRole] = useState('tenant');
  const [phone, setPhone] = useState('9000000001');
  const [otp, setOtp] = useState('123456');
  const [step, setStep] = useState('request');
  const [message, setMessage] = useState(null);

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setPhone(nextRole === 'owner' ? '9000000000' : '9000000001');
    setOtp('123456');
    setStep('request');
    setMessage(null);
  };

  const handleRequestOtp = () => {
    if (phone.trim().length !== 10) {
      setMessage({ tone: 'danger', text: 'Enter a valid 10-digit mobile number to continue.' });
      return;
    }

    setStep('verify');
    setMessage({
      tone: 'info',
      text: 'Demo mode is on. Use OTP 123456 to continue.',
    });
  };

  const handleLogin = async () => {
    if (otp !== '123456') {
      setMessage({ tone: 'danger', text: 'Use OTP 123456 for this demo.' });
      return;
    }

    try {
      await onLogin(role, phone);
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const isOwner = role === 'owner';
  const title = step === 'verify' ? 'Verification' : isOwner ? 'Owner login' : 'Welcome to the app';
  const subtitle =
    step === 'verify'
      ? 'Enter the 6-digit code to continue.'
      : isOwner
        ? 'Log in to manage your property.'
        : 'Sign up to get started with your stay.';
  const buttonLabel =
    step === 'request' ? (isOwner ? 'Log in' : 'Sign up') : isBusy ? 'Please wait...' : 'Continue';

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
            {isDemoMode ? (
              <Banner
                tone="info"
                message="Public preview mode is on. Browse the product with demo logins, but edits are disabled here."
              />
            ) : null}
            {backendError ? <Banner tone="danger" message={backendError} /> : null}
            {isBusy ? <Banner tone="info" message="Connecting to your workspace..." /> : null}

            <View style={styles.formBlock}>
              <Field
                label="Mobile number"
                value={phone}
                onChangeText={setPhone}
                placeholder="10-digit phone number"
                keyboardType="phone-pad"
              />
              {step === 'verify' ? (
                <Field
                  label="OTP"
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="123456"
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

            <Pressable
              onPress={() => handleRoleChange(isOwner ? 'tenant' : 'owner')}
              style={({ pressed }) => [styles.ownerLinkWrap, pressed && styles.ownerLinkPressed]}
            >
              <Text style={styles.ownerText}>
                {isOwner ? 'Are you a tenant? ' : 'Are you a owner? '}
                <Text style={styles.ownerLinkText}>
                  {isOwner ? 'Sign up from here' : 'Log in from here'}
                </Text>
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
