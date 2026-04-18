import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'qrcode';

export const palette = {
  background: '#EEF4F3',
  backgroundWarm: '#DDE9E6',
  surface: '#FFFFFF',
  surfaceMuted: '#F5FBFA',
  surfaceTint: '#E8FBF6',
  surfaceSuccess: '#EBF9F1',
  surfaceWarning: '#FFF6E8',
  surfaceDanger: '#FFF1EF',
  ink: '#2E3138',
  inkSoft: '#48505A',
  muted: '#8E96A3',
  mutedSoft: '#AEB6C2',
  border: '#D8E7E3',
  borderStrong: '#C6DBD6',
  accent: '#24C9AE',
  accentDeep: '#0D9F88',
  accentSoft: '#D6FFF7',
  success: '#22A06B',
  warning: '#E29A2D',
  danger: '#EB5757',
  info: '#3B82F6',
  white: '#FFFFFF',
  black: '#20242B',
};

const statusTone = {
  VACANT: { background: '#EEF7F5', color: '#0D8C76' },
  OCCUPIED: { background: '#EAF2FF', color: '#4466B0' },
  NOTICE: { background: '#FFF6E8', color: '#C78520' },
  ACTIVE: { background: '#EBF9F1', color: '#1D8D5E' },
  INVITED: { background: '#E8FBF6', color: '#0D9F88' },
  MOVE_OUT_SCHEDULED: { background: '#FFF6E8', color: '#C78520' },
  CLOSED: { background: '#F1F4F4', color: '#6C7683' },
  DUE: { background: '#FFF6E8', color: '#C78520' },
  OVERDUE: { background: '#FFF1EF', color: '#D34C4C' },
  PAYMENT_SUBMITTED: { background: '#E8FBF6', color: '#0D9F88' },
  PAID: { background: '#EBF9F1', color: '#1D8D5E' },
  READY: { background: '#EEF7F5', color: '#0D8C76' },
  COMPLETE: { background: '#EBF9F1', color: '#1D8D5E' },
  PENDING: { background: '#FFF6E8', color: '#C78520' },
  SCHEDULED: { background: '#EAF2FF', color: '#4466B0' },
  SENT: { background: '#EBF9F1', color: '#1D8D5E' },
  FAILED: { background: '#FFF1EF', color: '#D34C4C' },
  CANCELED: { background: '#F1F4F4', color: '#6C7683' },
  PENDING_REVIEW: { background: '#E8FBF6', color: '#0D9F88' },
  APPROVED: { background: '#EBF9F1', color: '#1D8D5E' },
  REJECTED: { background: '#FFF1EF', color: '#D34C4C' },
  WHATSAPP: { background: '#EBF9F1', color: '#1D8D5E' },
  IN_APP: { background: '#EAF2FF', color: '#4466B0' },
};

const sectionTones = {
  default: { backgroundColor: palette.surface, borderColor: palette.border },
  soft: { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
  accent: { backgroundColor: palette.surfaceTint, borderColor: '#C7F0E7' },
  forest: { backgroundColor: palette.surfaceSuccess, borderColor: '#CAEAD8' },
};

const focusTones = {
  forest: {
    backgroundColor: palette.surfaceSuccess,
    borderColor: '#CAEAD8',
    eyebrowColor: palette.success,
    titleColor: palette.ink,
    descriptionColor: palette.inkSoft,
  },
  accent: {
    backgroundColor: palette.surfaceTint,
    borderColor: '#C7F0E7',
    eyebrowColor: palette.accentDeep,
    titleColor: palette.ink,
    descriptionColor: palette.inkSoft,
  },
  soft: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    eyebrowColor: palette.mutedSoft,
    titleColor: palette.ink,
    descriptionColor: palette.inkSoft,
  },
};

function getBannerTone(tone) {
  const map = {
    info: { backgroundColor: '#E8F1FF', color: '#3263B0', borderColor: '#D1E3FF' },
    success: { backgroundColor: palette.surfaceSuccess, color: palette.success, borderColor: '#CAEAD8' },
    danger: { backgroundColor: palette.surfaceDanger, color: palette.danger, borderColor: '#F2D7D3' },
  };

  return map[tone] || map.info;
}

export function ScreenSurface({ children, bottomBar = null, hero = null }) {
  return (
    <View style={styles.screenShell}>
      <View style={styles.screenHero}>
        <View style={[styles.heroShape, styles.heroShapeLeft]} />
        <View style={[styles.heroShape, styles.heroShapeCenter]} />
        <View style={[styles.heroShape, styles.heroShapeRight]} />
        {hero ? <View style={styles.heroContent}>{hero}</View> : null}
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, bottomBar && styles.screenContentWithBottomBar]}
        showsVerticalScrollIndicator={false}
        bounces={false}
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
    secondary: { backgroundColor: palette.surface, color: palette.ink, borderColor: '#CBE8E1' },
    dark: { backgroundColor: palette.black, color: palette.white, borderColor: palette.black },
    ghost: { backgroundColor: 'transparent', color: palette.accentDeep, borderColor: 'transparent' },
    danger: { backgroundColor: palette.surfaceDanger, color: palette.danger, borderColor: '#F2D7D3' },
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
    backgroundColor: palette.backgroundWarm,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  screenHero: {
    height: 182,
    backgroundColor: palette.accent,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 34,
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
    top: 36,
  },
  heroShapeCenter: {
    left: 148,
    top: 12,
  },
  heroShapeRight: {
    right: -18,
    top: 44,
  },
  heroContent: {
    gap: 10,
  },
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    marginTop: -28,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  screenContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 42,
    gap: 18,
  },
  screenContentWithBottomBar: {
    paddingBottom: 120,
  },
  bottomBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 18,
    alignItems: 'center',
  },
  headerWrap: {
    gap: 8,
  },
  headerRow: {
    gap: 12,
  },
  headerCopy: {
    gap: 8,
  },
  eyebrow: {
    color: '#DFFBF6',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  heroTitle: {
    color: palette.white,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#D6FFF7',
    fontSize: 14,
    lineHeight: 21,
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  highlightText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  banner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  tabStrip: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: palette.border,
    width: '100%',
    shadowColor: '#2E5F58',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  tabCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCardActive: {
    backgroundColor: palette.accent,
  },
  tabLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: palette.white,
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
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    gap: 14,
    shadowColor: '#315A57',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
  },
  cardHeader: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: palette.ink,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: palette.muted,
  },
  cardBody: {
    gap: 14,
  },
  focusCard: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    gap: 10,
  },
  focusEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  focusTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  focusDescription: {
    fontSize: 14,
    lineHeight: 21,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: palette.ink,
    backgroundColor: palette.surface,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: '#A9ECDD',
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: 3,
  },
  choiceChipSelected: {
    borderColor: '#AEEBDD',
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
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
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
