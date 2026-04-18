import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'qrcode';

export const palette = {
  background: '#0B0F19',
  paper: '#111827',
  card: '#111827',
  cardAlt: '#0F172A',
  cardMuted: '#131D31',
  ink: '#E5E7EB',
  muted: '#9CA3AF',
  accent: '#6366F1',
  accentHover: '#4F46E5',
  accentSoft: 'rgba(99, 102, 241, 0.16)',
  border: '#1F2937',
  borderStrong: '#273449',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.16)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.16)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.16)',
  info: '#60A5FA',
  infoSoft: 'rgba(96, 165, 250, 0.16)',
  white: '#FFFFFF',
};

const statusTone = {
  VACANT: { background: 'rgba(96, 165, 250, 0.16)', color: '#93C5FD' },
  OCCUPIED: { background: 'rgba(99, 102, 241, 0.16)', color: '#C7D2FE' },
  NOTICE: { background: 'rgba(245, 158, 11, 0.16)', color: '#FCD34D' },
  ACTIVE: { background: 'rgba(34, 197, 94, 0.16)', color: '#86EFAC' },
  INVITED: { background: 'rgba(96, 165, 250, 0.16)', color: '#93C5FD' },
  MOVE_OUT_SCHEDULED: { background: 'rgba(245, 158, 11, 0.16)', color: '#FCD34D' },
  CLOSED: { background: 'rgba(156, 163, 175, 0.16)', color: '#D1D5DB' },
  DUE: { background: 'rgba(245, 158, 11, 0.16)', color: '#FCD34D' },
  OVERDUE: { background: 'rgba(239, 68, 68, 0.16)', color: '#FCA5A5' },
  PAYMENT_SUBMITTED: { background: 'rgba(99, 102, 241, 0.16)', color: '#C7D2FE' },
  PAID: { background: 'rgba(34, 197, 94, 0.16)', color: '#86EFAC' },
  READY: { background: 'rgba(245, 158, 11, 0.16)', color: '#FCD34D' },
  COMPLETE: { background: 'rgba(34, 197, 94, 0.16)', color: '#86EFAC' },
  PENDING: { background: 'rgba(245, 158, 11, 0.16)', color: '#FCD34D' },
  SCHEDULED: { background: 'rgba(96, 165, 250, 0.16)', color: '#93C5FD' },
  SENT: { background: 'rgba(34, 197, 94, 0.16)', color: '#86EFAC' },
  FAILED: { background: 'rgba(239, 68, 68, 0.16)', color: '#FCA5A5' },
  CANCELED: { background: 'rgba(156, 163, 175, 0.16)', color: '#D1D5DB' },
  PENDING_REVIEW: { background: 'rgba(99, 102, 241, 0.16)', color: '#C7D2FE' },
  APPROVED: { background: 'rgba(34, 197, 94, 0.16)', color: '#86EFAC' },
  REJECTED: { background: 'rgba(239, 68, 68, 0.16)', color: '#FCA5A5' },
  WHATSAPP: { background: 'rgba(34, 197, 94, 0.16)', color: '#86EFAC' },
  IN_APP: { background: 'rgba(96, 165, 250, 0.16)', color: '#93C5FD' },
};

const sectionTones = {
  default: {
    backgroundColor: palette.card,
    borderColor: palette.border,
  },
  soft: {
    backgroundColor: palette.cardAlt,
    borderColor: palette.borderStrong,
  },
  forest: {
    backgroundColor: 'rgba(34, 197, 94, 0.09)',
    borderColor: 'rgba(34, 197, 94, 0.24)',
  },
  accent: {
    backgroundColor: 'rgba(99, 102, 241, 0.11)',
    borderColor: 'rgba(99, 102, 241, 0.28)',
  },
};

