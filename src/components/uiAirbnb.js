import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing as RNEasing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'qrcode';

import { spring as springTokens, timing as timingTokens, haptic } from '../lib/motion';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — premium palette, typography, elevation
// ─────────────────────────────────────────────────────────────────────────────

export const palette = {
  // Surfaces
  background: '#F4F6F8',
  backgroundWarm: '#F0F2F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9FB',
  surfaceTint: '#F0F0F5',
  surfaceSuccess: '#E8F8EE',
  surfaceWarning: '#FFF4E2',
  surfaceDanger: '#FFEDEA',
  surfaceInfo: '#E8F1FF',

  // Ink
  ink: '#0E1116',
  inkSoft: '#3A3F47',
  muted: '#6B7280',
  mutedSoft: '#A1A8B3',

  // Borders
  border: '#ECEEF2',
  borderStrong: '#DCE0E6',
  borderFocus: '#B0B0BC',

  // Accent (monochrome premium)
  accent: '#0B0E13',
  accentDeep: '#1A1A2E',
  accentSoft: '#E8E8EE',
  accentInk: '#FFFFFF',

  // Tones
  success: '#1FA463',
  warning: '#E29A2D',
  danger: '#EB5757',
  info: '#3B82F6',

  // Neutrals
  white: '#FFFFFF',
  black: '#0B0E13',
  overlay: 'rgba(11,14,19,0.45)',
};

export const typography = {
  displayLg: { fontSize: 36, lineHeight: 44, fontWeight: '800', letterSpacing: -0.5 },
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.3 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  titleSm: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bodySm: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
};

export const elevation = {
  e1: Platform.select({
    ios: { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    android: { elevation: 2 },
    default: {},
  }),
  e2: Platform.select({
    ios: { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.07, shadowRadius: 16 },
    android: { elevation: 5 },
    default: {},
  }),
  e3: Platform.select({
    ios: { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 28 },
    android: { elevation: 10 },
    default: {},
  }),
};

const statusTone = {
  VACANT: { background: '#E8F8EE', color: '#127C53' },
  OCCUPIED: { background: '#E8F1FF', color: '#3263B0' },
  NOTICE: { background: '#FFF4E2', color: '#B97816' },
  ACTIVE: { background: '#E8F8EE', color: '#127C53' },
  INVITED: { background: '#EEEEF4', color: '#3A3A5C' },
  MOVE_OUT_SCHEDULED: { background: '#FFF4E2', color: '#B97816' },
  CLOSED: { background: '#EEF1F4', color: '#5A6270' },
  DUE: { background: '#FFF4E2', color: '#B97816' },
  OVERDUE: { background: '#FFEDEA', color: '#C9402F' },
  PAYMENT_SUBMITTED: { background: '#EEEEF4', color: '#3A3A5C' },
  PAID: { background: '#E8F8EE', color: '#127C53' },
  READY: { background: '#E8F8EE', color: '#127C53' },
  COMPLETE: { background: '#E8F8EE', color: '#127C53' },
  PENDING: { background: '#FFF4E2', color: '#B97816' },
  SCHEDULED: { background: '#E8F1FF', color: '#3263B0' },
  SENT: { background: '#E8F8EE', color: '#127C53' },
  FAILED: { background: '#FFEDEA', color: '#C9402F' },
  CANCELED: { background: '#EEF1F4', color: '#5A6270' },
  PENDING_REVIEW: { background: '#EEEEF4', color: '#3A3A5C' },
  APPROVED: { background: '#E8F8EE', color: '#127C53' },
  REJECTED: { background: '#FFEDEA', color: '#C9402F' },
  WHATSAPP: { background: '#E8F8EE', color: '#127C53' },
  IN_APP: { background: '#E8F1FF', color: '#3263B0' },
};

const sectionTones = {
  default: { backgroundColor: palette.surface, borderColor: palette.border },
  soft: { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
  accent: { backgroundColor: palette.surfaceTint, borderColor: '#DCDCEC' },
  forest: { backgroundColor: palette.surfaceSuccess, borderColor: '#CCEDD7' },
};

const focusTones = {
  forest: {
    backgroundColor: palette.surfaceSuccess,
    borderColor: '#CCEDD7',
    eyebrowColor: palette.success,
    titleColor: palette.ink,
    descriptionColor: palette.inkSoft,
  },
  accent: {
    backgroundColor: palette.surfaceTint,
    borderColor: '#DCDCEC',
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
    info: { backgroundColor: palette.surfaceInfo, color: '#3263B0', borderColor: '#D1E3FF' },
    success: { backgroundColor: palette.surfaceSuccess, color: palette.success, borderColor: '#CCEDD7' },
    danger: { backgroundColor: palette.surfaceDanger, color: palette.danger, borderColor: '#F4D2CD' },
  };
  return map[tone] || map.info;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated helpers
// ─────────────────────────────────────────────────────────────────────────────


// Shimmer overlay used on PrimaryButton during loading
function ShimmerOverlay({ active }) {
  const x = useSharedValue(-1);

  useEffect(() => {
    if (active) {
      x.value = -1;
      x.value = withRepeat(
        withTiming(1, { duration: 1100, easing: RNEasing.inOut(RNEasing.quad) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(x);
      x.value = -1;
    }
    return () => cancelAnimation(x);
  }, [active, x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(x.value, [-1, 1], [-220, 220]) }],
    opacity: active ? 0.55 : 0,
  }));

  if (!active) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.shimmerWrap, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.shimmer}
      />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout primitives
// ─────────────────────────────────────────────────────────────────────────────

export function ScreenSurface({ children, bottomBar = null, hero = null, refreshControl = null }) {
  return (
    <KeyboardAvoidingView
      style={styles.screenShell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, bottomBar && styles.screenContentWithBottomBar]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {hero ? <View style={styles.heroContent}>{hero}</View> : null}
        {children}
      </ScrollView>
      {bottomBar ? <View style={styles.bottomBarWrap}>{bottomBar}</View> : null}
    </KeyboardAvoidingView>
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
        {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone="secondary" compact /> : null}
      </View>
    </View>
  );
}

const BANNER_ICONS = { info: 'ⓘ', success: '✓', warning: '!', danger: '⚠' };

export function Banner({ message, tone = 'info' }) {
  const colors = getBannerTone(tone);
  const opacity = useSharedValue(0);
  const ty = useSharedValue(-6);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: timingTokens.base });
    ty.value = withSpring(0, springTokens.gentle);
  }, [message, tone, opacity, ty]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  const icon = BANNER_ICONS[tone] || BANNER_ICONS.info;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor },
        style,
      ]}
    >
      <View style={[styles.bannerIcon, { backgroundColor: colors.color }]}>
        <Text style={styles.bannerIconText}>{icon}</Text>
      </View>
      <Text style={[styles.bannerText, { color: colors.color }]}>{message}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabStrip — animated sliding pill indicator
