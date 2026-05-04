import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Banner, Field, palette } from '../components/uiAirbnb';
import { CountryCodePicker } from '../components/CountryCodePicker';
import { TempPasswordShareModal } from '../components/TempPasswordShareModal';
const {
  buildPhoneValidationMessage,
  DEFAULT_DIAL_CODE,
  normalizePhoneForCountry,
} = require('../lib/countryPhone');

export function SuperAdminWorkspace({ state, actions, onLogout }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryDialCode, setCountryDialCode] = useState(DEFAULT_DIAL_CODE);
  const [message, setMessage] = useState(null);
  const [shareDetails, setShareDetails] = useState(null);

  const owners = state.owners || [];

  const handleInvite = async () => {
    const normalizedPhone = normalizePhoneForCountry(phone, countryDialCode);
    if (!name) {
      setMessage({ tone: 'danger', text: 'Owner name is required.' });
      return;
    }
    if (!normalizedPhone) {
      setMessage({ tone: 'danger', text: buildPhoneValidationMessage(countryDialCode) });
      return;
    }

    try {
      const result = await actions.inviteOwner({ name, phone: normalizedPhone });
      setName('');
      setPhone('');
      setMessage({ tone: 'info', text: `${result.owner.name} was invited.` });
      setShareDetails({
        tempPassword: result.tempPassword,
        recipientName: result.owner.name,
        recipientPhone: result.owner.phone,
        role: 'owner',
      });
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  const handleResetPassword = async (owner) => {
    try {
      const result = await actions.resetOwnerPassword(owner.id);
      setShareDetails({
        tempPassword: result.tempPassword,
        recipientName: result.owner.name,
        recipientPhone: result.owner.phone,
        role: 'owner',
      });
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Super Admin</Text>
          <Pressable onPress={onLogout} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        {message ? <Banner tone={message.tone} message={message.text} /> : null}
        {state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Invite owner</Text>
          <Field label="Owner name" value={name} onChangeText={setName} placeholder="Full name" />
          <CountryCodePicker
            dialCode={countryDialCode}
            onDialCodeChange={setCountryDialCode}
            phone={phone}
            onPhoneChange={setPhone}
            placeholder="Mobile number"
          />
          <Pressable
            onPress={handleInvite}
            disabled={state.isSyncing}
            style={({ pressed }) => [
              styles.primary,
              state.isSyncing && styles.primaryDisabled,
              pressed && !state.isSyncing && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>{state.isSyncing ? 'Inviting...' : 'Invite owner'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Owners</Text>
          {owners.length === 0 ? (
            <Text style={styles.empty}>No owners invited yet.</Text>
          ) : (
            owners.map((owner) => (
              <View key={owner.id} style={styles.ownerRow}>
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{owner.name}</Text>
                  <Text style={styles.ownerPhone}>{owner.phone}</Text>
                  {owner.mustChangePassword ? (
                    <Text style={styles.ownerFlag}>Pending first-login change</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleResetPassword(owner)}
                  style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
                >
                  <Text style={styles.resetText}>Reset password</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TempPasswordShareModal
        visible={Boolean(shareDetails)}
        onDismiss={() => setShareDetails(null)}
        tempPassword={shareDetails?.tempPassword}
        recipientName={shareDetails?.recipientName}
        recipientPhone={shareDetails?.recipientPhone}
        role={shareDetails?.role}
        inviterName="Super Admin"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.backgroundWarm || '#EEF4F3' },
  content: { padding: 22, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: '#1F2733' },
  logout: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#1F2733' },
  logoutText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#214A47',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1F2733' },
  primary: {
    backgroundColor: '#24C9AE',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  pressed: { opacity: 0.85 },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F3',
  },
  ownerInfo: { flexShrink: 1 },
  ownerName: { fontSize: 15, fontWeight: '700', color: '#1F2733' },
  ownerPhone: { fontSize: 13, color: palette.muted, marginTop: 2 },
  ownerFlag: { fontSize: 11, color: '#C77E1B', marginTop: 2, fontWeight: '600' },
  reset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F1F5F4' },
  resetText: { color: '#1F2733', fontWeight: '700', fontSize: 12 },
  empty: { color: palette.muted, fontSize: 13 },
});