const focusTones = {
  forest: {
    backgroundColor: '#101A2B',
    borderColor: 'rgba(34, 197, 94, 0.26)',
    eyebrowColor: '#86EFAC',
    titleColor: palette.ink,
    descriptionColor: '#B8C0CC',
  },
  accent: {
    backgroundColor: '#111A31',
    borderColor: 'rgba(99, 102, 241, 0.32)',
    eyebrowColor: '#C7D2FE',
    titleColor: palette.ink,
    descriptionColor: '#B7C1D8',
  },
  soft: {
    backgroundColor: palette.cardAlt,
    borderColor: palette.borderStrong,
    eyebrowColor: '#A5B4FC',
    titleColor: palette.ink,
    descriptionColor: palette.muted,
  },
};

function getBannerTone(tone) {
  const map = {
    info: { backgroundColor: palette.infoSoft, color: '#BFDBFE', borderColor: 'rgba(96, 165, 250, 0.24)' },
    success: { backgroundColor: palette.successSoft, color: '#86EFAC', borderColor: 'rgba(34, 197, 94, 0.24)' },
    danger: { backgroundColor: palette.dangerSoft, color: '#FCA5A5', borderColor: 'rgba(239, 68, 68, 0.24)' },
  };

  return map[tone] || map.info;
}

export function ScreenSurface({ children, bottomBar = null }) {
  return (
    <View style={styles.screenShell}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, bottomBar && styles.screenContentWithBottomBar]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {bottomBar ? <View style={styles.bottomBarWrap}>{bottomBar}</View> : null}
    </View>
  );
}