// ─────────────────────────────────────────────────────────────────────────────

export function TabStrip({ tabs, activeTab, onChange }) {
  const [layout, setLayout] = useState({ width: 0 });
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.value === activeTab));
  const indicatorX = useSharedValue(0);

  // Tab width = (containerWidth - padding*2 - gaps) / tabs.length
  const padding = 6;
  const gap = 4;
  const containerWidth = layout.width;
  const tabWidth =
    containerWidth > 0
      ? (containerWidth - padding * 2 - gap * (tabs.length - 1)) / tabs.length
      : 0;

  useEffect(() => {
    if (tabWidth > 0) {
      indicatorX.value = withSpring(activeIndex * (tabWidth + gap), springTokens.indicator);
    }
  }, [activeIndex, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View style={styles.tabStrip} onLayout={(e) => setLayout({ width: e.nativeEvent.layout.width })}>
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabIndicator,
            { width: tabWidth, left: padding, top: padding, bottom: padding },
            indicatorStyle,
          ]}
        />
      ) : null}
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <Pressable
            key={tab.value}
            onPress={() => {
              haptic.selection();
              onChange(tab.value);
            }}
            android_ripple={{
              color: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(11,14,19,0.08)',
              borderless: false,
            }}
            style={({ pressed }) => [styles.tabCard, pressed && styles.pressedScale]}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

function useEntryAnimation(delay = 0) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(12);
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: timingTokens.base }));
    ty.value = withDelay(delay, withSpring(0, springTokens.gentle));
  }, [delay, opacity, ty]);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));
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

