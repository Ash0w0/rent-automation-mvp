import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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

import {
  Banner,
  ChoiceChips,
  EmptyState,
  Field,
  FocusCard,
  InlineGroup,
  KeyValueRow,
  MetricRow,
  PageHeader,
  PrimaryButton,
  ScreenSurface,
  SectionCard,
  StatusBadge,
  TabStrip,
  elevation,
  palette,
} from '../components/uiAirbnb';
import { useToast } from '../components/ToastHost';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { pickImageUpload } from '../lib/imageUploads';
import { TempPasswordShareModal } from '../components/TempPasswordShareModal';
import { QuestionWizard } from '../components/QuestionWizard';
import { SettingsScreen } from './SettingsScreen';
import { spring as springTokens, haptic, staggerDelay } from '../lib/motion';

const { compareIsoDates, formatCurrency, formatDate, formatMonth, parseIsoDate } = require('../lib/dateUtils');
const { resolveUploadUrl } = require('../lib/apiClient');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const ownerTabs = [
  { label: 'Home', value: 'home' },
  { label: 'Rooms', value: 'rooms' },
  { label: 'Rent', value: 'rent' },
  { label: 'Profile', value: 'profile' },
];

const residentModes = [
  { label: 'Add room', value: 'inventory' },
  { label: 'Invite tenant', value: 'invite' },
  { label: 'Complete move-in', value: 'activate' },
  { label: 'Room list', value: 'rooms' },
  { label: 'Move out', value: 'moveout' },
];

const rentModes = [
  { label: 'Track dues', value: 'ledger' },
  { label: 'Final approvals', value: 'payment-review' },
];

const profileModes = [
  { label: 'Property', value: 'property' },
  { label: 'Payouts', value: 'collection' },
];

const roomStatusThemes = {
  paid: {
    label: 'Paid',
    backgroundColor: '#EAF8EE',
    borderColor: '#BCE8C9',
    color: '#107A45',
    gradientStart: '#EAF8EE',
    gradientEnd: '#D4F2E0',
  },
  due: {
    label: 'Due',
    backgroundColor: '#FFF4CF',
    borderColor: '#F0D375',
    color: '#9B6D00',
    gradientStart: '#FFF4CF',
    gradientEnd: '#FAEEA0',
  },
  review: {
    label: 'Review',
    backgroundColor: '#FFF8DE',
    borderColor: '#F1D98B',
    color: '#8D6500',
    gradientStart: '#FFF8DE',
    gradientEnd: '#FFF0C0',
  },
  overdue: {
    label: 'Overdue',
    backgroundColor: '#FFE8E4',
    borderColor: '#F2B8AE',
    color: '#B42318',
    gradientStart: '#FFE8E4',
    gradientEnd: '#FFD0CA',
  },
  vacant: {
    label: 'Vacant',
    backgroundColor: '#F4F7F8',
    borderColor: '#DDE7E9',
    color: '#667085',
    gradientStart: '#F4F7F8',
    gradientEnd: '#E8EDF0',
  },
};

const roomStatusLegend = [
  { key: 'paid', label: 'Paid' },
  { key: 'review', label: 'To review' },
  { key: 'overdue', label: 'Overdue' },
];

// ---------------------------------------------------------------------------
// Animated primitives
// ---------------------------------------------------------------------------

function FloatingShape({ style, delay = 0, distance = 8, duration = 4400 }) {
  const offset = useSharedValue(0);
  useEffect(() => {
    offset.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: RNEasing.inOut(RNEasing.quad) }),
          withTiming(0, { duration, easing: RNEasing.inOut(RNEasing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(offset);
  }, [delay, duration, offset]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: '45deg' },
      { translateY: interpolate(offset.value, [0, 1], [0, -distance]) },
      { translateX: interpolate(offset.value, [0, 1], [0, distance / 2]) },
    ],
  }));
  return <Animated.View style={[style, animatedStyle]} pointerEvents="none" />;
}

function useEntryAnimation(delay = 0) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(18);
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 320 }));
    ty.value = withDelay(delay, withSpring(0, springTokens.gentle));
  }, [delay, opacity, ty]);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));
}

// Animated count-up number
function AnimatedAmount({ value, style, prefix = '₹', suffix = '' }) {
  const frameRef = useRef(null);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = Date.now();
    const duration = 900;
    const startVal = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value]);
  return (
    <Text style={style}>{prefix}{display.toLocaleString('en-IN')}{suffix}</Text>
  );
}

