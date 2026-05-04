import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner, Field, palette } from '../components/uiAirbnb';

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
  const [message, setMessage] = useState(null);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword) {
      setMessage({ tone: 'danger', text: 'Enter your current and new password.' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ tone: 'danger', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: 'danger', text: 'New password and confirmation do not match.' });
      return;
    }

    try {
      await onChangePassword(currentPassword, newPassword);
      setMessage({ tone: 'info', text: 'Password updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{forced ? 'Set a new password' : 'Change password'}</Text>
          <Text style={styles.subtitle}>
            {forced
              ? 'You are using a temporary password. Please set a new one to continue.'
              : 'Update the password on your account.'}
          </Text>

          {message ? <Banner tone={message.tone} message={message.text} /> : null}
          {backendError ? <Banner tone="danger" message={backendError} /> : null}

          <Field
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Temporary or current password"
            secureTextEntry
          />
          <Field
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Min 8 characters"
            secureTextEntry
          />
          <Field
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Type it again"
            secureTextEntry
          />

          <Pressable
            onPress={handleSubmit}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.primaryButton,
              isBusy && styles.primaryButtonDisabled,
              pressed && !isBusy && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isBusy ? 'Saving...' : 'Update password'}
            </Text>
          </Pressable>

          {onLogout ? (
            <Pressable
              onPress={onLogout}
              style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
            >
              <Text style={styles.secondaryText}>Log out</Text>
            </Pressable>
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
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: '#24C9AE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonPressed: { transform: [{ scale: 0.988 }] },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryPressed: { opacity: 0.7 },
  secondaryText: { color: palette.muted, fontWeight: '600', fontSize: 13 },
});
