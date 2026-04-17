import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'qrcode';

export const palette = {
  background: '#FBF7F2',
  backgroundWarm: '#F5EFE6',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F4EF',
  surfaceTint: '#FFF3F5',
  surfaceSuccess: '#EFF7F1',
  surfaceWarning: '#FFF5E9',
  surfaceDanger: '#FFF1EF',
  ink: '#222222',
  inkSoft: '#3B3B3B',
  muted: '#6A6A6A',
  mutedSoft: '#8B8B8B',
  border: '#E9E3DA',
  borderStrong: '#DCD4C8',
  accent: '#FF385C',
  accentDeep: '#E31C5F',
  accentSoft: '#FFE3E8',
  success: '#2E7D32',
  warning: '#B56713',
  danger: '#C13515',
  info: '#457B9D',
  white: '#FFFFFF',
  black: '#111111',
};

const statusTone = {
  VACANT: { background: '#EEF4FF', color: '#315BA8' },
  OCCUPIED: { background: '#F4F0FF', color: '#6B4DC4' },
  NOTICE: { background: '#FFF4E2', color: '#B56713' },
  ACTIVE: { background: '#EAF6ED', color: '#2E7D32' },
  INVITED: { background: '#FFF3F5', color: '#E31C5F' },
  MOVE_OUT_SCHEDULED: { background: '#FFF4E2', color: '#B56713' },
  CLOSED: { background: '#EFEAE3', color: '#6A6A6A' },
  DUE: { background: '#FFF4E2', color: '#B56713' },
  OVERDUE: { background: '#FFF1EF', color: '#C13515' },
  PAYMENT_SUBMITTED: { background: '#FFF3F5', color: '#E31C5F' },
  PAID: { background: '#EAF6ED', color: '#2E7D32' },
  READY: { background: '#FFF4E2', color: '#B56713' },
  COMPLETE: { background: '#EAF6ED', color: '#2E7D32' },
  PENDING: { background: '#FFF4E2', color: '#B56713' },
  SCHEDULED: { background: '#EEF4FF', color: '#315BA8' },
  SENT: { background: '#EAF6ED', color: '#2E7D32' },
  FAILED: { background: '#FFF1EF', color: '#C13515' },
  CANCELED: { background: '#EFEAE3', color: '#6A6A6A' },
  PENDING_REVIEW: { background: '#FFF3F5', color: '#E31C5F' },
  APPROVED: { background: '#EAF6ED', color: '#2E7D32' },
  REJECTED: { background: '#FFF1EF', color: '#C13515' },
  WHATSAPP: { background: '#EAF6ED', color: '#2E7D32' },
  IN_APP: { background: '#EEF4FF', color: '#315BA8' },
};

const sectionTones = {
  default: { backgroundColor: palette.surface, borderColor: palette.border },
  soft: { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
  accent: { backgroundColor: palette.surfaceTint, borderColor: '#FFD8DF' },
  forest: { backgroundColor: palette.surfaceSuccess, borderColor: '#D9EBDD' },
};

const focusTones = {
  forest: {
    backgroundColor: '#F8FBF8',
    borderColor: '#D7EAD9',
    eyebrowColor: palette.success,
    titleColor: palette.ink,
    descriptionColor: palette.muted,
  },
  accent: {
    backgroundColor: palette.surfaceTint,
    borderColor: '#FFD8DF',
    eyebrowColor: palette.accentDeep,
    titleColor: palette.ink,
    descriptionColor: palette.muted,
  },
  soft: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    eyebrowColor: palette.mutedSoft,
    titleColor: palette.ink,
    descriptionColor: palette.muted,
  },
};

