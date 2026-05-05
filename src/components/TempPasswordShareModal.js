import React, { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { palette, elevation } from './uiAirbnb';
import { useToast } from './ToastHost';
import { spring as springTokens, haptic } from '../lib/motion';

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

function ActionTile({ label, icon, onPress, disabled = false, primary = false }) {
  const scale = useSharedValue(1);
  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.actionTileWrap, wrap]}>
      <Pressable
        onPress={() => {
          if (disabled) return;
          haptic.light();
          onPress?.();
        }}
        onPressIn={() => { if (!disabled) scale.value = withSpring(0.95, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        disabled={disabled}
        android_ripple={
          disabled
            ? undefined
            : { color: primary ? 'rgba(255,255,255,0.22)' : 'rgba(0,199,168,0.18)', borderless: false }
        }
        style={[
          styles.actionTile,
          primary && styles.actionTilePrimary,
          disabled && styles.actionTileDisabled,
        ]}
      >
        <Text style={[styles.actionTileIcon, primary && styles.actionTileIconPrimary]}>{icon}</Text>
        <Text style={[styles.actionTileText, primary && styles.actionTileTextPrimary]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
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
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  // Animations
  const backdrop = useSharedValue(0);
  const sheetTy = useSharedValue(60);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setCopied(false);
      backdrop.value = withTiming(1, { duration: 220 });
      sheetTy.value = withSpring(0, springTokens.gentle);
    } else {
      backdrop.value = withTiming(0, { duration: 180 });
      sheetTy.value = withTiming(60, { duration: 200 });
    }
  }, [visible, backdrop, sheetTy]);

  useEffect(() => {
    checkScale.value = withSpring(copied ? 1 : 0, springTokens.bouncy);
  }, [copied, checkScale]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetTy.value }] }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkScale.value,
    transform: [{ scale: checkScale.value }],
  }));

  if (!visible) return null;

  const message = buildMessage({ recipientName, recipientPhone, role, tempPassword, inviterName });
  const phoneDigits = digitsOnly(recipientPhone);

  const handleCopy = async () => {
    if (!Clipboard?.setStringAsync) {
      toast.show({
        tone: 'danger',
        message: 'Copy not available. Long-press the password to select it.',
      });
      return;
    }
    try {
      await Clipboard.setStringAsync(tempPassword);
      setCopied(true);
      haptic.success();
      toast.show({ tone: 'success', message: 'Password copied.' });
    } catch (_e) {
      toast.show({ tone: 'danger', message: 'Could not copy. Long-press the password instead.' });
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.modalRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable style={styles.backdropPressable} onPress={onDismiss}>
            <View style={styles.backdrop} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.sheetWrap, sheetStyle]}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.eyebrow}>Temporary password</Text>
              <Text style={styles.title}>Share with {recipientName || 'the user'}</Text>
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={12}
              android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true, radius: 22 }}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>
            They'll be asked to change it on first login. This password won't be shown again.
          </Text>

          <LinearGradient
            colors={['#E6FBF5', '#D8FBF1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.passwordBox}
          >
            <Text style={styles.passwordLabel}>PASSWORD</Text>
            <Text selectable style={styles.passwordText}>{tempPassword}</Text>
            <Animated.View style={[styles.copiedPill, checkStyle]} pointerEvents="none">
              <Text style={styles.copiedPillText}>✓ Copied</Text>
            </Animated.View>
          </LinearGradient>

          <View style={styles.actionRow}>
            <ActionTile label="Copy" icon="⧉" onPress={handleCopy} />
            <ActionTile
              label="WhatsApp"
              icon="✱"
              onPress={handleWhatsApp}
              disabled={!phoneDigits}
            />
            <ActionTile label="SMS" icon="✉" onPress={handleSms} />
            <ActionTile label="Share" icon="↗" onPress={handleShare} />
          </View>

          <Pressable
            onPress={onDismiss}
            android_ripple={{ color: 'rgba(255,255,255,0.22)', borderless: false }}
            style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
          >
            <Text style={styles.dismissText}>I've shared it</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdropPressable: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: palette.overlay },
  sheetWrap: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 16,
    ...elevation.e3,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8DDE3',
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetHeaderText: { flex: 1, gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: palette.accentDeep,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: { opacity: 0.6 },
  closeIcon: { fontSize: 22, color: palette.ink, lineHeight: 24, fontWeight: '600' },
  subtitle: { fontSize: 14, color: palette.muted, lineHeight: 20 },
  passwordBox: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BDF1E2',
    overflow: 'hidden',
    gap: 6,
  },
  passwordLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.accentDeep,
    letterSpacing: 1.4,
  },
  passwordText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
    color: palette.accentInk,
  },
  copiedPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  copiedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.white,
    letterSpacing: 0.4,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTileWrap: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  actionTile: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  actionTilePrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  actionTileDisabled: { opacity: 0.4 },
  actionTileIcon: { fontSize: 16, fontWeight: '800', color: palette.accentDeep },
  actionTileIconPrimary: { color: palette.white },
  actionTileText: { fontSize: 14, fontWeight: '700', color: palette.ink },
  actionTileTextPrimary: { color: palette.white },
  dismiss: {
    marginTop: 6,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: palette.ink,
    alignItems: 'center',
    overflow: 'hidden',
    ...elevation.e2,
  },
  dismissPressed: { opacity: 0.9 },
  dismissText: { color: palette.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
});
