import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette } from './uiAirbnb';

let Clipboard = null;
try {
  // eslint-disable-next-line global-require
  Clipboard = require('expo-clipboard');
} catch (_error) {
  Clipboard = null;
}

function buildMessage({ recipientName, recipientPhone, role, tempPassword, inviterName }) {
  const roleLabel = role === 'owner' ? 'Owner' : 'Tenant';
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const sender = inviterName ? `${inviterName} on RentApp` : 'RentApp';
  return [
    `${greeting} you've been invited to RentApp by ${sender}.`,
    `Open the app, choose "${roleLabel}", enter your phone ${recipientPhone || ''}, and use this temporary password: ${tempPassword}.`,
    `You'll be asked to change it on first login.`,
  ].join('\n\n');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D+/g, '');
}

export function TempPasswordShareModal({
  visible,
  onDismiss,
  tempPassword,
  recipientName,
  recipientPhone,
  inviterName,
  role = 'tenant',
}) {
  if (!visible) return null;

  const message = buildMessage({ recipientName, recipientPhone, role, tempPassword, inviterName });
  const phoneDigits = digitsOnly(recipientPhone);

  const handleCopy = async () => {
    try {
      if (Clipboard?.setStringAsync) {
        await Clipboard.setStringAsync(tempPassword);
      }
    } catch (_e) {
      /* ignore */
    }
  };

  const handleWhatsApp = () => {
    if (!phoneDigits) return;
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleSms = () => {
    const url = phoneDigits
      ? `sms:${phoneDigits}?body=${encodeURIComponent(message)}`
      : `sms:?body=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {});
  };

  const handleShare = () => {
    Share.share({ message }).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Temporary password</Text>
          <Text style={styles.subtitle}>
            Share this with {recipientName || 'the user'}. They'll be asked to change it on first login.
          </Text>

          <View style={styles.passwordBox}>
            <Text style={styles.passwordText}>{tempPassword}</Text>
          </View>

          <Text style={styles.warning}>This password won't be shown again.</Text>

          <View style={styles.actionRow}>
            <Pressable onPress={handleCopy} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
              <Text style={styles.actionText}>Copy</Text>
            </Pressable>
            <Pressable
              onPress={handleWhatsApp}
              disabled={!phoneDigits}
              style={({ pressed }) => [
                styles.action,
                !phoneDigits && styles.actionDisabled,
                pressed && phoneDigits && styles.actionPressed,
              ]}
            >
              <Text style={styles.actionText}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={handleSms} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
              <Text style={styles.actionText}>SMS</Text>
            </Pressable>
            <Pressable onPress={handleShare} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
              <Text style={styles.actionText}>Share...</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.dismiss, pressed && styles.actionPressed]}
          >
            <Text style={styles.dismissText}>I've shared it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 25, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 32,
    gap: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2733' },
  subtitle: { fontSize: 14, color: palette.muted, lineHeight: 20 },
  passwordBox: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#F1F5F4',
    alignItems: 'center',
    marginVertical: 4,
  },
  passwordText: { fontSize: 24, fontWeight: '800', letterSpacing: 2, color: '#1F2733' },
  warning: { fontSize: 12, color: '#C0392B', textAlign: 'center', fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  action: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#24C9AE',
    alignItems: 'center',
  },
  actionDisabled: { opacity: 0.4 },
  actionPressed: { opacity: 0.85 },
  actionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  dismiss: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#1F2733',
    alignItems: 'center',
  },
  dismissText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