// Stat tile with animated entrance and large value
function AnimatedStatTile({ label, value, accent = false, delay = 0, isCount = true }) {
  const anim = useEntryAnimation(delay);
  return (
    <Animated.View style={[styles.statTile, accent && styles.statTileAccent, anim]}>
      {accent ? (
        <LinearGradient
          colors={['#1A1A2E', '#0B0E13']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text style={[styles.statTileValue, accent && styles.statTileValueAccent]}>
        {isCount ? String(value) : value}
      </Text>
      <Text style={[styles.statTileLabel, accent && styles.statTileLabelAccent]}>{label}</Text>
    </Animated.View>
  );
}

// Queue item card with staggered slide-in and spring press
function AnimatedQueueItem({ item, index }) {
  const anim = useEntryAnimation(staggerDelay(index, 60));
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[anim, pressStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        onPress={() => { haptic.light(); item.onPress?.(); }}
        android_ripple={{ color: 'rgba(11,14,19,0.08)', borderless: false }}
        style={styles.queueItem}
      >
        <View style={styles.queueCopy}>
          <InlineGroup>
            <Text style={styles.queueTitle}>{item.title}</Text>
            {item.badge ? <StatusBadge label={item.badge} /> : null}
          </InlineGroup>
          {item.description ? <Text style={styles.queueDescription}>{item.description}</Text> : null}
          {item.meta ? <Text style={styles.queueMeta}>{item.meta}</Text> : null}
        </View>
        <View style={styles.queueChevron}>
          <Text style={styles.queueChevronText}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Pipeline step with animated active state
function AnimatedPipelineStep({ action, isActive, onPress }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const anim = useEntryAnimation(staggerDelay(Number(action.step) - 1, 70));

  return (
    <Animated.View style={[anim, pressStyle]}>
      <Pressable
        onPress={() => { haptic.light(); onPress?.(); }}
        onPressIn={() => { scale.value = withSpring(0.97, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={{ color: 'rgba(11,14,19,0.08)', borderless: false }}
        style={[styles.pipelineStep, isActive && styles.pipelineStepActive]}
      >
        {isActive ? (
          <LinearGradient
            colors={['#F0F0F5', '#E8E8EF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
          />
        ) : null}
        <View style={[styles.pipelineStepNumber, isActive && styles.pipelineStepNumberActive]}>
          <Text style={[styles.pipelineStepNumberText, isActive && styles.pipelineStepNumberTextActive]}>
            {action.step}
          </Text>
        </View>
        <View style={styles.pipelineStepCopy}>
          <View style={styles.pipelineStepTitleRow}>
            <Text style={[styles.pipelineStepTitle, isActive && styles.pipelineStepTitleActive]}>
              {action.title}
            </Text>
            {isActive ? (
              <View style={styles.openBadge}>
                <Text style={styles.openBadgeText}>OPEN</Text>
              </View>
            ) : null}
          </View>
          {action.meta ? <Text style={styles.pipelineStepMeta}>{action.meta}</Text> : null}
        </View>
        <Text style={[styles.pipelineChevron, isActive && styles.pipelineChevronActive]}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

// Room tile with gradient background and spring scale
function AnimatedRoomTile({ item, index }) {
  const theme = roomStatusThemes[item.statusKind] || roomStatusThemes.vacant;
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const anim = useEntryAnimation(staggerDelay(index, 40));

  return (
    <Animated.View style={[styles.roomTileWrap, anim, pressStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.95, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
        style={styles.roomTilePressable}
      >
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 14, borderWidth: 1, borderColor: theme.borderColor }]}
        />
        <View style={styles.roomTileHeader}>
          <Text style={styles.roomTileNumber}>{item.roomLabel}</Text>
          <View style={[styles.roomTileStatusPill, { backgroundColor: theme.color }]}>
            <Text style={styles.roomTileStatusText}>{item.statusLabel}</Text>
          </View>
        </View>
        <Text style={styles.roomTileTenant} numberOfLines={1}>{item.tenantName}</Text>
        {item.amountLabel ? (
          <Text style={[styles.roomTileAmount, { color: theme.color }]}>{item.amountLabel}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// Rent focus hero card (gradient, pulsing CTA)
function RentFocusHero({ title, description, actionLabel, onPress, isAllClear = false }) {
  const anim = useEntryAnimation(0);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const colors = isAllClear
    ? ['#1A1A2E', '#0B0E13']
    : ['#1A1A2E', '#16213E'];

  return (
    <Animated.View style={[anim, pressStyle]}>
      <Pressable
        onPress={() => { haptic.light(); onPress?.(); }}
        onPressIn={() => { scale.value = withSpring(0.97, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: false }}
        style={styles.rentFocusCard}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
        />
        <FloatingShape style={styles.heroShapeLeft} delay={0} distance={10} />
        <FloatingShape style={styles.heroShapeRight} delay={500} distance={12} duration={5200} />
        <View style={styles.rentFocusContent}>
          {isAllClear ? (
            <View style={styles.rentFocusCheckCircle}>
              <Text style={styles.rentFocusCheckText}>✓</Text>
            </View>
          ) : null}
          <Text style={styles.rentFocusTitle}>{title}</Text>
          {description ? <Text style={styles.rentFocusDescription}>{description}</Text> : null}
        </View>
        <View style={styles.rentFocusCta}>
          <Text style={styles.rentFocusCtaText}>{actionLabel}</Text>
          <Text style={styles.rentFocusCtaChevron}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Management action card (rooms/moveout selector)
function ManagementActionCard({ action, isActive }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPress={() => { haptic.light(); action.onPress?.(); }}
        onPressIn={() => { scale.value = withSpring(0.97, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={{ color: 'rgba(11,14,19,0.08)', borderless: false }}
        style={[styles.managementCard, isActive && styles.managementCardActive]}
      >
        {isActive ? (
          <LinearGradient
            colors={['#F0F0F5', '#E8E8EF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
          />
        ) : null}
        <View style={styles.managementCopy}>
          <View style={styles.pipelineStepTitleRow}>
            <Text style={styles.managementTitle}>{action.title}</Text>
            {isActive ? (
              <View style={styles.openBadge}>
                <Text style={styles.openBadgeText}>OPEN</Text>
              </View>
            ) : null}
          </View>
          {action.meta ? <Text style={styles.managementMeta}>{action.meta}</Text> : null}
        </View>
        <Text style={[styles.pipelineChevron, isActive && styles.pipelineChevronActive]}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

// Payment review card with approve/reject
function PaymentReviewCard({ submission, invoice, tenant, room, meterReading, onApprove, onReject, onEditReading }) {
  const anim = useEntryAnimation(0);
  return (
    <Animated.View style={[styles.paymentCard, anim]}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F8FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
      />
      <View style={styles.paymentCardHeader}>
        <View style={styles.paymentCardHeaderLeft}>
          <Text style={styles.paymentCardRoom}>Room {room?.label || '-'}</Text>
          <Text style={styles.paymentCardTenant}>{tenant?.fullName || 'Tenant'}</Text>
        </View>
        <View style={styles.paymentCardBadgeWrap}>
          <StatusBadge label={submission.status} />
        </View>
      </View>

      {invoice ? (
        <View style={styles.paymentAmountRow}>
          <View style={styles.paymentAmountBlock}>
            <Text style={styles.paymentAmountLabel}>Total</Text>
            <Text style={styles.paymentAmountValue}>{formatCurrency(invoice.totalAmount)}</Text>
          </View>
          <View style={styles.paymentAmountDivider} />
          <View style={styles.paymentAmountBlock}>
            <Text style={styles.paymentAmountLabel}>Rent</Text>
            <Text style={styles.paymentAmountValue}>{formatCurrency(invoice.baseRent)}</Text>
          </View>
          <View style={styles.paymentAmountDivider} />
          <View style={styles.paymentAmountBlock}>
            <Text style={styles.paymentAmountLabel}>Electricity</Text>
            <Text style={styles.paymentAmountValue}>{formatCurrency(invoice.electricityCharge)}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.paymentMeta}>
        {invoice ? (
          <View style={styles.paymentMetaRow}>
            <Text style={styles.paymentMetaLabel}>Month</Text>
            <Text style={styles.paymentMetaValue}>{formatMonth(invoice.month)}</Text>
          </View>
        ) : null}
        {invoice ? (
          <View style={styles.paymentMetaRow}>
            <Text style={styles.paymentMetaLabel}>Due</Text>
            <Text style={styles.paymentMetaValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
        ) : null}
        {submission.utr ? (
          <View style={styles.paymentMetaRow}>
            <Text style={styles.paymentMetaLabel}>UTR</Text>
            <Text style={styles.paymentMetaValue}>{submission.utr}</Text>
          </View>
        ) : null}
        {meterReading ? (
          <View style={styles.paymentMetaRow}>
            <Text style={styles.paymentMetaLabel}>Meter</Text>
            <View style={styles.paymentMetaValueRow}>
              <Text style={styles.paymentMetaValue}>
                {meterReading.openingReading} → {meterReading.closingReading}{' '}
                ({meterReading.closingReading - meterReading.openingReading} units)
              </Text>
              {onEditReading ? (
                <Pressable onPress={() => onEditReading(meterReading)} style={styles.editReadingBtn}>
                  <Text style={styles.editReadingBtnText}>✎ Edit</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <UploadPreview
        title="Meter photo"
        subtitle={meterReading?.photoLabel || 'Meter proof'}
        uri={resolveUploadUrl(meterReading?.photoLabel)}
      />
      <UploadPreview
        title="Payment proof"
        subtitle={submission.screenshotLabel}
        uri={resolveUploadUrl(submission.screenshotLabel)}
      />

      <View style={styles.paymentActions}>
        <Pressable
          onPress={() => { haptic.success(); onApprove(); }}
          android_ripple={{ color: 'rgba(16,122,69,0.2)', borderless: false }}
          style={({ pressed }) => [styles.paymentApproveBtn, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient
            colors={['#107A45', '#0D6438']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
          />
          <Text style={styles.paymentApproveBtnText}>✓ Approve</Text>
        </Pressable>
        <Pressable
          onPress={() => { haptic.warning(); onReject(); }}
          android_ripple={{ color: 'rgba(180,35,24,0.2)', borderless: false }}
          style={({ pressed }) => [styles.paymentRejectBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.paymentRejectBtnText}>✗ Reject</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// UploadPreview
// ---------------------------------------------------------------------------
function UploadPreview({ title, subtitle, uri }) {
  if (!uri) return null;
  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>{title}</Text>
      {subtitle ? <Text style={styles.previewSubtitle}>{subtitle}</Text> : null}
      <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// RoomStatusBoard
// ---------------------------------------------------------------------------
function RoomStatusBoard({ title, items }) {
  return (
    <View style={styles.roomStatusBoard}>
      <View style={styles.roomStatusHeader}>
        <Text style={styles.roomStatusTitle}>{title}</Text>
        <Text style={styles.roomStatusCount}>{items.length} rooms</Text>
      </View>
      <View style={styles.roomStatusLegend}>
        {roomStatusLegend.map((legendItem) => {
          const theme = roomStatusThemes[legendItem.key];
          return (
            <View key={legendItem.key} style={styles.roomStatusLegendItem}>
              <View style={[styles.roomStatusDot, { backgroundColor: theme.color }]} />
              <Text style={styles.roomStatusLegendText}>{legendItem.label}</Text>
            </View>
          );
        })}
      </View>
      {items.length ? (
        <View style={styles.roomTileGrid}>
          {items.map((item, index) => (
            <AnimatedRoomTile key={item.roomId} item={item} index={index} />
          ))}
        </View>
      ) : (
        <Text style={styles.roomStatusEmpty}>No rooms yet.</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SetupTourCard — compact horizontal stepper
// ---------------------------------------------------------------------------
function SetupTourCard({ steps, onOpen }) {
  const completedCount = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done);

  return (
    <View style={styles.tourCard}>
      <LinearGradient
        colors={['#FFFFFF', '#F4F4F8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
      />

      {/* Top row: label + count pill */}
      <View style={styles.tourCardHeader}>
        <Text style={styles.tourCardEyebrow}>Setup tour</Text>
        <View style={styles.tourProgressCount}>
          <Text style={styles.tourProgressCountText}>{completedCount}/{steps.length}</Text>
        </View>
      </View>

      {/* Horizontal stepper */}
      <View style={styles.tourStepper}>
        {steps.map((step, index) => {
          const isNext = !step.done && (index === 0 || steps[index - 1].done);
          return (
            <React.Fragment key={step.key}>
              <View style={styles.tourDotCol}>
                <View style={[
                  styles.tourStepDot,
                  step.done && styles.tourStepDotDone,
                  isNext && styles.tourStepDotNext,
                ]}>
                  <Text style={[styles.tourStepDotText, step.done && styles.tourStepDotTextDone]}>
                    {step.done ? '✓' : index + 1}
                  </Text>
                </View>
                <Text style={[styles.tourDotLabel, step.done && styles.tourDotLabelDone]} numberOfLines={1}>
                  {step.short}
                </Text>
              </View>
              {index < steps.length - 1 ? (
                <View style={[styles.tourSegment, step.done && styles.tourSegmentDone]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      {/* CTA row */}
      <Pressable
        onPress={() => nextStep ? onOpen(nextStep) : onOpen({ tab: 'rent', mode: 'ledger' })}
        android_ripple={{ color: 'rgba(11,14,19,0.08)', borderless: false }}
        style={styles.tourCta}
      >
        <Text style={styles.tourCtaText}>
          {nextStep ? `Next: ${nextStep.title}` : 'All done — open rent'}
        </Text>
        <Text style={styles.tourCtaChevron}>›</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getDayDelta(referenceDate, targetDate) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((parseIsoDate(targetDate).getTime() - parseIsoDate(referenceDate).getTime()) / msPerDay);
}

function formatDueWindow(referenceDate, dueDate) {
  const delta = getDayDelta(referenceDate, dueDate);
  if (delta === 0) return 'Due today';
  if (delta > 0) return `Due in ${delta} day${delta === 1 ? '' : 's'}`;
  const overdueDays = Math.abs(delta);
  return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
}

// ---------------------------------------------------------------------------
// OwnerOnboarding
// ---------------------------------------------------------------------------
function OwnerOnboarding({ state, actions, onLogout }) {
  const toast = useToast();
  const [isBusy, setIsBusy] = useState(false);

  const onboardingSteps = [
    {
      key: 'name',
      question: 'What is the name of your property?',
      helper: 'This will appear on invoices and reminders.',
      placeholder: 'e.g. Lotus PG',
      required: true,
    },
    {
      key: 'address',
      question: 'What is the property address?',
      placeholder: 'Full street address',
      multiline: true,
      required: false,
    },
    {
      key: 'managerName',
      question: 'Your name (manager / owner)?',
      placeholder: 'Full name',
      defaultValue: state.owner?.name || '',
    },
    {
      key: 'managerPhone',
      question: 'Your contact phone number?',
      placeholder: 'Mobile number',
      keyboardType: 'phone-pad',
      defaultValue: state.owner?.phone || state.session?.phone || '',
    },
    {
      key: 'defaultTariff',
      question: 'What is your electricity rate per unit (₹)?',
      helper: 'e.g. 8.5 means ₹8.50 per kWh',
      placeholder: '8.5',
      keyboardType: 'decimal-pad',
      defaultValue: '8.5',
      validate: (v) => {
        const n = parseFloat(v);
        return (isNaN(n) || n <= 0) ? 'Enter a valid electricity rate.' : null;
      },
    },
    {
      key: 'payeeName',
      question: 'Who should tenants pay? (payee name)',
      placeholder: 'Name on UPI account',
      defaultValue: state.owner?.name || '',
    },
    {
      key: 'upiId',
      question: 'What is your UPI ID?',
      helper: 'Tenants will see this on their invoice.',
      placeholder: 'name@upi',
      required: false,
    },
  ];

  const handleComplete = async (values) => {
    setIsBusy(true);
    try {
      await actions.createProperty({
        name: values.name,
        address: values.address,
        managerName: values.managerName,
        managerPhone: values.managerPhone,
        defaultTariff: Number(values.defaultTariff),
        payeeName: values.payeeName,
        upiId: values.upiId,
        instructions: 'Use room number and month in your UPI note.',
      });
    } catch (error) {
      toast.show({ tone: 'danger', message: error.message });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.screenWrap}>
      <View style={styles.onboardingHero}>
        <Text style={styles.onboardingEyebrow}>Owner setup</Text>
        <Text style={styles.onboardingTitle}>Let's set up your property</Text>
        <Text style={styles.onboardingSubtitle}>Answer 7 quick questions to get started.</Text>
      </View>
      <QuestionWizard
        steps={onboardingSteps}
        onComplete={handleComplete}
        onExit={onLogout}
        isBusy={isBusy}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// OwnerWorkspaceMobile
// ---------------------------------------------------------------------------
export function OwnerWorkspaceMobile({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);
  const [residentMode, setResidentMode] = useState('rooms');
  const [rentMode, setRentMode] = useState('ledger');
  const [profileMode, setProfileMode] = useState('property');
  const toast = useToast();
  const property = state.property || {};
  const settlementAccount = state.settlementAccount || {};
  const propertyName = property.name || 'Property';
  const propertyAddress = property.address || '';
  const managerName = property.managerName || '';
  const managerPhone = property.managerPhone || '';
  const defaultTariff = property.defaultTariff ?? 0;
  const payeeName = settlementAccount.payeeName || '';
  const upiId = settlementAccount.upiId || 'UPI not set';
  const payoutInstructions = settlementAccount.instructions || '';
  const [propertyForm, setPropertyForm] = useState({
    name: propertyName,
    address: propertyAddress,
    managerName,
    managerPhone,
    defaultTariff: String(defaultTariff),
  });
  const [settlementForm, setSettlementForm] = useState({
    payeeName,
    upiId: settlementAccount.upiId || '',
    instructions: payoutInstructions,
  });
  const [roomForm, setRoomForm] = useState({ label: '', floor: '', serialNumber: '', openingReading: '0' });
  const [inviteForm, setInviteForm] = useState({ fullName: '', phone: '', roomId: '' });
  const [shareDetails, setShareDetails] = useState(null);
  const [contractForm, setContractForm] = useState({
    tenancyId: '',
    contractUploads: [],
    rentAmount: '',
    depositAmount: '',
    dueDay: '',
    moveInDate: '',
    contractStart: '',
    contractEnd: '',
  });
  const [moveOutForm, setMoveOutForm] = useState({ tenancyId: '', moveOutDate: state.referenceDate });
  const [tourTransition, setTourTransition] = useState(null);
  const prevNextKeyRef = useRef(null);
  const [addTenantStep, setAddTenantStep] = useState('room');
  const [addTenantForm, setAddTenantForm] = useState({
    isNewRoom: true, existingRoomId: '',
    label: '', floor: '1', serialNumber: '', openingReading: '0',
    fullName: '', phone: '',
    rentAmount: '', depositAmount: '', dueDay: '5',
    moveInDate: '', contractStart: '', contractEnd: '',
  });
  const [tenantEditTarget, setTenantEditTarget] = useState(null);
  const [tenantEditForm, setTenantEditForm] = useState({ fullName: '', phone: '' });
  const [editReadingTarget, setEditReadingTarget] = useState(null);
  const [editReadingValue, setEditReadingValue] = useState('');
  const [markPaidConfirmId, setMarkPaidConfirmId] = useState(null);

  const getTenant = (tenantId) => state.tenants.find((tenant) => tenant.id === tenantId);
  const getRoom = (roomId) => state.rooms.find((room) => room.id === roomId);
  const getMeter = (meterId) => state.roomMeters.find((meter) => meter.id === meterId);

  const invoices = useMemo(
    () =>
      [...state.invoices]
        .map((invoice) => ({ ...invoice, derivedStatus: deriveInvoiceStatus(invoice, state.referenceDate) }))
        .sort((left, right) => right.month.localeCompare(left.month)),
    [state.invoices, state.referenceDate],
  );

  const vacantRooms = state.rooms.filter((room) => room.status === 'VACANT');
  const invitedTenancies = state.tenancies.filter((tenancy) => tenancy.status === 'INVITED');
  const activeTenancies = state.tenancies.filter((tenancy) => ['ACTIVE', 'MOVE_OUT_SCHEDULED'].includes(tenancy.status));
  const pendingSubmissions = state.paymentSubmissions.filter((submission) => submission.status === 'PENDING_REVIEW');
  const dueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'DUE');
  const overdueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'OVERDUE');
  const unpaidInvoices = invoices.filter((invoice) =>
    ['DUE', 'OVERDUE', 'PAYMENT_SUBMITTED'].includes(invoice.derivedStatus),
  );
  const moveOutTenancies = activeTenancies
    .filter((tenancy) => tenancy.status === 'MOVE_OUT_SCHEDULED' && tenancy.moveOutDate)
    .sort((left, right) => compareIsoDates(left.moveOutDate, right.moveOutDate));

  const collectionWatch = unpaidInvoices
    .map((invoice) => {
      const tenant = getTenant(invoice.tenantId);
      const room = getRoom(invoice.roomId);
      const remindersForInvoice = state.reminders
        .filter((reminder) => reminder.invoiceId === invoice.id && reminder.deliveryStatus !== 'CANCELED')
        .sort((left, right) => compareIsoDates(right.triggerDate, left.triggerDate));
      const latestReminder = remindersForInvoice[0] || null;

      return {
        ...invoice,
        tenantName: tenant?.fullName || 'Tenant',
        roomLabel: room?.label || '-',
        dueWindow: formatDueWindow(state.referenceDate, invoice.dueDate),
        reminderState: latestReminder
          ? latestReminder.deliveryStatus === 'SENT'
            ? `Reminder sent on ${formatDate(latestReminder.triggerDate)}`
            : latestReminder.deliveryStatus === 'READY'
              ? `Reminder ready for ${formatDate(latestReminder.triggerDate)}`
              : `Reminder ${latestReminder.deliveryStatus.toLowerCase()}`
          : 'No reminder yet',
      };
    })
    .sort((left, right) => compareIsoDates(left.dueDate, right.dueDate));

  const latestInvoiceByRoomId = new Map();
  invoices.forEach((invoice) => {
    if (!latestInvoiceByRoomId.has(invoice.roomId)) {
      latestInvoiceByRoomId.set(invoice.roomId, invoice);
    }
  });

  const latestSubmissionByInvoiceId = new Map();
  [...state.paymentSubmissions]
    .sort((left, right) => String(right.submittedAt || '').localeCompare(String(left.submittedAt || '')))
    .forEach((submission) => {
      if (!latestSubmissionByInvoiceId.has(submission.invoiceId)) {
        latestSubmissionByInvoiceId.set(submission.invoiceId, submission);
      }
    });

  const roomStatusItems = [...state.rooms]
    .sort((left, right) => String(left.label).localeCompare(String(right.label), undefined, { numeric: true }))
    .map((room) => {
      const tenancy = state.tenancies.find(
        (record) => record.roomId === room.id && ['ACTIVE', 'MOVE_OUT_SCHEDULED', 'INVITED'].includes(record.status),
      );
      const latestInvoice = latestInvoiceByRoomId.get(room.id) || null;
      const latestSubmission = latestInvoice ? latestSubmissionByInvoiceId.get(latestInvoice.id) : null;
      const tenant = tenancy ? getTenant(tenancy.tenantId) : latestInvoice ? getTenant(latestInvoice.tenantId) : null;
      let statusKind = room.status === 'VACANT' ? 'vacant' : 'paid';
      let statusLabel = room.status === 'VACANT' ? 'Vacant' : 'Up to date';

      if (latestSubmission?.status === 'REJECTED') {
        statusKind = 'overdue';
        statusLabel = 'Rejected';
      } else if (latestInvoice?.derivedStatus === 'OVERDUE') {
        statusKind = 'overdue';
        statusLabel = 'Overdue';
      } else if (latestSubmission?.status === 'PENDING_REVIEW' || latestInvoice?.derivedStatus === 'PAYMENT_SUBMITTED') {
        statusKind = 'review';
        statusLabel = 'Review';
      } else if (latestInvoice && ['DUE', 'ISSUED'].includes(latestInvoice.derivedStatus)) {
        statusKind = 'due';
        statusLabel = 'Due';
      } else if (latestInvoice?.derivedStatus === 'PAID') {
        statusKind = 'paid';
        statusLabel = 'Paid';
      } else if (tenancy?.status === 'INVITED') {
        statusKind = 'due';
        statusLabel = 'Move-in';
      }

      return {
        roomId: room.id,
        roomLabel: room.label,
        tenantName: tenant?.fullName || (room.status === 'VACANT' ? 'Open room' : 'Resident pending'),
        statusKind,
        statusLabel,
        amountLabel: latestInvoice ? formatCurrency(latestInvoice.totalAmount) : '',
      };
    });

  useEffect(() => {
    setPropertyForm({
      name: propertyName,
      address: propertyAddress,
      managerName,
      managerPhone,
      defaultTariff: String(defaultTariff),
    });
  }, [defaultTariff, managerName, managerPhone, propertyAddress, propertyName]);

  useEffect(() => {
    setSettlementForm({
      payeeName,
      upiId: settlementAccount.upiId || '',
      instructions: payoutInstructions,
    });
  }, [payeeName, payoutInstructions, settlementAccount.upiId]);

  useEffect(() => {
    if (!inviteForm.roomId && vacantRooms[0]) {
      setInviteForm((current) => ({ ...current, roomId: vacantRooms[0].id }));
    }
  }, [inviteForm.roomId, vacantRooms]);

  useEffect(() => {
    if (!contractForm.tenancyId && invitedTenancies[0]) {
      setContractForm((current) => ({ ...current, tenancyId: invitedTenancies[0].id }));
    }
  }, [contractForm.tenancyId, invitedTenancies]);

  useEffect(() => {
    if (!moveOutForm.tenancyId && activeTenancies[0]) {
      setMoveOutForm((current) => ({ ...current, tenancyId: activeTenancies[0].id }));
    }
  }, [moveOutForm.tenancyId, activeTenancies]);

  const summary = {
    occupiedRooms: state.rooms.filter((room) => room.status === 'OCCUPIED').length,
    availableRooms: vacantRooms.length,
    dueInvoices: dueInvoices.length,
    overdueInvoices: overdueInvoices.length,
    finalApprovals: pendingSubmissions.length,
    livingNow: activeTenancies.length,
    leavingSoon: moveOutTenancies.length,
    unpaidNow: collectionWatch.length,
  };

  const heroCopy = {
    home: {
      eyebrow: 'Landlord',
      title: propertyName,
      subtitle: '',
      highlights: [
        `${summary.availableRooms} open rooms`,
        `${summary.finalApprovals} final approvals`,
        `${summary.overdueInvoices} overdue`,
      ],
    },
    rooms: {
      eyebrow: 'Rooms',
      title: 'Rooms',
      subtitle: '',
      highlights: [`${activeTenancies.length} active`, `${invitedTenancies.length} waiting`, `${vacantRooms.length} open`],
    },
    rent: {
      eyebrow: 'Rent',
      title: 'Rent',
      subtitle: '',
      highlights: [
        `${pendingSubmissions.length} final approvals`,
        `${dueInvoices.length} due`,
        `${overdueInvoices.length} overdue`,
      ],
    },
    profile: {
      eyebrow: 'Profile',
      title: 'Profile',
      subtitle: '',
      highlights: [upiId, `${state.rooms.length} rooms`, `${defaultTariff}/unit`],
    },
  }[activeTab];

  const openTask = (task) => {
    setActiveTab(task.tab);
    if (task.tab === 'rent') setRentMode(task.mode);
    if (task.tab === 'rooms') setResidentMode(task.mode);
    if (task.tab === 'profile') setProfileMode(task.mode);
  };

  const setupTourSteps = [
    {
      key: 'property',
      title: 'Property',
      short: 'Property',
      caption: propertyName,
      done: Boolean(state.property?.id),
      tab: 'profile',
      mode: 'property',
    },
    {
      key: 'payout',
      title: 'Payouts',
      short: 'Payouts',
      caption: settlementAccount.upiId || 'UPI missing',
      done: Boolean(settlementAccount.upiId),
      tab: 'profile',
      mode: 'collection',
    },
    {
      key: 'rooms',
      title: 'Add room',
      short: 'Room',
      caption: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'}`,
      done: state.rooms.length > 0,
      tab: 'rooms',
      mode: 'inventory',
    },
    {
      key: 'invite',
      title: 'Assign tenant',
      short: 'Tenant',
      caption: `${state.tenancies.length} assigned`,
      done: state.tenancies.length > 0,
      tab: 'rooms',
      mode: vacantRooms.length ? 'invite' : 'inventory',
    },
    {
      key: 'movein',
      title: 'Start stay',
      short: 'Move-in',
      caption: `${activeTenancies.length} active`,
      done: activeTenancies.length > 0,
      tab: 'rooms',
      mode: invitedTenancies.length ? 'activate' : 'invite',
    },
    {
      key: 'rent',
      title: 'Track rent',
      short: 'Rent',
      caption: `${invoices.length} bill${invoices.length === 1 ? '' : 's'}`,
      done: invoices.length > 0,
      tab: 'rent',
      mode: 'ledger',
    },
  ];
  const isSetupTourComplete = setupTourSteps.every((step) => step.done);
  const openTourStep = (step) => openTask(step);

  // Detect when a tour step is completed and show the transition overlay
  const tourDoneSignature = setupTourSteps.map((s) => (s.done ? '1' : '0')).join('');
  useEffect(() => {
    const nextStep = setupTourSteps.find((s) => !s.done) ?? null;
    const nextKey = nextStep?.key ?? 'done';
    const prevKey = prevNextKeyRef.current;

    if (prevKey !== null && prevKey !== nextKey) {
      const completedStep = setupTourSteps.find((s) => s.key === prevKey);
      if (completedStep) {
        setTourTransition({ completedTitle: completedStep.title, nextStep });
      }
    }
    prevNextKeyRef.current = nextKey;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourDoneSignature]);

  useEffect(() => {
    if (!tourTransition) return;
    const timer = setTimeout(() => {
      if (tourTransition.nextStep) openTourStep(tourTransition.nextStep);
      setTourTransition(null);
    }, 2800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourTransition]);

  const residentSectionCopy = {
    inventory: { title: 'Add a room', subtitle: '' },
    rooms: { title: 'Room list', subtitle: '' },
    invite: { title: 'Invite tenant', subtitle: '' },
    activate: { title: 'Move-in', subtitle: '' },
    moveout: { title: 'Move out', subtitle: '' },
    addTenant: { title: 'Add tenant — guided', subtitle: '' },
  };

  const moveInPipelineActions = [
    {
      key: 'inventory',
      step: '1',
      title: 'Add room',
      meta: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} created`,
      onPress: () => setResidentMode('inventory'),
    },
    {
      key: 'invite',
      step: '2',
      title: 'Invite tenant',
      meta: vacantRooms.length
        ? `${vacantRooms.length} open room${vacantRooms.length === 1 ? '' : 's'}`
        : 'No room available',
      onPress: () => setResidentMode('invite'),
    },
    {
      key: 'activate',
      step: '3',
      title: 'Move-in',
      meta: invitedTenancies.length
        ? `${invitedTenancies.length} waiting for agreement`
        : 'Nothing waiting',
      onPress: () => setResidentMode('activate'),
    },
  ];

  const roomManagementActions = [
    {
      key: 'rooms',
      title: 'Room list',
      meta: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'}`,
      onPress: () => setResidentMode('rooms'),
    },
    {
      key: 'moveout',
      title: 'Move out',
      meta: activeTenancies.length
        ? `${activeTenancies.length} active stay${activeTenancies.length === 1 ? '' : 's'}`
        : 'No active stays',
      onPress: () => setResidentMode('moveout'),
    },
  ];

  const rentFocus =
    pendingSubmissions.length
      ? {
          title: `${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''} waiting`,
          description: 'Review and close.',
          actionLabel: 'Open approvals',
          onPress: () => setRentMode('payment-review'),
          isAllClear: false,
        }
      : overdueInvoices.length
        ? {
            title: `${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`,
            description: 'Needs follow-up.',
            actionLabel: 'View ledger',
            onPress: () => setRentMode('ledger'),
            isAllClear: false,
          }
        : dueInvoices.length
          ? {
              title: `${dueInvoices.length} bill${dueInvoices.length > 1 ? 's are' : ' is'} due soon`,
              description: 'Check upcoming dues.',
              actionLabel: 'View ledger',
              onPress: () => setRentMode('ledger'),
              isAllClear: false,
            }
          : {
              title: 'All clear',
              description: 'No outstanding dues.',
              actionLabel: 'View ledger',
              onPress: () => setRentMode('ledger'),
              isAllClear: true,
            };

  // Build a chronological "What's next" timeline for the home tab.
  // Each entry has { title, meta, badge, sortDate, onPress }.
  // sortDate is ISO YYYY-MM-DD — past/today items float to the top, future items
  // follow in ascending date order. Cap at 8 so Home stays scannable.
  const homeTimeline = (() => {
    const ref = state.referenceDate;
    const rows = [];

    // 1. Overdue invoices — one row per invoice, sorts to very top (past dates)
    overdueInvoices.forEach((invoice) => {
      const room = getRoom(invoice.roomId);
      rows.push({
        key: `overdue-${invoice.id}`,
        title: `Room ${room?.label || '-'} rent overdue`,
        meta: formatDueWindow(ref, invoice.dueDate),
        badge: 'OVERDUE',
        sortDate: invoice.dueDate,
        onPress: () => openTask({ tab: 'rent', mode: 'ledger' }),
      });
    });

    // 2. Pending final approvals — rollup, sortDate = today
    if (pendingSubmissions.length) {
      rows.push({
        key: 'approvals',
        title: `${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''} waiting`,
        meta: 'Ready to review',
        badge: 'PENDING_REVIEW',
        sortDate: ref,
        onPress: () => openTask({ tab: 'rent', mode: 'payment-review' }),
      });
    }

    // 3. Move-ins waiting for agreement — rollup, sortDate = today
    if (invitedTenancies.length) {
      rows.push({
        key: 'invited',
        title: `${invitedTenancies.length} move-in${invitedTenancies.length > 1 ? 's' : ''} waiting`,
        meta: 'Agreement pending',
        badge: 'INVITED',
        sortDate: ref,
        onPress: () => openTask({ tab: 'rooms', mode: 'activate' }),
      });
    }

    // 4. Vacant rooms — rollup, sortDate = today (ongoing, no deadline)
    if (vacantRooms.length) {
      rows.push({
        key: 'vacant',
        title: `${vacantRooms.length} open room${vacantRooms.length > 1 ? 's' : ''}`,
        meta: 'Ready to fill',
        badge: 'VACANT',
        sortDate: ref,
        onPress: () => openTask({ tab: 'rooms', mode: 'invite' }),
      });
    }

    // 5. Due (not overdue) invoices — one row per invoice, future dates
    const invoiceIdsInTimeline = new Set(overdueInvoices.map((inv) => inv.id));
    dueInvoices.forEach((invoice) => {
      if (invoiceIdsInTimeline.has(invoice.id)) return;
      invoiceIdsInTimeline.add(invoice.id);
      const room = getRoom(invoice.roomId);
      rows.push({
        key: `due-${invoice.id}`,
        title: `Room ${room?.label || '-'} rent due`,
        meta: formatDueWindow(ref, invoice.dueDate),
        badge: 'DUE',
        sortDate: invoice.dueDate,
        onPress: () => openTask({ tab: 'rent', mode: 'ledger' }),
      });
    });

    // 6. Scheduled move-outs — one row per tenancy, sorted by moveOutDate
    moveOutTenancies.forEach((tenancy) => {
      const room = getRoom(tenancy.roomId);
      rows.push({
        key: `moveout-${tenancy.id}`,
        title: `Room ${room?.label || '-'} moving out`,
        meta: `On ${formatDate(tenancy.moveOutDate)}`,
        badge: 'MOVE_OUT_SCHEDULED',
        sortDate: tenancy.moveOutDate,
        onPress: () => openTask({ tab: 'rooms', mode: 'moveout' }),
      });
    });

    // 7. Upcoming reminders (SCHEDULED or READY, triggerDate >= today), deduped
    state.reminders
      .filter(
        (reminder) =>
          ['SCHEDULED', 'READY'].includes(reminder.deliveryStatus) &&
          reminder.triggerDate >= ref &&
          !invoiceIdsInTimeline.has(reminder.invoiceId),
      )
      .forEach((reminder) => {
        invoiceIdsInTimeline.add(reminder.invoiceId);
        const invoice = invoices.find((inv) => inv.id === reminder.invoiceId);
        const room = invoice ? getRoom(invoice.roomId) : null;
        rows.push({
          key: `reminder-${reminder.id}`,
          title: `Reminder: Room ${room?.label || '-'} rent`,
          meta: `Scheduled for ${formatDate(reminder.triggerDate)}`,
          badge: 'DUE',
          sortDate: reminder.triggerDate,
          onPress: () => openTask({ tab: 'rent', mode: 'ledger' }),
        });
      });

    // Sort ascending by sortDate (past/today first, then nearest future)
    rows.sort((a, b) => compareIsoDates(a.sortDate, b.sortDate));

    return rows.slice(0, 8);
  })();

  const refreshAction = useAsyncAction(() => actions.refresh());

  useAndroidBackHandler(() => {
    if (activeTab === 'rooms' && residentMode !== 'rooms') {
      setResidentMode('rooms');
      return true;
    }
    if (activeTab === 'rent' && rentMode !== 'ledger') {
      setRentMode('ledger');
      return true;
    }
    if (activeTab === 'profile' && profileMode !== 'property') {
      setProfileMode('property');
      return true;
    }
    return false;
  });

  const handleAction = async (callback, successMessage) => {
    try {
      await callback();
      toast.show({ tone: 'success', message: successMessage });
    } catch (error) {
      toast.show({ tone: 'danger', message: error.message });
    }
  };

  const chooseContractImage = async () => {
    try {
      const upload = await pickImageUpload();
      if (!upload) return;
      setContractForm((current) => ({
        ...current,
        contractUploads: [...current.contractUploads, upload].slice(0, 3),
      }));
    } catch (error) {
      toast.show({ tone: 'danger', message: error.message });
    }
  };

  const removeContractImage = (index) => {
    setContractForm((current) => ({
      ...current,
      contractUploads: current.contractUploads.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const renderResidentContent = () => {
    if (residentMode === 'inventory') {
      return (
        <>
          <Field label="Room number" value={roomForm.label} onChangeText={(value) => setRoomForm((current) => ({ ...current, label: value }))} placeholder="303" returnKeyType="next" />
          <Field label="Floor" value={roomForm.floor} onChangeText={(value) => setRoomForm((current) => ({ ...current, floor: value }))} placeholder="3" returnKeyType="next" />
          <Field label="Meter serial number" value={roomForm.serialNumber} onChangeText={(value) => setRoomForm((current) => ({ ...current, serialNumber: value }))} placeholder="LT-303-C" returnKeyType="next" />
          <Field label="Meter opening reading" value={roomForm.openingReading} onChangeText={(value) => setRoomForm((current) => ({ ...current, openingReading: value }))} keyboardType="numeric" returnKeyType="go" />
          <PrimaryButton label="Create room" onPress={() => handleAction(async () => {
            await actions.addRoom(roomForm);
            setRoomForm({ label: '', floor: '', serialNumber: '', openingReading: '0' });
            setResidentMode('invite');
          }, 'Room added.')} />
        </>
      );
    }

    if (residentMode === 'rooms') {
      return state.rooms.length ? (
        <View style={styles.stack}>
          {state.rooms.map((room) => {
            const tenancy = state.tenancies.find((record) => record.roomId === room.id && ['ACTIVE', 'MOVE_OUT_SCHEDULED', 'INVITED'].includes(record.status));
            const tenant = tenancy ? getTenant(tenancy.tenantId) : null;
            const meter = getMeter(room.meterId);

            return (
              <View key={room.id} style={styles.listCard}>
                <View style={styles.listCardHeader}>
                  <Text style={styles.listTitle}>Room {room.label}</Text>
                  <StatusBadge label={room.status} />
                </View>
                <KeyValueRow label="Resident" value={tenant ? tenant.fullName : 'Available'} />
                {tenant ? <KeyValueRow label="Phone" value={tenant.phone} /> : null}
                <KeyValueRow label="Floor" value={room.floor} />
                <KeyValueRow label="Meter" value={`${meter?.serialNumber || '-'} | ${meter?.lastReading ?? '-'}`} />
                {tenant ? (
                  <View style={styles.twoColBtns}>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Edit tenant"
                        tone="secondary"
                        compact
                        onPress={() => {
                          setTenantEditTarget(tenant);
                          setTenantEditForm({ fullName: tenant.fullName, phone: tenant.phone?.replace(/^\+91/, '') || '' });
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Reset password"
                        tone="secondary"
                        compact
                        onPress={() => handleAction(async () => {
                          const result = await actions.resetTenantPassword(tenant.id);
                          if (result?.tempPassword) {
                            setShareDetails({
                              tempPassword: result.tempPassword,
                              recipientName: result.tenant?.fullName || tenant.fullName,
                              recipientPhone: result.tenant?.phone || tenant.phone,
                              role: 'tenant',
                            });
                          }
                        }, 'Password reset.')}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : <EmptyState title="No rooms yet" description="Add a room." />;
    }

    if (residentMode === 'invite') {
      return vacantRooms.length ? (
        <View style={styles.inlineSection}>
          <Field label="Tenant name" value={inviteForm.fullName} onChangeText={(value) => setInviteForm((current) => ({ ...current, fullName: value }))} returnKeyType="next" />
          <Field label="Tenant mobile number" value={inviteForm.phone} onChangeText={(value) => setInviteForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" autoComplete="tel" returnKeyType="done" />
          <ChoiceChips value={inviteForm.roomId} onChange={(value) => setInviteForm((current) => ({ ...current, roomId: value }))} options={vacantRooms.map((room) => ({ value: room.id, label: `Room ${room.label}`, meta: `Floor ${room.floor}` }))} />
          <View style={styles.fullWidthAction}>
            <PrimaryButton label="Assign room" onPress={() => handleAction(async () => {
              const result = await actions.inviteTenant(inviteForm);
              if (result?.tempPassword) {
                setShareDetails({
                  tempPassword: result.tempPassword,
                  recipientName: result.invitedTenant?.fullName || inviteForm.fullName,
                  recipientPhone: result.invitedTenant?.phone || inviteForm.phone,
                  role: 'tenant',
                });
              }
              setInviteForm({ fullName: '', phone: '', roomId: '' });
              setResidentMode('activate');
            }, 'Tenant invited.')} />
          </View>
        </View>
      ) : (
        <EmptyState title="No open rooms" description="Add a room first." />
      );
    }

    if (residentMode === 'activate') {
      return (
        <View style={styles.stack}>
          {invitedTenancies.length ? (
            <View style={styles.inlineSection}>
              <ChoiceChips value={contractForm.tenancyId} onChange={(value) => setContractForm((current) => ({ ...current, tenancyId: value }))} options={invitedTenancies.map((tenancy) => ({ value: tenancy.id, label: getTenant(tenancy.tenantId)?.fullName || 'Tenant', meta: `Room ${getRoom(tenancy.roomId)?.label}` }))} />
              <View style={styles.contractUploadBlock}>
                <Text style={styles.contractUploadTitle}>Agreement images</Text>
                <Text style={styles.contractUploadSubtitle}>Upload 2-3 signed pages.</Text>
                <PrimaryButton
                  label={contractForm.contractUploads.length ? 'Add image' : 'Upload images'}
                  tone="secondary"
                  onPress={chooseContractImage}
                />
                {contractForm.contractUploads.length ? (
                  <View style={styles.stack}>
                    {contractForm.contractUploads.map((upload, index) => (
                      <View key={`${upload.fileName}-${index}`} style={styles.contractUploadCard}>
                        <UploadPreview
                          title={`Agreement image ${index + 1}`}
                          subtitle={upload.fileName}
                          uri={upload.previewUri}
                        />
                        <PrimaryButton
                          label="Remove"
                          tone="danger"
                          compact
                          onPress={() => removeContractImage(index)}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              <Field label="Monthly rent" value={contractForm.rentAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, rentAmount: value }))} keyboardType="numeric" placeholder="e.g. 15000" />
              <Field label="Deposit amount" value={contractForm.depositAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, depositAmount: value }))} keyboardType="numeric" placeholder="e.g. 30000" />
              <Field label="Due day" value={contractForm.dueDay} onChangeText={(value) => setContractForm((current) => ({ ...current, dueDay: value }))} keyboardType="numeric" placeholder="e.g. 5" />
              <Field label="Move-in date" value={contractForm.moveInDate} onChangeText={(value) => setContractForm((current) => ({ ...current, moveInDate: value }))} placeholder="YYYY-MM-DD" />
              <Field label="Agreement start" value={contractForm.contractStart} onChangeText={(value) => setContractForm((current) => ({ ...current, contractStart: value }))} placeholder="YYYY-MM-DD" />
              <Field label="Agreement end" value={contractForm.contractEnd} onChangeText={(value) => setContractForm((current) => ({ ...current, contractEnd: value }))} placeholder="YYYY-MM-DD" />
              <PrimaryButton
                label="Start stay"
                disabled={!contractForm.tenancyId || !contractForm.moveInDate || !contractForm.contractStart || !contractForm.contractEnd}
                onPress={() => handleAction(async () => {
                  await actions.activateTenancy(contractForm);
                  setContractForm((current) => ({ ...current, contractUploads: [] }));
                  setResidentMode('rooms');
                }, 'Stay started.')}
              />
            </View>
          ) : null}
          {!invitedTenancies.length ? (
            <EmptyState title="No move-ins ready" description="Assign a room first." />
          ) : null}
        </View>
      );
    }

    if (residentMode === 'addTenant') {
      const updateAT = (key, value) => setAddTenantForm((c) => ({ ...c, [key]: value }));
      const STEPS = ['room', 'tenant', 'contract'];
      const stepIdx = STEPS.indexOf(addTenantStep);

      const goNextStep = () => {
        if (addTenantStep === 'room') {
          if (addTenantForm.isNewRoom && !addTenantForm.label.trim()) {
            toast.show({ tone: 'danger', message: 'Room number is required.' });
            return;
          }
          if (!addTenantForm.isNewRoom && !addTenantForm.existingRoomId) {
            toast.show({ tone: 'danger', message: 'Select a room.' });
            return;
          }
          setAddTenantStep('tenant');
        } else if (addTenantStep === 'tenant') {
          if (!addTenantForm.fullName.trim() || !addTenantForm.phone.trim()) {
            toast.show({ tone: 'danger', message: 'Name and phone are required.' });
            return;
          }
          setAddTenantStep('contract');
        } else {
          handleAction(async () => {
            let roomId = addTenantForm.existingRoomId;
            if (addTenantForm.isNewRoom) {
              await actions.addRoom({
                label: addTenantForm.label,
                floor: addTenantForm.floor,
                serialNumber: addTenantForm.serialNumber,
                openingReading: addTenantForm.openingReading,
              });
              const newRoom = state.rooms.find((r) => r.label === addTenantForm.label);
              if (newRoom) roomId = newRoom.id;
            }
            const inviteResult = await actions.inviteTenant({
              fullName: addTenantForm.fullName,
              phone: addTenantForm.phone,
              roomId,
            });
            if (inviteResult?.tempPassword) {
              setShareDetails({
                tempPassword: inviteResult.tempPassword,
                recipientName: inviteResult.invitedTenant?.fullName || addTenantForm.fullName,
                recipientPhone: inviteResult.invitedTenant?.phone || addTenantForm.phone,
                role: 'tenant',
              });
            }
            const tenancyId = inviteResult?.invitedTenant
              ? state.tenancies.find((t) => t.tenantId === inviteResult.invitedTenant.id)?.id
              : null;
            if (tenancyId && addTenantForm.moveInDate && addTenantForm.contractStart && addTenantForm.contractEnd) {
              await actions.activateTenancy({
                tenancyId,
                rentAmount: addTenantForm.rentAmount,
                depositAmount: addTenantForm.depositAmount,
                dueDay: addTenantForm.dueDay,
                moveInDate: addTenantForm.moveInDate,
                contractStart: addTenantForm.contractStart,
                contractEnd: addTenantForm.contractEnd,
              });
            }
            setAddTenantStep('room');
            setAddTenantForm({ isNewRoom: true, existingRoomId: '', label: '', floor: '1', serialNumber: '', openingReading: '0', fullName: '', phone: '', rentAmount: '', depositAmount: '', dueDay: '5', moveInDate: '', contractStart: '', contractEnd: '' });
            setResidentMode('rooms');
          }, 'Tenant added.');
        }
      };

      return (
        <View style={styles.inlineSection}>
          <View style={styles.wizardProgress}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.wizardDot, i <= stepIdx && styles.wizardDotActive]} />
            ))}
          </View>

          {addTenantStep === 'room' && (
            <>
              <Text style={styles.wizardStepTitle}>Which room?</Text>
              {vacantRooms.length > 0 && (
                <ChoiceChips
                  options={[{ value: 'new', label: 'Create new room' }, ...vacantRooms.map((r) => ({ value: r.id, label: `Room ${r.label}`, meta: `Floor ${r.floor}` }))]}
                  value={addTenantForm.isNewRoom ? 'new' : addTenantForm.existingRoomId}
                  onChange={(v) => {
                    if (v === 'new') { updateAT('isNewRoom', true); updateAT('existingRoomId', ''); }
                    else { updateAT('isNewRoom', false); updateAT('existingRoomId', v); }
                  }}
                />
              )}
              {addTenantForm.isNewRoom && (
                <>
                  <Field label="Room number" value={addTenantForm.label} onChangeText={(v) => updateAT('label', v)} placeholder="303" returnKeyType="next" />
                  <Field label="Floor" value={addTenantForm.floor} onChangeText={(v) => updateAT('floor', v)} placeholder="3" keyboardType="numeric" returnKeyType="next" />
                  <Field label="Meter serial (optional)" value={addTenantForm.serialNumber} onChangeText={(v) => updateAT('serialNumber', v)} placeholder="LT-303-C" returnKeyType="next" />
                  <Field label="Opening reading" value={addTenantForm.openingReading} onChangeText={(v) => updateAT('openingReading', v)} keyboardType="numeric" returnKeyType="done" />
                </>
              )}
            </>
          )}

          {addTenantStep === 'tenant' && (
            <>
              <Text style={styles.wizardStepTitle}>Tenant details</Text>
              <Field label="Full name" value={addTenantForm.fullName} onChangeText={(v) => updateAT('fullName', v)} placeholder="Tenant full name" returnKeyType="next" />
              <Field label="Mobile number" value={addTenantForm.phone} onChangeText={(v) => updateAT('phone', v.replace(/\D+/g, '').slice(0, 10))} placeholder="10-digit number" keyboardType="phone-pad" returnKeyType="done" />
            </>
          )}

          {addTenantStep === 'contract' && (
            <>
              <Text style={styles.wizardStepTitle}>Lease details</Text>
              <Field label="Monthly rent (₹)" value={addTenantForm.rentAmount} onChangeText={(v) => updateAT('rentAmount', v)} keyboardType="numeric" placeholder="e.g. 15000" returnKeyType="next" />
              <Field label="Deposit (₹)" value={addTenantForm.depositAmount} onChangeText={(v) => updateAT('depositAmount', v)} keyboardType="numeric" placeholder="e.g. 30000" returnKeyType="next" />
              <Field label="Due day of month" value={addTenantForm.dueDay} onChangeText={(v) => updateAT('dueDay', v)} keyboardType="numeric" placeholder="5" returnKeyType="next" />
              <Field label="Move-in date (YYYY-MM-DD)" value={addTenantForm.moveInDate} onChangeText={(v) => updateAT('moveInDate', v)} placeholder={state.referenceDate} returnKeyType="next" />
              <Field label="Agreement start (YYYY-MM-DD)" value={addTenantForm.contractStart} onChangeText={(v) => updateAT('contractStart', v)} placeholder={state.referenceDate} returnKeyType="next" />
              <Field label="Agreement end (YYYY-MM-DD)" value={addTenantForm.contractEnd} onChangeText={(v) => updateAT('contractEnd', v)} placeholder="" returnKeyType="done" />
              <Text style={styles.wizardHelper}>You can upload agreement images from Advanced → Move-in.</Text>
            </>
          )}

          <View style={styles.twoColBtns}>
            <Pressable
              onPress={() => {
                if (addTenantStep === 'room') { setResidentMode('rooms'); }
                else if (addTenantStep === 'tenant') { setAddTenantStep('room'); }
                else { setAddTenantStep('tenant'); }
              }}
              style={styles.wizardBackBtn}
            >
              <Text style={styles.wizardBackBtnText}>{addTenantStep === 'room' ? 'Cancel' : '← Back'}</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={addTenantStep === 'contract' ? 'Add tenant' : 'Next →'}
                loading={state.isSyncing}
                disabled={state.isSyncing}
                onPress={goNextStep}
              />
            </View>
          </View>
        </View>
      );
    }

    return activeTenancies.length ? (
      <>
        <ChoiceChips value={moveOutForm.tenancyId} onChange={(value) => setMoveOutForm((current) => ({ ...current, tenancyId: value }))} options={activeTenancies.map((tenancy) => ({ value: tenancy.id, label: getTenant(tenancy.tenantId)?.fullName || 'Tenant', meta: `Room ${getRoom(tenancy.roomId)?.label}` }))} />
        <Field label="Move-out date" value={moveOutForm.moveOutDate} onChangeText={(value) => setMoveOutForm((current) => ({ ...current, moveOutDate: value }))} placeholder="YYYY-MM-DD" />
        <InlineGroup>
          <PrimaryButton label="Schedule move-out" onPress={() => handleAction(() => actions.scheduleMoveOut(moveOutForm), 'Move-out scheduled.')} />
          <PrimaryButton label="Mark complete" tone="secondary" onPress={() => handleAction(() => actions.closeTenancy(moveOutForm.tenancyId), 'Stay closed.')} />
        </InlineGroup>
      </>
    ) : <EmptyState title="No active stays" description="Nothing active." />;
  };

  const renderRentContent = () => {
    if (rentMode === 'ledger') {
      return (
        <View style={styles.stack}>
          <RoomStatusBoard title="Rooms overview" items={roomStatusItems} />
          {collectionWatch.length ? (
            <View style={styles.stack}>
              {collectionWatch.map((invoice) => (
                <View key={invoice.id} style={styles.ledgerCard}>
                  <View style={styles.ledgerCardHeader}>
                    <View>
                      <Text style={styles.ledgerCardRoom}>Room {invoice.roomLabel}</Text>
                      <Text style={styles.ledgerCardTenant}>{invoice.tenantName}</Text>
                    </View>
                    <StatusBadge label={invoice.derivedStatus} />
                  </View>
                  <View style={styles.ledgerAmountRow}>
                    <Text style={styles.ledgerAmount}>{formatCurrency(invoice.totalAmount)}</Text>
                    <Text style={styles.ledgerDueWindow}>{invoice.dueWindow}</Text>
                  </View>
                  <View style={styles.ledgerMeta}>
                    <Text style={styles.ledgerMetaText}>{formatMonth(invoice.month)}</Text>
                    <Text style={styles.ledgerMetaDivider}>·</Text>
                    <Text style={styles.ledgerMetaText}>{invoice.reminderState}</Text>
                  </View>
                  {['DUE', 'OVERDUE'].includes(invoice.derivedStatus) ? (
                    markPaidConfirmId === invoice.id ? (
                      <View style={styles.twoColBtns}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            label="Confirm paid"
                            compact
                            onPress={() => {
                              setMarkPaidConfirmId(null);
                              handleAction(() => actions.markInvoicePaid(invoice.id), 'Marked as paid.');
                            }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton label="Cancel" tone="secondary" compact onPress={() => setMarkPaidConfirmId(null)} />
                        </View>
                      </View>
                    ) : (
                      <PrimaryButton
                        label="Mark as paid"
                        tone="secondary"
                        compact
                        onPress={() => setMarkPaidConfirmId(invoice.id)}
                      />
                    )
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState title="No dues" description="All clear for now." />
          )}
        </View>
      );
    }

    if (rentMode === 'payment-review') {
      return (
        <View style={styles.stack}>
          <RoomStatusBoard title="Approval map" items={roomStatusItems} />
          {pendingSubmissions.length ? (
            <View style={styles.stack}>
              {pendingSubmissions.map((submission) => {
                const invoice = invoices.find((record) => record.id === submission.invoiceId);
                const tenant = getTenant(submission.tenantId);
                const room = invoice ? getRoom(invoice.roomId) : null;
                const meterReading =
                  state.meterReadings.find((reading) => reading.invoiceId === submission.invoiceId) || null;

                return (
                  <PaymentReviewCard
                    key={submission.id}
                    submission={submission}
                    invoice={invoice}
                    tenant={tenant}
                    room={room}
                    meterReading={meterReading}
                    onApprove={() =>
                      handleAction(
                        () => actions.reviewPayment({ submissionId: submission.id, decision: 'APPROVE' }),
                        'Approved.',
                      )
                    }
                    onReject={() =>
                      handleAction(
                        () => actions.reviewPayment({ submissionId: submission.id, decision: 'REJECT' }),
                        'Rejected.',
                      )
                    }
                    onEditReading={meterReading?.status === 'PENDING_REVIEW' ? (reading) => {
                      setEditReadingTarget(reading);
                      setEditReadingValue(String(reading.closingReading));
                    } : null}
                  />
                );
              })}
            </View>
          ) : (
            <EmptyState title="No approvals" description="Nothing pending." />
          )}
        </View>
      );
    }

    return <EmptyState title="No rent activity" description="Nothing here yet." />;
  };

  const renderProfileContent = () => {
    if (profileMode === 'property') {
      return (
        <>
          <Field label="Property name" value={propertyForm.name} onChangeText={(value) => setPropertyForm((current) => ({ ...current, name: value }))} />
          <Field label="Address" value={propertyForm.address} onChangeText={(value) => setPropertyForm((current) => ({ ...current, address: value }))} multiline />
          <Field label="Manager name" value={propertyForm.managerName} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerName: value }))} />
          <Field label="Manager phone" value={propertyForm.managerPhone} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerPhone: value }))} keyboardType="phone-pad" autoComplete="tel" />
          <Field label="Default electricity rate" value={propertyForm.defaultTariff} onChangeText={(value) => setPropertyForm((current) => ({ ...current, defaultTariff: value }))} keyboardType="decimal-pad" />
          <PrimaryButton label="Save property" onPress={() => handleAction(() => actions.updateProperty({ ...propertyForm, defaultTariff: Number(propertyForm.defaultTariff) }), 'Property saved.')} />
        </>
      );
    }

    if (profileMode === 'collection') {
      return (
        <>
          <Field label="Payee name" value={settlementForm.payeeName} onChangeText={(value) => setSettlementForm((current) => ({ ...current, payeeName: value }))} />
          <Field label="UPI ID" value={settlementForm.upiId} onChangeText={(value) => setSettlementForm((current) => ({ ...current, upiId: value }))} />
          <Field label="Note for tenants" value={settlementForm.instructions} onChangeText={(value) => setSettlementForm((current) => ({ ...current, instructions: value }))} multiline />
          <PrimaryButton label="Save payout account" onPress={() => handleAction(() => actions.updateSettlement(settlementForm), 'Payout saved.')} />
        </>
      );
    }

    return <EmptyState title="Room setup is in Rooms" description="Use the Rooms tab." />;
  };

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  if (!state.property) {
    return <OwnerOnboarding state={state} actions={actions} onLogout={onLogout} />;
  }

  return (
    <View style={styles.screenWrap}>
      <ScreenSurface
        hero={
          <PageHeader
            eyebrow={heroCopy.eyebrow}
            title={heroCopy.title}
            subtitle={heroCopy.subtitle}
            highlights={heroCopy.highlights}
          />
        }
        bottomBar={<TabStrip tabs={ownerTabs} activeTab={activeTab} onChange={setActiveTab} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshAction.isLoading}
            onRefresh={() => refreshAction.run().catch(() => {})}
            colors={[palette.accent]}
            tintColor={palette.accent}
          />
        }
      >
        {state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}

        {/* ── HOME ── */}
        {activeTab === 'home' ? (
          <>
            {/* Animated stat tiles */}
            <View style={styles.statRow}>
              <AnimatedStatTile label="Living now" value={summary.livingNow} delay={0} />
              <AnimatedStatTile label="Open rooms" value={summary.availableRooms} delay={60} />
              <AnimatedStatTile label="Unpaid" value={summary.unpaidNow} accent={summary.unpaidNow > 0} delay={120} />
              <AnimatedStatTile label="Approvals" value={summary.finalApprovals} accent={summary.finalApprovals > 0} delay={180} />
            </View>

            {!isSetupTourComplete ? (
              <SetupTourCard steps={setupTourSteps} onOpen={openTourStep} />
            ) : null}

            {homeTimeline.length ? (
              <SectionCard title="What's next">
                <View style={styles.stack}>
                  {homeTimeline.map((item, index) => (
                    <AnimatedQueueItem key={item.key} item={item} index={index} />
                  ))}
                </View>
              </SectionCard>
            ) : (
              <SectionCard title="All clear">
                <EmptyState title="Nothing scheduled" description="No upcoming dues, move-outs, or reminders." />
              </SectionCard>
            )}

          </>
        ) : null}

        {/* ── ROOMS ── */}
        {activeTab === 'rooms' ? (
          <>
            {residentMode !== 'addTenant' && (
              <PrimaryButton
                label="+ Add tenant"
                onPress={() => { setResidentMode('addTenant'); setAddTenantStep('room'); }}
              />
            )}

            {residentMode === 'addTenant' ? (
              <SectionCard title="Add tenant — guided" tone="accent">
                <View style={styles.residentPanelBody}>{renderResidentContent()}</View>
              </SectionCard>
            ) : (
              <>
                <SectionCard title={residentSectionCopy[residentMode].title} tone={['inventory', 'invite', 'activate'].includes(residentMode) ? 'accent' : 'default'}>
                  <View style={styles.residentPanelBody}>{renderResidentContent()}</View>
                </SectionCard>

                <SectionCard title="Advanced">
                  <View style={styles.pipelineWrap}>
                    {moveInPipelineActions.map((action) => (
                      <AnimatedPipelineStep
                        key={action.key}
                        action={action}
                        isActive={residentMode === action.key}
                        onPress={action.onPress}
                      />
                    ))}
                  </View>
                </SectionCard>

                <SectionCard title="Manage stays">
                  <View style={styles.managementGrid}>
                    {roomManagementActions.map((action) => (
                      <ManagementActionCard
                        key={action.key}
                        action={action}
                        isActive={residentMode === action.key}
                      />
                    ))}
                  </View>
                </SectionCard>
              </>
            )}
          </>
        ) : null}

        {/* ── RENT ── */}
        {activeTab === 'rent' ? (
          <>
            <RentFocusHero
              title={rentFocus.title}
              description={rentFocus.description}
              actionLabel={rentFocus.actionLabel}
              onPress={rentFocus.onPress}
              isAllClear={rentFocus.isAllClear}
            />

            <SectionCard title="Rent sections">
              <View style={styles.stack}>
                {[
                  {
                    key: 'ledger',
                    title: 'Track dues',
                    meta: overdueInvoices.length
                      ? `${overdueInvoices.length} overdue`
                      : dueInvoices.length
                        ? `${dueInvoices.length} due`
                        : 'All current',
                    onPress: () => setRentMode('ledger'),
                  },
                  {
                    key: 'payment-review',
                    title: 'Final approvals',
                    meta: pendingSubmissions.length ? `${pendingSubmissions.length} waiting` : 'Nothing waiting',
                    onPress: () => setRentMode('payment-review'),
                  },
                ].map((action) => (
                  <ManagementActionCard
                    key={action.key}
                    action={action}
                    isActive={rentMode === action.key}
                  />
                ))}
              </View>
            </SectionCard>

            <SectionCard
              title={rentMode === 'ledger' ? 'Track dues' : 'Final approvals'}
              tone={pendingSubmissions.length || overdueInvoices.length ? 'accent' : 'default'}
            >
              {renderRentContent()}
            </SectionCard>
          </>
        ) : null}

        {/* ── PROFILE ── */}
        {activeTab === 'profile' ? (
          <>
            <SectionCard title="Account">
              <KeyValueRow label="Property" value={propertyName} />
              <KeyValueRow label="Manager" value={managerName || '-'} />
              <KeyValueRow label="Phone" value={managerPhone || '-'} />
              <PrimaryButton label="App settings" tone="secondary" onPress={() => setShowSettings(true)} />
              <PrimaryButton label="Log out" tone="danger" onPress={onLogout} />
            </SectionCard>
            <SectionCard title="Settings">
              <ChoiceChips options={profileModes} value={profileMode} onChange={setProfileMode} />
              {renderProfileContent()}
            </SectionCard>
          </>
        ) : null}
      </ScreenSurface>

      <TempPasswordShareModal
        visible={Boolean(shareDetails)}
        onDismiss={() => setShareDetails(null)}
        tempPassword={shareDetails?.tempPassword}
        recipientName={shareDetails?.recipientName}
        recipientPhone={shareDetails?.recipientPhone}
        role={shareDetails?.role}
        inviterName={state.owner?.name || 'Owner'}
      />

      {/* Tenant edit modal */}
      <Modal
        visible={Boolean(tenantEditTarget)}
        transparent
        animationType="slide"
        onRequestClose={() => setTenantEditTarget(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setTenantEditTarget(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit tenant</Text>
              <Pressable onPress={() => setTenantEditTarget(null)} hitSlop={12}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>
            <Field
              label="Full name"
              value={tenantEditForm.fullName}
              onChangeText={(v) => setTenantEditForm((c) => ({ ...c, fullName: v }))}
              placeholder="Tenant full name"
            />
            <Field
              label="Phone (digits only)"
              value={tenantEditForm.phone}
              onChangeText={(v) => setTenantEditForm((c) => ({ ...c, phone: v.replace(/\D+/g, '').slice(0, 10) }))}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
            />
            <PrimaryButton
              label="Save changes"
              loading={state.isSyncing}
              disabled={state.isSyncing}
              onPress={async () => {
                try {
                  const phone = tenantEditForm.phone ? `+91${tenantEditForm.phone}` : undefined;
                  await actions.updateTenant(tenantEditTarget.id, {
                    fullName: tenantEditForm.fullName || undefined,
                    phone,
                  });
                  setTenantEditTarget(null);
                  toast.show({ tone: 'success', message: 'Tenant details updated.' });
                } catch (error) {
                  toast.show({ tone: 'danger', message: error.message });
                }
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Edit reading modal */}
      <Modal
        visible={Boolean(editReadingTarget)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditReadingTarget(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditReadingTarget(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Correct meter reading</Text>
              <Pressable onPress={() => setEditReadingTarget(null)} hitSlop={12}>
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.modalHelperText}>
              Opening reading: {editReadingTarget?.openingReading}
            </Text>
            <Field
              label="Closing reading"
              value={editReadingValue}
              onChangeText={setEditReadingValue}
              placeholder="Enter corrected value"
              keyboardType="numeric"
            />
            <PrimaryButton
              label="Save correction"
              loading={state.isSyncing}
              disabled={state.isSyncing}
              onPress={async () => {
                try {
                  await actions.updateMeterReading(editReadingTarget.id, { reading: editReadingValue });
                  setEditReadingTarget(null);
                  toast.show({ tone: 'success', message: 'Reading corrected.' });
                } catch (error) {
                  toast.show({ tone: 'danger', message: error.message });
                }
              }}
            />
          </View>
        </View>
      </Modal>

      {tourTransition ? (
        <Pressable
          style={styles.tourOverlay}
          onPress={() => {
            if (tourTransition.nextStep) openTourStep(tourTransition.nextStep);
            setTourTransition(null);
          }}
        >
          <View style={styles.tourOverlayCard}>
            <Text style={styles.tourOverlayCheck}>✓</Text>
            <Text style={styles.tourOverlayDoneText}>{tourTransition.completedTitle} complete</Text>
            {tourTransition.nextStep ? (
              <>
                <Text style={styles.tourOverlayNextLabel}>Next up</Text>
                <Text style={styles.tourOverlayNextTitle}>{tourTransition.nextStep.title}</Text>
              </>
            ) : (
              <Text style={styles.tourOverlayNextLabel}>All steps done!</Text>
            )}
            <Text style={styles.tourOverlayTap}>Tap to continue →</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1 },
  tourOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11,14,19,0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  tourOverlayCard: {
    backgroundColor: palette.white,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '78%',
    maxWidth: 320,
  },
  tourOverlayCheck: {
    fontSize: 44,
    color: '#22C55E',
    marginBottom: 8,
  },
  tourOverlayDoneText: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink,
    textAlign: 'center',
  },
  tourOverlayNextLabel: {
    fontSize: 11,
    color: palette.muted,
    marginTop: 20,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tourOverlayNextTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.ink,
    textAlign: 'center',
  },
  tourOverlayTap: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 20,
  },

  // ── Animated stat tiles ──
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignSelf: 'stretch',
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
    overflow: 'hidden',
    ...elevation.e1,
  },
  statTileAccent: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
    overflow: 'hidden',
  },
  statTileValue: {
    fontSize: 28,
    fontWeight: '900',
    color: palette.ink,
    letterSpacing: -0.5,
  },
  statTileValueAccent: { color: palette.white },
  statTileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statTileLabelAccent: { color: 'rgba(255,255,255,0.82)' },

  // ── Setup tour card (horizontal stepper) ──
  tourCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    ...elevation.e2,
  },
  tourCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tourCardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  tourProgressCount: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tourProgressCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.inkSoft,
  },
  tourStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  tourDotCol: {
    alignItems: 'center',
    gap: 5,
    minWidth: 40,
  },
  tourStepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
  },
  tourStepDotDone: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
  },
  tourStepDotNext: {
    borderColor: palette.ink,
    borderWidth: 2,
  },
  tourStepDotText: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  tourStepDotTextDone: { color: palette.white, fontSize: 12 },
  tourDotLabel: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    maxWidth: 44,
    textAlign: 'center',
  },
  tourDotLabelDone: { color: palette.mutedSoft },
  tourSegment: {
    flex: 1,
    height: 2,
    backgroundColor: palette.border,
    marginBottom: 14,
    borderRadius: 1,
  },
  tourSegmentDone: {
    backgroundColor: palette.ink,
  },
  tourCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    paddingTop: 2,
  },
  tourCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.ink,
  },
  tourCtaChevron: {
    fontSize: 18,
    color: palette.ink,
    lineHeight: 20,
  },

  // ── Queue items ──
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
    overflow: 'hidden',
  },
  queueCopy: { flex: 1, minWidth: 0, gap: 4 },
  queueTitle: { flexShrink: 1, color: palette.ink, fontSize: 15, fontWeight: '900', lineHeight: 20 },
  queueDescription: { color: palette.inkSoft, fontSize: 13, lineHeight: 19 },
  queueMeta: { color: palette.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  queueChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueChevronText: { fontSize: 18, color: palette.accentDeep, fontWeight: '700', lineHeight: 22 },

  // ── Pipeline steps ──
  pipelineWrap: { gap: 10, alignSelf: 'stretch', width: '100%' },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  pipelineStepActive: {
    borderColor: palette.borderStrong,
  },
  pipelineStepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFFBF6',
  },
  pipelineStepNumberActive: {
    backgroundColor: palette.accent,
  },
  pipelineStepNumberText: { color: palette.accentDeep, fontSize: 14, fontWeight: '900' },
  pipelineStepNumberTextActive: { color: palette.white },
  pipelineStepCopy: { flex: 1, minWidth: 0, gap: 4 },
  pipelineStepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pipelineStepTitle: { color: palette.ink, fontSize: 15, fontWeight: '900', lineHeight: 20 },
  pipelineStepTitleActive: { color: palette.accentDeep },
  pipelineStepMeta: { color: palette.muted, fontSize: 12, fontWeight: '800', lineHeight: 17 },
  pipelineChevron: { fontSize: 22, color: palette.muted, fontWeight: '700', lineHeight: 26 },
  pipelineChevronActive: { color: palette.accentDeep },
  openBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
  },
  openBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.accentDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Room tiles ──
  roomStatusBoard: { gap: 12, alignSelf: 'stretch', width: '100%' },
  roomStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  roomStatusTitle: { color: palette.ink, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  roomStatusCount: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  roomStatusLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roomStatusLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roomStatusDot: { width: 8, height: 8, borderRadius: 4 },
  roomStatusLegendText: { color: palette.inkSoft, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  roomStatusEmpty: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  roomTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
  roomTileWrap: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 124,
  },
  roomTilePressable: {
    padding: 12,
    borderRadius: 14,
    gap: 6,
    overflow: 'hidden',
    minHeight: 80,
  },
  roomTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  roomTileNumber: { color: palette.ink, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  roomTileStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roomTileStatusText: { fontSize: 9, fontWeight: '900', color: palette.white, textTransform: 'uppercase', letterSpacing: 0.4 },
  roomTileTenant: { color: palette.inkSoft, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  roomTileAmount: { fontSize: 12, lineHeight: 16, fontWeight: '800' },

  // ── Rent focus hero ──
  rentFocusCard: {
    borderRadius: 24,
    padding: 20,
    gap: 12,
    overflow: 'hidden',
    minHeight: 140,
    justifyContent: 'space-between',
    ...elevation.e3,
  },
  heroShapeLeft: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    left: -28,
    top: 12,
  },
  heroShapeRight: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    right: -20,
    top: 30,
  },
  rentFocusContent: { gap: 8, zIndex: 1 },
  rentFocusCheckCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentFocusCheckText: { fontSize: 20, color: palette.white, fontWeight: '900' },
  rentFocusTitle: { fontSize: 22, fontWeight: '900', color: palette.white, letterSpacing: -0.3 },
  rentFocusDescription: { fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 20 },
  rentFocusCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  rentFocusCtaText: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.90)' },
  rentFocusCtaChevron: { fontSize: 20, color: 'rgba(255,255,255,0.90)', fontWeight: '700', lineHeight: 24 },

  // ── Management action cards ──
  managementGrid: { gap: 10, alignSelf: 'stretch', width: '100%' },
  managementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  managementCardActive: { borderColor: '#AEEBDD' },
  managementCopy: { flex: 1, minWidth: 0, gap: 4 },
  managementTitle: { flexShrink: 1, color: palette.ink, fontSize: 15, fontWeight: '900', lineHeight: 20 },
  managementMeta: { color: palette.muted, fontSize: 12, fontWeight: '800' },

  // ── Payment review cards ──
  paymentCard: {
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#C8EEE8',
    overflow: 'hidden',
    ...elevation.e2,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  paymentCardHeaderLeft: { gap: 2 },
  paymentCardRoom: { fontSize: 18, fontWeight: '900', color: palette.ink },
  paymentCardTenant: { fontSize: 13, fontWeight: '700', color: palette.inkSoft },
  paymentCardBadgeWrap: {},
  paymentAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    gap: 0,
  },
  paymentAmountBlock: { flex: 1, alignItems: 'center', gap: 4 },
  paymentAmountDivider: { width: 1, height: 36, backgroundColor: palette.border },
  paymentAmountLabel: { fontSize: 11, fontWeight: '700', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  paymentAmountValue: { fontSize: 16, fontWeight: '900', color: palette.ink },
  paymentMeta: { gap: 6 },
  paymentMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  paymentMetaLabel: { fontSize: 13, fontWeight: '700', color: palette.muted },
  paymentMetaValue: { fontSize: 13, fontWeight: '700', color: palette.ink, flexShrink: 1, textAlign: 'right' },
  paymentActions: { flexDirection: 'row', gap: 10 },
  paymentApproveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...elevation.e1,
  },
  paymentApproveBtnText: { color: palette.white, fontWeight: '800', fontSize: 15 },
  paymentRejectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0EE',
    borderWidth: 1,
    borderColor: '#F2B8AE',
  },
  paymentRejectBtnText: { color: '#B42318', fontWeight: '800', fontSize: 15 },

  // ── Ledger cards ──
  ledgerCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  ledgerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  ledgerCardRoom: { fontSize: 16, fontWeight: '900', color: palette.ink },
  ledgerCardTenant: { fontSize: 13, fontWeight: '700', color: palette.inkSoft, marginTop: 2 },
  ledgerAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  ledgerAmount: { fontSize: 22, fontWeight: '900', color: palette.ink },
  ledgerDueWindow: { fontSize: 13, fontWeight: '700', color: palette.muted },
  ledgerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ledgerMetaText: { fontSize: 12, fontWeight: '700', color: palette.muted },
  ledgerMetaDivider: { color: palette.mutedSoft, fontSize: 12 },

  // ── Room list cards ──
  listCard: {
    alignSelf: 'stretch',
    width: '100%',
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  listCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  listTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: palette.ink },

  // ── Forms & misc ──
  stack: { gap: 12, alignSelf: 'stretch', width: '100%' },
  inlineSection: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 14,
  },
  fullWidthAction: { alignSelf: 'stretch', width: '100%' },
  contractUploadBlock: {
    gap: 10,
    alignSelf: 'stretch',
    width: '100%',
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  contractUploadTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  contractUploadSubtitle: { color: palette.inkSoft, fontSize: 13, lineHeight: 20 },
  contractUploadCard: { gap: 8, alignSelf: 'stretch', width: '100%' },
  residentPanelBody: { gap: 12, alignSelf: 'stretch', width: '100%' },
  previewCard: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 10,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  previewSubtitle: { color: palette.inkSoft, lineHeight: 20 },
  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    backgroundColor: palette.surface,
  },

  onboardingHero: {
    backgroundColor: palette.ink,
    paddingHorizontal: 24,
    paddingTop: 58,
    paddingBottom: 28,
    gap: 6,
  },
  onboardingEyebrow: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  onboardingTitle: {
    color: palette.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  onboardingSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
  },

  twoColBtns: { flexDirection: 'row', gap: 8 },

  wizardProgress: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 4 },
  wizardDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.border },
  wizardDotActive: { backgroundColor: palette.accent, width: 22 },
  wizardStepTitle: { fontSize: 18, fontWeight: '800', color: palette.ink, marginBottom: 4 },
  wizardHelper: { fontSize: 12, color: palette.muted, fontStyle: 'italic', marginTop: -8 },
  wizardBackBtn: { paddingVertical: 12, paddingHorizontal: 6 },
  wizardBackBtnText: { fontSize: 15, fontWeight: '700', color: palette.muted },

  paymentMetaValueRow: { flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 6 },
  editReadingBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: palette.surfaceTint,
  },
  editReadingBtnText: { color: palette.accentDeep, fontSize: 12, fontWeight: '700' },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 14,
    ...elevation.e3,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.border,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: palette.ink },
  modalClose: { fontSize: 26, color: palette.muted, lineHeight: 30, fontWeight: '400' },
  modalHelperText: { fontSize: 13, color: palette.muted, fontWeight: '600' },
});