function getBannerTone(tone) {
  const map = {
    info: { backgroundColor: '#DFECF5', color: palette.inkSoft, borderColor: '#CFE1EE' },
    success: { backgroundColor: palette.surfaceSuccess, color: palette.success, borderColor: '#D5E8D8' },
    danger: { backgroundColor: palette.surfaceDanger, color: palette.danger, borderColor: '#F0D1CB' },
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
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.heroTitle}>{title}</Text>
          {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        </View>
        {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone="secondary" /> : null}
      </View>
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
            style={({ pressed }) => [styles.tabCard, isActive && styles.tabCardActive, pressed && styles.pressedScale]}
          >
            <View style={[styles.tabIndicator, isActive && styles.tabIndicatorActive]} />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SearchCluster({ items, actionLabel, onAction }) {
  return (
    <View style={styles.searchCluster}>
      <View style={styles.searchClusterContent}>
        {items.map((item, index) => (
          <React.Fragment key={item.label}>
            <View style={styles.searchSegment}>
              <Text style={styles.searchSegmentLabel}>{item.label}</Text>
              <Text style={styles.searchSegmentValue}>{item.value}</Text>
            </View>
            {index < items.length - 1 ? <View style={styles.searchDivider} /> : null}
          </React.Fragment>
        ))}
      </View>
      {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone="primary" compact /> : null}
    </View>
  );
}

export function SectionCard({ title, subtitle, tone = 'default', children }) {
  const toneStyles = sectionTones[tone] || sectionTones.default;

  return (
    <View style={[styles.card, toneStyles]}>
      {(title || subtitle) ? (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function FocusCard({ eyebrow, title, description, tone = 'forest', actionLabel, onAction, children }) {
  const toneStyles = focusTones[tone] || focusTones.forest;
  const actionTone = tone === 'accent' ? 'primary' : 'secondary';

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

export function FeatureCard({ imageUri, eyebrow, title, description, badges = [], actionLabel, onAction, tone = 'default' }) {
  const toneStyles = sectionTones[tone] || sectionTones.default;

  return (
    <View style={[styles.featureCard, toneStyles]}>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.featureImage} resizeMode="cover" /> : null}
      <View style={styles.featureContent}>
        {eyebrow ? <Text style={styles.featureEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.featureTitle}>{title}</Text>
        {description ? <Text style={styles.featureDescription}>{description}</Text> : null}
        {badges.length ? (
          <View style={styles.highlightWrap}>
            {badges.map((item) => (
              <View key={item} style={styles.highlightPill}>
                <Text style={styles.highlightText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone="secondary" /> : null}
      </View>
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
  const colors = statusTone[label] || { background: '#EFEAE3', color: palette.muted };

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
        placeholderTextColor={palette.mutedSoft}
        keyboardType={keyboardType}
        multiline={multiline}
        selectionColor={palette.accent}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[styles.input, multiline && styles.inputMultiline, isFocused && styles.inputFocused]}
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
            style={({ pressed }) => [styles.choiceChip, selected && styles.choiceChipSelected, pressed && styles.pressedScale]}
          >
            <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{option.label}</Text>
            {option.meta ? <Text style={[styles.choiceMeta, selected && styles.choiceMetaSelected]}>{option.meta}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({ label, onPress, tone = 'primary', disabled = false, compact = false }) {
  const tones = {
    primary: { backgroundColor: palette.accent, color: palette.white, borderColor: palette.accent },
    secondary: { backgroundColor: palette.surface, color: palette.ink, borderColor: palette.border },
    dark: { backgroundColor: palette.black, color: palette.white, borderColor: palette.black },
    ghost: { backgroundColor: 'transparent', color: palette.ink, borderColor: 'transparent' },
    danger: { backgroundColor: palette.surfaceDanger, color: palette.danger, borderColor: '#F0D1CB' },
  };
  const colors = tones[tone] || tones.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: disabled ? '#F1ECE5' : colors.backgroundColor,
          borderColor: disabled ? '#E1DACF' : colors.borderColor,
        },
        pressed && !disabled && styles.pressedScale,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: disabled ? palette.mutedSoft : colors.color }]}>{label}</Text>
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
        dark: '#111111',
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
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 56,
    gap: 20,
  },
  screenContentWithBottomBar: {
    paddingBottom: 140,
  },
  bottomBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    alignItems: 'center',
  },
  headerWrap: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  headerCopy: {
    gap: 6,
    maxWidth: 720,
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 24,
  },
  highlightWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  highlightText: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  banner: {
    borderRadius: 20,
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
    padding: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: palette.border,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    shadowColor: '#2B1D12',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  tabCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabCardActive: {
    backgroundColor: palette.surfaceTint,
  },
  tabIndicator: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: palette.accent,
  },
  tabLabel: {
    color: palette.mutedSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: palette.ink,
  },
  searchCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#2B1D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 4,
  },
  searchClusterContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchSegment: {
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 2,
  },
  searchSegmentLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: palette.ink,
  },
  searchSegmentValue: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.muted,
  },
  searchDivider: {
    width: 1,
    height: 28,
    backgroundColor: palette.border,
  },
  card: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#2B1D12',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 5,
  },
  cardHeader: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.ink,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: palette.muted,
  },
  cardBody: {
    gap: 14,
  },
  focusCard: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#2B1D12',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  focusEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  focusTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  focusDescription: {
    fontSize: 15,
    lineHeight: 24,
  },
  focusContent: {
    gap: 10,
  },
  featureCard: {
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#2B1D12',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 5,
  },
  featureImage: {
    width: '100%',
    height: 220,
  },
  featureContent: {
    padding: 20,
    gap: 10,
  },
  featureEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featureTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: palette.ink,
  },
  featureDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: palette.muted,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    minWidth: 170,
    padding: 18,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  actionCardAccent: {
    backgroundColor: palette.surfaceTint,
    borderColor: '#FFD8DF',
  },
  actionCardForest: {
    backgroundColor: palette.surfaceSuccess,
    borderColor: '#D9EBDD',
  },
  actionEyebrow: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  actionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  actionDescription: {
    color: palette.muted,
    lineHeight: 22,
  },
  actionLink: {
    color: palette.accentDeep,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 130,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  metricValue: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  keyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  keyLabel: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  keyValue: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  input: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: palette.ink,
    backgroundColor: palette.surface,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: '#F7A5B5',
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceChip: {
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: 3,
  },
  choiceChipSelected: {
    borderColor: '#FFD1DA',
    backgroundColor: palette.surfaceTint,
  },
  choiceTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceTitleSelected: {
    color: palette.accentDeep,
  },
  choiceMeta: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  choiceMetaSelected: {
    color: palette.accentDeep,
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonTextCompact: {
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  emptyState: {
    paddingVertical: 12,
    gap: 6,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDescription: {
    color: palette.muted,
    lineHeight: 22,
  },
  inlineGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  qrCard: {
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  qrCanvasWrap: {
    width: 240,
    height: 240,
    borderRadius: 24,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 20,
    backgroundColor: palette.surfaceMuted,
  },
  qrTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  qrSubtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressedScale: {
    transform: [{ scale: 0.985 }],
  },
});
