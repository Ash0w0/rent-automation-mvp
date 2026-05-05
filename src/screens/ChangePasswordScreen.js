import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner, Field, PrimaryButton, palette } from '../components/uiAirbnb';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useAsyncAction } from '../hooks/useAsyncAction';

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

  const newPasswordRef = useRef(null);
  const confirmRef = useRef(null);

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
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setServerMessage({ tone: 'info', text: 'Password updated.' });
  });

  const handleSubmit = async () => {
    try {
      await action.run();
    } catch (error) {
      if (error?.message === '__validation__') return;
      setServerMessage({ tone: 'danger', text: error.message });
    }
  };

  // Hardware back: when forced, pressing back logs out (otherwise pressing back exits the app).
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
      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>{forced ? 'Set a new password' : 'Change password'}</Text>
          <Text style={styles.subtitle}>
            {forced
              ? 'You are using a temporary password. Please set a new one to continue.'
              : 'Update the password on your account.'}
          </Text>

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

          {onLogout ? (
            <PrimaryButton label="Log out" tone="ghost" onPress={onLogout} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.backgroundWarm || '#EEF4F3' },
  content: {
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 40,
    gap: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    gap: 14,
    shadowColor: '#214A47',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2733' },
  subtitle: { fontSize: 14, color: palette.muted, lineHeight: 20 },
});
