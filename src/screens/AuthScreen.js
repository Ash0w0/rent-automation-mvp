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

export function AuthScreen({ onLogin, isBusy = false, backendError = null }) {
  const [role, setRole] = useState('tenant');
  const [phone, setPhone] = useState('');
  const [countryDialCode, setCountryDialCode] = useState(DEFAULT_DIAL_CODE);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null);

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setPhone('');
    setCountryDialCode(DEFAULT_DIAL_CODE);
    setPassword('');
    setMessage(null);
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

    if (!password) {
      setMessage({
        tone: 'danger',
        text: 'Enter your password or invite code.',
      });
      return;
    }

    try {
      await onLogin(role, normalizedPhone, password);
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const isOwner = role === 'owner';
  const title = isOwner ? 'Owner sign in' : 'Tenant sign in';
  const subtitle = isOwner ? 'Use your phone and password.' : 'Use the password shared by your owner.';
  const buttonLabel = isBusy ? 'Please wait...' : 'Log in';

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

            <View style={styles.roleTabs}>
              {['tenant', 'owner'].map((item) => {
                const active = role === item;

                return (
                  <Pressable
                    key={item}
                    onPress={() => handleRoleChange(item)}
                    style={({ pressed }) => [
                      styles.rolePill,
                      active && styles.rolePillActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>
                      {item === 'owner' ? 'Owner' : 'Tenant'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.formBlock}>
              <CountryCodePicker
                dialCode={countryDialCode}
                onDialCodeChange={setCountryDialCode}
                phone={phone}
                onPhoneChange={setPhone}
                placeholder="Mobile number"
              />
              <Field
                label="Password or invite code"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry
              />
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.primaryButton,
                isBusy && styles.primaryButtonDisabled,
                pressed && !isBusy && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export function PasswordSetupScreen({ onSetPassword, isBusy = false, backendError = null }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setMessage({ tone: 'danger', text: 'Use at least 6 characters.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ tone: 'danger', text: 'Passwords do not match.' });
      return;
    }

    try {
      await onSetPassword(password);
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

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
            <Text style={styles.title}>Create password</Text>
            <Text style={styles.subtitle}>This replaces your temporary invite code.</Text>

            {message ? <Banner tone={message.tone} message={message.text} /> : null}
            {backendError ? <Banner tone="danger" message={backendError} /> : null}
            {isBusy ? <Banner tone="info" message="Saving..." /> : null}

            <View style={styles.formBlock}>
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 characters"
                secureTextEntry
              />
              <Field
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat password"
                secureTextEntry
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.primaryButton,
                isBusy && styles.primaryButtonDisabled,
                pressed && !isBusy && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{isBusy ? 'Please wait...' : 'Save password'}</Text>
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
  roleTabs: {
    flexDirection: 'row',
    gap: 8,
    padding: 5,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
  },
  rolePill: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  rolePillActive: {
    backgroundColor: palette.accent,
  },
  roleText: {
    color: palette.inkSoft,
    fontWeight: '800',
  },
  roleTextActive: {
    color: palette.white,
  },
  formBlock: {
    gap: 14,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: '#24C9AE',
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.7,
  },
});
