import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'qrcode';

export const palette = {
  background: '#f6efe4',
  paper: '#fffaf1',
  card: '#fff9f0',
  ink: '#19231f',
  muted: '#66756d',
  accent: '#c6674d',
  forest: '#184b43',
  border: '#e8dcc8',
  success: '#2e7d4f',
  warning: '#a86012',
  danger: '#b84334',
  info: '#476c9b',
};

const statusTone = {
  VACANT: { background: '#edf7ee', color: '#2e7d4f' },
  OCCUPIED: { background: '#fdf0dc', color: '#a86012' },
  NOTICE: { background: '#fce8e5', color: '#b84334' },
  ACTIVE: { background: '#edf7ee', color: '#2e7d4f' },
  INVITED: { background: '#eef4fc', color: '#476c9b' },
  MOVE_OUT_SCHEDULED: { background: '#fdf0dc', color: '#a86012' },
  CLOSED: { background: '#efefef', color: '#525252' },
  DUE: { background: '#eef4fc', color: '#476c9b' },
  OVERDUE: { background: '#fce8e5', color: '#b84334' },
  PAYMENT_SUBMITTED: { background: '#fff2d8', color: '#8f5b05' },
  PAID: { background: '#edf7ee', color: '#2e7d4f' },
  READY: { background: '#fff2d8', color: '#8f5b05' },
  SCHEDULED: { background: '#eef4fc', color: '#476c9b' },
  SENT: { background: '#edf7ee', color: '#2e7d4f' },
  FAILED: { background: '#fce8e5', color: '#b84334' },
  CANCELED: { background: '#efefef', color: '#525252' },
  PENDING_REVIEW: { background: '#fff2d8', color: '#8f5b05' },
  APPROVED: { background: '#edf7ee', color: '#2e7d4f' },
  REJECTED: { background: '#fce8e5', color: '#b84334' },
  WHATSAPP: { background: '#edf7ee', color: '#2e7d4f' },
  IN_APP: { background: '#eef4fc', color: '#476c9b' },
};

export function ScreenSurface({ children }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
      {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone="dark" /> : null}
    </View>
  );
}

export function Banner({ message, tone = 'info' }) {
  const map = {
    info: { backgroundColor: '#eef4fc', color: palette.info },
    success: { backgroundColor: '#edf7ee', color: palette.success },
    danger: { backgroundColor: '#fce8e5', color: palette.danger },
  };
  const colors = map[tone] || map.info;
  return (
    <View style={[styles.banner, { backgroundColor: colors.backgroundColor }]}>
      <Text style={[styles.bannerText, { color: colors.color }]}>{message}</Text>
    </View>
  );
}

export function TabStrip({ tabs, activeTab, onChange }) {
  return (
    <View style={styles.tabStrip}>
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionCard({ title, subtitle, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function MetricRow({ items }) {
  return (
    <View style={styles.metricRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.metricCard}>
          <Text style={styles.metricValue}>{item.value}</Text>
          <Text style={styles.metricLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatusBadge({ label }) {
  const colors = statusTone[label] || { background: '#efefef', color: '#525252' };
  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
      <Text style={[styles.statusLabel, { color: colors.color }]}>{label.replaceAll('_', ' ')}</Text>
    </View>
  );
}

export function KeyValueRow({ label, value }) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyValue}>{value}</Text>
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline = false }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#97a29d"
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

export function ChoiceChips({ options, value, onChange }) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.choiceChip, selected && styles.choiceChipSelected]}
          >
            <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{option.label}</Text>
            {option.meta ? (
              <Text style={[styles.choiceMeta, selected && styles.choiceMetaSelected]}>{option.meta}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({ label, onPress, tone = 'primary', disabled = false }) {
  const tones = {
    primary: { backgroundColor: palette.accent, color: '#fff9f0' },
    dark: { backgroundColor: palette.forest, color: '#fff9f0' },
    ghost: { backgroundColor: '#f2e6d4', color: palette.ink },
    danger: { backgroundColor: '#f4d6d1', color: palette.danger },
  };
  const colors = tones[tone] || tones.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: disabled ? '#e3d8c8' : colors.backgroundColor },
      ]}
    >
      <Text style={[styles.buttonText, { color: disabled ? '#7c867f' : colors.color }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, description }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

export function InlineGroup({ children }) {
  return <View style={styles.inlineGroup}>{children}</View>;
}

export function QrCard({ value, subtitle }) {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(value, {
      margin: 1,
      width: 240,
      color: {
        dark: palette.forest,
        light: '#FFF8EE',
      },
    })
      .then((nextUri) => {
        if (active) {
          setUri(nextUri);
        }
      })
      .catch(() => {
        if (active) {
          setUri(null);
        }
      });

    return () => {
      active = false;
    };
  }, [value]);

  return (
    <View style={styles.qrCard}>
      {uri ? <Image source={{ uri }} style={styles.qrImage} /> : <View style={styles.qrPlaceholder} />}
      <Text style={styles.qrTitle}>UPI QR</Text>
      <Text style={styles.qrSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screenContent: {
    padding: 20,
    paddingBottom: 56,
    gap: 18,
  },
  headerWrap: {
    gap: 12,
  },
  heroPanel: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: palette.forest,
    gap: 8,
  },
  eyebrow: {
    color: '#d8c18f',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fff8ee',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#dbe7df',
    fontSize: 15,
    lineHeight: 22,
  },
  banner: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  tabStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#efe5d5',
  },
  tabItemActive: {
    backgroundColor: palette.accent,
  },
  tabLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#fffaf1',
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 14,
  },
  cardHeader: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.muted,
  },
  cardBody: {
    gap: 14,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: palette.paper,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.ink,
  },
  metricLabel: {
    fontSize: 13,
    color: palette.muted,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  keyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  keyLabel: {
    flex: 1,
    fontSize: 13,
    color: palette.muted,
  },
  keyValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    color: palette.ink,
    fontWeight: '700',
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.ink,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceChip: {
    minWidth: '47%',
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#f1eadf',
    gap: 4,
  },
  choiceChipSelected: {
    backgroundColor: '#f6d2c8',
    borderWidth: 1,
    borderColor: '#d88973',
  },
  choiceTitle: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  choiceTitleSelected: {
    color: '#843a2b',
  },
  choiceMeta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  choiceMetaSelected: {
    color: '#975747',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '800',
    fontSize: 14,
  },
  emptyState: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#f1eadf',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
  },
  emptyDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.muted,
  },
  inlineGroup: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  qrCard: {
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    backgroundColor: '#fff8ee',
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 16,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#efe7db',
  },
  qrTitle: {
    fontWeight: '800',
    fontSize: 16,
    color: palette.ink,
  },
  qrSubtitle: {
    textAlign: 'center',
    color: palette.muted,
    lineHeight: 20,
  },
});