export function PageHeader({ eyebrow, title, subtitle, highlights = [], actionLabel, onAction }) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
        {highlights.length ? (
          <View style={styles.highlightWrap}>
            {highlights.map((item) => (
              <View key={item} style={styles.highlightPill}>
                <Text style={styles.highlightText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone="dark" /> : null}
    </View>
  );
}

export function Banner({ message, tone = 'info' }) {
  const colors = getBannerTone(tone);

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        },
      ]}
    >
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
            style={({ pressed }) => [
              styles.tabCard,
              isActive && styles.tabCardActive,
              pressed && styles.pressedScale,
            ]}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionCard({ title, subtitle, tone = 'default', children }) {
  const toneStyles = sectionTones[tone] || sectionTones.default;

  return (
    <View style={[styles.card, toneStyles]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function FocusCard({ eyebrow, title, description, tone = 'forest', actionLabel, onAction, children }) {
  const toneStyles = focusTones[tone] || focusTones.forest;
  const actionTone = tone === 'forest' ? 'ghost' : 'primary';

  return (
    <View
      style={[
        styles.focusCard,
        {
          backgroundColor: toneStyles.backgroundColor,
          borderColor: toneStyles.borderColor,
        },
      ]}
    >
      {eyebrow ? <Text style={[styles.focusEyebrow, { color: toneStyles.eyebrowColor }]}>{eyebrow}</Text> : null}
      <Text style={[styles.focusTitle, { color: toneStyles.titleColor }]}>{title}</Text>
      {description ? <Text style={[styles.focusDescription, { color: toneStyles.descriptionColor }]}>{description}</Text> : null}
      {children ? <View style={styles.focusContent}>{children}</View> : null}
      {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone={actionTone} /> : null}
    </View>
  );
}

export function ActionGrid({ items }) {
  return (
    <View style={styles.actionGrid}>
      {items.map((item) => (
        <Pressable
          key={item.title}
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.actionCard,
            item.tone === 'accent' && styles.actionCardAccent,
            item.tone === 'forest' && styles.actionCardForest,
            pressed && styles.pressedScale,
          ]}
        >
          {item.eyebrow ? <Text style={styles.actionEyebrow}>{item.eyebrow}</Text> : null}
          <Text style={styles.actionTitle}>{item.title}</Text>
          <Text style={styles.actionDescription}>{item.description}</Text>
          {item.label ? <Text style={styles.actionLink}>{item.label}</Text> : null}
        </Pressable>
      ))}
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
  const colors = statusTone[label] || { background: 'rgba(156, 163, 175, 0.16)', color: '#D1D5DB' };

  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
      <Text style={[styles.statusLabel, { color: colors.color }]}>{String(label).replaceAll('_', ' ')}</Text>
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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        keyboardType={keyboardType}
        multiline={multiline}
        selectionColor={palette.accent}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          isFocused && styles.inputFocused,
        ]}
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
            style={({ pressed }) => [
              styles.choiceChip,
              selected && styles.choiceChipSelected,
              pressed && styles.pressedScale,
            ]}
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
    primary: { backgroundColor: palette.accent, color: palette.white, borderColor: palette.accent },
    dark: { backgroundColor: palette.cardAlt, color: palette.ink, borderColor: palette.borderStrong },
    ghost: { backgroundColor: 'transparent', color: palette.ink, borderColor: palette.borderStrong },
    danger: { backgroundColor: palette.dangerSoft, color: '#FCA5A5', borderColor: 'rgba(239, 68, 68, 0.24)' },
  };
  const colors = tones[tone] || tones.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled ? '#182235' : colors.backgroundColor,
          borderColor: disabled ? '#223147' : colors.borderColor,
        },
        pressed && !disabled && styles.pressedScale,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, { color: disabled ? '#708097' : colors.color }]}>{label}</Text>
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
        dark: '#0B0F19',
        light: '#FFFFFF',
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
      <View style={styles.qrCanvasWrap}>
        {uri ? <Image source={{ uri }} style={styles.qrImage} /> : <View style={styles.qrPlaceholder} />}
      </View>
      <Text style={styles.qrTitle}>UPI QR</Text>
      <Text style={styles.qrSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screenContent: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 56,
    gap: 18,
  },
  screenContentWithBottomBar: {
    paddingBottom: 132,
  },
  bottomBarWrap: {
    backgroundColor: 'rgba(11, 15, 25, 0.96)',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  headerWrap: {
    gap: 12,
  },
  heroPanel: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
  },
  eyebrow: {
    color: '#A5B4FC',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  highlightWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.24)',
  },
  highlightText: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  banner: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  tabStrip: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 22,
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
  },
  tabCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCardActive: {
    backgroundColor: palette.accent,
  },
  tabLabel: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: palette.white,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  cardHeader: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 20,
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
  focusCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 5,
  },
  focusEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  focusTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  focusDescription: {
    fontSize: 14,
    lineHeight: 21,
  },
  focusContent: {
    gap: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    minWidth: 150,
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    gap: 8,
  },
  actionCardAccent: {
    backgroundColor: 'rgba(99, 102, 241, 0.11)',
    borderColor: 'rgba(99, 102, 241, 0.28)',
  },
  actionCardForest: {
    backgroundColor: 'rgba(34, 197, 94, 0.09)',
    borderColor: 'rgba(34, 197, 94, 0.24)',
  },
  actionEyebrow: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.muted,
  },
  actionLink: {
    marginTop: 4,
    color: '#C7D2FE',
    fontSize: 13,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: palette.cardAlt,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  metricValue: {
    fontSize: 26,
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
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  keyLabel: {
    flex: 1,
    fontSize: 13,
    color: palette.muted,
    lineHeight: 19,
  },
  keyValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    lineHeight: 19,
    color: palette.ink,
    fontWeight: '700',
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.ink,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.cardAlt,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.ink,
  },
  inputFocused: {
    borderColor: palette.accent,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 2,
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
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  choiceChipSelected: {
    backgroundColor: palette.accentSoft,
    borderColor: 'rgba(99, 102, 241, 0.32)',
  },
  choiceTitle: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 13,
  },
  choiceTitleSelected: {
    color: '#C7D2FE',
  },
  choiceMeta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  choiceMetaSelected: {
    color: '#A5B4FC',
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    fontWeight: '800',
    fontSize: 14,
  },
  emptyState: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.border,
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
    alignItems: 'center',
  },
  qrCard: {
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    backgroundColor: palette.cardAlt,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    gap: 10,
  },
  qrCanvasWrap: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: palette.white,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
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
  pressedScale: {
    transform: [{ scale: 0.985 }],
  },
});