export function SectionCard({ title, subtitle, tone = 'default', children, delay = 0 }) {
  const toneStyles = sectionTones[tone] || sectionTones.default;
  const entryStyle = useEntryAnimation(delay);

  return (
    <Animated.View style={[styles.card, toneStyles, entryStyle]}>
      {(title || subtitle) ? (
        <View style={styles.cardHeader}>
          {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </Animated.View>
  );
}

export function FocusCard({ eyebrow, title, description, tone = 'forest', actionLabel, onAction, children }) {
  const toneStyles = focusTones[tone] || focusTones.forest;
  const actionTone = tone === 'accent' ? 'primary' : 'secondary';
  const entryStyle = useEntryAnimation(0);

  return (
    <Animated.View
      style={[
        styles.focusCard,
        { backgroundColor: toneStyles.backgroundColor, borderColor: toneStyles.borderColor },
        entryStyle,
      ]}
    >
      {eyebrow ? <Text style={[styles.focusEyebrow, { color: toneStyles.eyebrowColor }]}>{eyebrow}</Text> : null}
      <Text style={[styles.focusTitle, { color: toneStyles.titleColor }]}>{title}</Text>
      {description ? <Text style={[styles.focusDescription, { color: toneStyles.descriptionColor }]}>{description}</Text> : null}
      {children ? <View style={styles.focusContent}>{children}</View> : null}
      {actionLabel ? <PrimaryButton label={actionLabel} onPress={onAction} tone={actionTone} /> : null}
    </Animated.View>
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
      {items.map((item, index) => (
        <ActionCard key={item.title} item={item} delay={60 * index} />
      ))}
    </View>
  );
}

function ActionCard({ item, delay }) {
  const scale = useSharedValue(1);
  const entry = useEntryAnimation(delay);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.actionCardWrap, entry, animatedStyle]}>
      <Pressable
        onPress={() => {
          haptic.light();
          item.onPress?.();
        }}
        onPressIn={() => { scale.value = withSpring(0.97, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={{ color: 'rgba(11,14,19,0.08)', borderless: false }}
        style={[
          styles.actionCard,
          item.tone === 'accent' && styles.actionCardAccent,
          item.tone === 'forest' && styles.actionCardForest,
        ]}
      >
        {item.eyebrow ? <Text style={styles.actionEyebrow}>{item.eyebrow}</Text> : null}
        <Text style={styles.actionTitle}>{item.title}</Text>
        <Text style={styles.actionDescription}>{item.description}</Text>
        {item.label ? <Text style={styles.actionLink}>{item.label}  ›</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export function MetricRow({ items }) {
  return (
    <View style={styles.metricRow}>
      {items.map((item, index) => (
        <MetricCard key={item.label} item={item} delay={50 * index} />
      ))}
    </View>
  );
}

function MetricCard({ item, delay }) {
  const entry = useEntryAnimation(delay);
  return (
    <Animated.View style={[styles.metricCard, entry]}>
      <Text style={styles.metricValue}>{item.value}</Text>
      <Text style={styles.metricLabel}>{item.label}</Text>
    </Animated.View>
  );
}

export function StatusBadge({ label }) {
  const colors = statusTone[label] || { background: '#EEF1F4', color: palette.muted };
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

// ─────────────────────────────────────────────────────────────────────────────
// Field — floating label + focus ring + error shake
// ─────────────────────────────────────────────────────────────────────────────

export const Field = forwardRef(function Field(
  {
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType,
    multiline = false,
    secureTextEntry = false,
    autoCapitalize,
    autoComplete,
    autoCorrect,
    textContentType,
    returnKeyType,
    onSubmitEditing,
    blurOnSubmit,
    error,
    helperText,
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error);
  const helper = hasError ? error : helperText;
  const errorShake = useSharedValue(0);
  const focusGlow = useSharedValue(0);
  const prevError = useRef(error);

  useEffect(() => {
    focusGlow.value = withTiming(isFocused && !hasError ? 1 : 0, { duration: timingTokens.fast });
  }, [isFocused, hasError, focusGlow]);

  useEffect(() => {
    if (error && error !== prevError.current) {
      errorShake.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(-4, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      );
      haptic.error();
    }
    prevError.current = error;
  }, [error, errorShake]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: errorShake.value }],
  }));

  const inputAnimatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(focusGlow.value, [0, 1], [0, 0.15]),
    shadowRadius: interpolate(focusGlow.value, [0, 1], [0, 14]),
  }));

  return (
    <Animated.View style={[styles.fieldWrap, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Animated.View style={inputAnimatedStyle}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          selectionColor={palette.accent}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            isFocused && !hasError && styles.inputFocused,
            hasError && styles.inputError,
          ]}
        />
      </Animated.View>
      {helper ? (
        <Text style={[styles.fieldHelper, hasError && styles.fieldHelperError]}>{helper}</Text>
      ) : null}
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ChoiceChips — animated check, spring scale, haptic
// ─────────────────────────────────────────────────────────────────────────────

export function ChoiceChips({ options, value, onChange }) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => (
        <ChoiceChip
          key={option.value}
          option={option}
          selected={option.value === value}
          onPress={() => {
            haptic.selection();
            onChange(option.value);
          }}
        />
      ))}
    </View>
  );
}

function ChoiceChip({ option, selected, onPress }) {
  const scale = useSharedValue(1);
  const select = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    select.value = withSpring(selected ? 1 : 0, springTokens.bouncy);
  }, [selected, select]);

  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: select.value,
    transform: [{ scale: interpolate(select.value, [0, 1], [0.5, 1]) }],
  }));

  return (
    <Animated.View style={[styles.choiceChipWrap, wrap]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={{ color: 'rgba(11,14,19,0.08)', borderless: false }}
        style={[styles.choiceChip, selected && styles.choiceChipSelected]}
      >
        <View style={styles.choiceChipBody}>
          <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{option.label}</Text>
          {option.meta ? (
            <Text style={[styles.choiceMeta, selected && styles.choiceMetaSelected]}>{option.meta}</Text>
          ) : null}
        </View>
        <Animated.View style={[styles.choiceCheck, checkStyle]}>
          <Text style={styles.choiceCheckText}>✓</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PrimaryButton — spring press, shimmer-on-loading, disabled fade
// ─────────────────────────────────────────────────────────────────────────────

export function PrimaryButton({ label, onPress, tone = 'primary', disabled = false, compact = false, loading = false }) {
  const tones = {
    primary: { backgroundColor: palette.accent, color: palette.white, borderColor: palette.accent },
    secondary: { backgroundColor: palette.surface, color: palette.ink, borderColor: palette.borderStrong },
    dark: { backgroundColor: palette.black, color: palette.white, borderColor: palette.black },
    ghost: { backgroundColor: 'transparent', color: palette.accentDeep, borderColor: 'transparent' },
    danger: { backgroundColor: palette.danger, color: palette.white, borderColor: palette.danger },
  };
  const colors = tones[tone] || tones.primary;
  const isLocked = disabled || loading;
  const rippleColor = tone === 'secondary' || tone === 'ghost'
    ? 'rgba(11,14,19,0.10)'
    : 'rgba(255,255,255,0.22)';

  const scale = useSharedValue(1);
  const wrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    haptic.light();
    onPress?.();
  };

  return (
    <Animated.View style={[wrapStyle, compact ? null : styles.buttonShellFull]}>
      <Pressable
        onPress={handlePress}
        disabled={isLocked}
        onPressIn={() => { if (!isLocked) scale.value = withSpring(0.97, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={isLocked ? undefined : { color: rippleColor, borderless: false }}
        style={[
          styles.button,
          compact && styles.buttonCompact,
          {
            backgroundColor: isLocked ? '#EEF1F4' : colors.backgroundColor,
            borderColor: isLocked ? '#E1E5EA' : colors.borderColor,
          },
          isLocked && styles.buttonDisabled,
          tone === 'primary' && !isLocked && elevation.e2,
        ]}
      >
        <ShimmerOverlay active={loading && !disabled} />
        {loading ? (
          <ActivityIndicator
            size="small"
            color={tone === 'secondary' || tone === 'ghost' ? palette.accentDeep : palette.white}
          />
        ) : (
          <Text
            style={[
              styles.buttonText,
              compact && styles.buttonTextCompact,
              { color: isLocked ? palette.mutedSoft : colors.color },
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function EmptyState({ title, description, icon = '✨' }) {
  const entry = useEntryAnimation(0);
  return (
    <Animated.View style={[styles.emptyState, entry]}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>{icon}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
    </Animated.View>
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
      color: { dark: '#0E1116', light: '#FFFFFF' },
    })
      .then((nextUri) => { if (active) setUri(nextUri); })
      .catch(() => { if (active) setUri(null); });
    return () => { active = false; };
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

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenShell: {
    flex: 1,
    backgroundColor: palette.background,
    width: '100%',
    ...Platform.select({ web: { maxWidth: 460, alignSelf: 'center' }, default: {} }),
    overflow: 'hidden',
  },
  heroContent: { gap: 6, paddingBottom: 4 },
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screenContent: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : 4,
    paddingBottom: 42,
    gap: 18,
  },
  screenContentWithBottomBar: { paddingBottom: 132 },
  bottomBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    paddingHorizontal: 18,
    paddingBottom: 18,
    alignItems: 'center',
  },
  headerWrap: { gap: 8 },
  headerRow: { gap: 12 },
  headerCopy: { gap: 8 },
  eyebrow: {
    color: palette.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '800',
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  highlightWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  highlightPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  highlightText: { color: palette.white, fontSize: 12, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 10,
  },
  bannerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconText: { fontSize: 13, fontWeight: '900', color: palette.white, lineHeight: 16 },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' },

  // Tab strip
  tabStrip: {
    position: 'relative',
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    width: '100%',
    ...elevation.e2,
  },
  tabIndicator: {
    position: 'absolute',
    backgroundColor: palette.accent,
    borderRadius: 18,
  },
  tabCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabLabel: { color: palette.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  tabLabelActive: { color: palette.white },

  searchCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    ...elevation.e1,
  },
  searchClusterContent: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  searchSegment: { flexGrow: 1, minWidth: 120, paddingHorizontal: 16, paddingVertical: 8, gap: 2 },
  searchSegmentLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: palette.ink },
  searchSegmentValue: { fontSize: 14, lineHeight: 20, color: palette.muted },
  searchDivider: { width: 1, height: 28, backgroundColor: palette.border },

  card: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    gap: 14,
    ...elevation.e1,
  },
  cardHeader: { gap: 6 },
  cardTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: palette.ink, letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 14, lineHeight: 21, color: palette.muted },
  cardBody: { gap: 14, alignSelf: 'stretch', width: '100%' },

  focusCard: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    gap: 10,
    ...elevation.e1,
  },
  focusEyebrow: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  focusTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.3 },
  focusDescription: { fontSize: 14, lineHeight: 21 },
  focusContent: { gap: 10 },

  featureCard: {
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    ...elevation.e2,
  },
  featureImage: { width: '100%', height: 220 },
  featureContent: { padding: 20, gap: 10 },
  featureEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featureTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: palette.ink, letterSpacing: -0.3 },
  featureDescription: { fontSize: 15, lineHeight: 24, color: palette.muted },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCardWrap: { width: '48%', minWidth: 170, borderRadius: 24 },
  actionCard: {
    width: '100%',
    padding: 18,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
    overflow: 'hidden',
    ...elevation.e1,
  },
  actionCardAccent: { backgroundColor: palette.surfaceTint, borderColor: '#DCDCEC' },
  actionCardForest: { backgroundColor: palette.surfaceSuccess, borderColor: '#CCEDD7' },
  actionEyebrow: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  actionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', lineHeight: 24, letterSpacing: -0.2 },
  actionDescription: { color: palette.muted, lineHeight: 22 },
  actionLink: { color: palette.accentDeep, fontWeight: '700' },

  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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
    ...elevation.e1,
  },
  metricValue: { color: palette.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  metricLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  statusLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  keyValueRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  keyLabel: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  keyValue: { color: palette.ink, fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  fieldWrap: { gap: 8, alignSelf: 'stretch', width: '100%' },
  fieldLabel: { color: palette.ink, fontWeight: '700', fontSize: 13, letterSpacing: 0.1 },
  input: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: palette.ink,
    backgroundColor: palette.surface,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: palette.borderFocus,
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 0 },
  },
  inputError: { borderColor: palette.danger, backgroundColor: palette.surfaceDanger },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  fieldHelper: { fontSize: 12, lineHeight: 16, color: palette.muted, marginTop: 2 },
  fieldHelperError: { color: palette.danger, fontWeight: '700' },

  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignSelf: 'stretch', width: '100%' },
  choiceChipWrap: { flexGrow: 1, minWidth: 140 },
  choiceChip: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choiceChipBody: { flex: 1, gap: 3 },
  choiceChipSelected: { borderColor: palette.borderStrong, backgroundColor: palette.surfaceMuted },
  choiceTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  choiceTitleSelected: { color: palette.ink },
  choiceMeta: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  choiceMetaSelected: { color: palette.inkSoft },
  choiceCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceCheckText: { color: palette.white, fontSize: 13, fontWeight: '900', lineHeight: 14 },

  buttonShellFull: { alignSelf: 'stretch', width: '100%' },
  button: {
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonCompact: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  buttonTextCompact: { fontSize: 13 },
  buttonDisabled: { opacity: 0.85 },

  shimmerWrap: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    overflow: 'hidden',
  },
  shimmer: { flex: 1 },

  emptyState: {
    paddingVertical: 22,
    paddingHorizontal: 4,
    gap: 10,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceTint,
    borderWidth: 1,
    borderColor: '#DCDCEC',
  },
  emptyIconText: { fontSize: 24, lineHeight: 28 },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { color: palette.muted, lineHeight: 22, textAlign: 'center' },
  inlineGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },

  qrCard: {
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    ...elevation.e1,
  },
  qrCanvasWrap: {
    width: 240,
    height: 240,
    borderRadius: 24,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: { width: 220, height: 220 },
  qrPlaceholder: { width: 220, height: 220, borderRadius: 20, backgroundColor: palette.surfaceMuted },
  qrTitle: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  qrSubtitle: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  pressedScale: { transform: [{ scale: 0.985 }] },
});
