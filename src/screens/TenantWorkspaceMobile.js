import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  KeyValueRow,
  PageHeader,
  PrimaryButton,
  QrCard,
  ScreenSurface,
  SectionCard,
  StatusBadge,
  TabStrip,
  elevation,
  palette,
} from '../components/uiAirbnb';
import { useToast } from '../components/ToastHost';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { SettingsScreen } from './SettingsScreen';
import { pickImageUpload } from '../lib/imageUploads';
import {
  formatInvoiceStateLabel,
  formatMeterStateLabel,
  formatSubmissionStateLabel,
} from '../lib/statusLabels';
import { spring as springTokens, haptic } from '../lib/motion';

const { formatCurrency, formatDate, formatMonth } = require('../lib/dateUtils');
const { resolveUploadUrl } = require('../lib/apiClient');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const tenantTabs = [
  { label: 'Home', value: 'home' },
  { label: 'Rent', value: 'rent' },
  { label: 'My stay', value: 'stay' },
];

const profileModes = [
  { label: 'Personal details', value: 'details' },
  { label: 'Agreement', value: 'agreement' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Animated number counter (counts up on mount / when value changes)
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedAmount({ value, formatter = formatCurrency, style, prefix = '', suffix = '' }) {
  const target = Number.isFinite(value) ? value : 0;
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(formatter(0));

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(target, {
      duration: 900,
      easing: RNEasing.out(RNEasing.cubic),
    });
  }, [target, progress]);

  // Sync the rendered text with the animated value via runOnJS.
  // useAnimatedReaction would be cleaner but this works fine for a single counter.
  useEffect(() => {
    let raf;
    const tick = () => {
      const v = progress.value;
      setDisplay(formatter(Math.round(v)));
      if (Math.abs(v - target) > 0.5) raf = requestAnimationFrame(tick);
      else setDisplay(formatter(target));
    };
    tick();
    return () => raf && cancelAnimationFrame(raf);
  }, [target, formatter, progress]);

  return (
    <Text style={style}>
      {prefix}{display}{suffix}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating shape for hero parallax
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// NextStepHero — premium gradient CTA card replacing FocusCard for "next step"
// ─────────────────────────────────────────────────────────────────────────────
function NextStepHero({ focus, onPress }) {
  const scale = useSharedValue(1);
  const ty = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 360 });
    ty.value = withSpring(0, springTokens.gentle);
  }, [opacity, ty]);

  const wrap = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  const isAccent = focus.tone === 'accent';
  const isForest = focus.tone === 'forest';
  const colors = isAccent
    ? ['#1A1A2E', '#0B0E13', '#05050A']
    : isForest
      ? ['#2BC275', '#1FA463', '#147A47']
      : ['#FFFFFF', '#F7F9FB'];
  const isDark = isAccent || isForest;

  return (
    <Animated.View style={[wrap, styles.heroCardWrap]}>
      <Pressable
        onPress={() => {
          haptic.light();
          onPress?.();
        }}
        onPressIn={() => { scale.value = withSpring(0.985, springTokens.press); }}
        onPressOut={() => { scale.value = withSpring(1, springTokens.press); }}
        android_ripple={{
          color: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(11,14,19,0.08)',
          borderless: false,
        }}
        style={[styles.heroCard, !isDark && styles.heroCardLight]}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <FloatingShape style={[styles.heroCardShape, { left: -28, top: -16 }]} />
        <FloatingShape style={[styles.heroCardShape, { right: -36, bottom: -28 }]} delay={500} duration={5400} />
        <View style={styles.heroCardContent}>
          <Text style={[styles.heroCardEyebrow, !isDark && styles.heroCardEyebrowLight]}>
            Next step
          </Text>
          <Text style={[styles.heroCardTitle, !isDark && styles.heroCardTitleLight]}>
            {focus.title}
          </Text>
          {focus.description ? (
            <Text style={[styles.heroCardDesc, !isDark && styles.heroCardDescLight]}>
              {focus.description}
            </Text>
          ) : null}
          <View style={styles.heroCardCta}>
            <Text style={[styles.heroCardCtaText, !isDark && styles.heroCardCtaTextLight]}>
              Open  ›
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InvoiceHero — premium amount card for the rent tab
// ─────────────────────────────────────────────────────────────────────────────
function InvoiceHero({ invoice, onPay, isOverdue }) {
  const opacity = useSharedValue(0);
  const ty = useSharedValue(16);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 380 });
    ty.value = withSpring(0, springTokens.gentle);
  }, [opacity, ty, invoice?.id]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  const colors = isOverdue
    ? ['#FF7A66', '#EB5757', '#C9402F']
    : ['#1A1A2E', '#0B0E13', '#05050A'];

  return (
    <Animated.View style={[styles.invoiceHeroWrap, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <FloatingShape style={[styles.heroCardShape, { left: -20, top: -14 }]} />
      <FloatingShape style={[styles.heroCardShape, { right: -30, bottom: -24 }]} delay={500} duration={5400} />
      <View style={styles.invoiceHeroContent}>
        <Text style={styles.invoiceHeroEyebrow}>{formatMonth(invoice.month)}</Text>
        <AnimatedAmount value={invoice.totalAmount} style={styles.invoiceHeroAmount} />
        <Text style={styles.invoiceHeroDue}>
          {isOverdue ? 'Overdue · ' : 'Due '}
          {formatDate(invoice.dueDate)}
        </Text>
        {onPay ? (
          <Pressable
            onPress={() => {
              haptic.light();
              onPay();
            }}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
            style={({ pressed }) => [styles.invoiceHeroCta, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.invoiceHeroCtaText}>Pay now  ›</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline event — dotted timeline for activity
// ─────────────────────────────────────────────────────────────────────────────
function TimelineEvent({ title, subtitle, status, last = false, delay = 0 }) {
  const opacity = useSharedValue(0);
  const tx = useSharedValue(-8);
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 280 }));
    tx.value = withDelay(delay, withSpring(0, springTokens.gentle));
  }, [delay, opacity, tx]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }],
  }));

  return (
    <Animated.View style={[styles.timelineRow, style]}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineBody}>
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle} numberOfLines={2}>{title}</Text>
          {status ? <StatusBadge label={status} /> : null}
        </View>
        {subtitle ? <Text style={styles.timelineSubtitle}>{subtitle}</Text> : null}
      </View>
    </Animated.View>
  );
}

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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export function TenantWorkspaceMobile({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);
  const [profileMode, setProfileMode] = useState('details');
  const toast = useToast();

  const settlementAccount = state.settlementAccount || {};
  const currentMonth = state.referenceDate.slice(0, 7);
  const tenant = state.tenants.find((record) => record.id === state.session.currentTenantId);
  const tenancy = state.tenancies.find(
    (record) =>
      record.tenantId === tenant?.id &&
      ['INVITED', 'ACTIVE', 'MOVE_OUT_SCHEDULED'].includes(record.status),
  );
  const room = tenancy ? state.rooms.find((record) => record.id === tenancy.roomId) : null;
  const roomMeter = room ? state.roomMeters.find((record) => record.id === room.meterId) : null;
  const contract = tenancy?.contractId
    ? state.contracts.find((record) => record.id === tenancy.contractId)
    : null;
  const invoices = useMemo(
    () =>
      state.invoices
        .filter((invoice) => invoice.tenantId === tenant?.id)
        .map((invoice) => ({ ...invoice, derivedStatus: deriveInvoiceStatus(invoice, state.referenceDate) }))
        .sort((left, right) => right.month.localeCompare(left.month)),
    [state.invoices, tenant?.id, state.referenceDate],
  );
  const currentMonthInvoice = invoices.find((invoice) => invoice.month === currentMonth) || null;
  const currentInvoice = invoices.find((invoice) => invoice.derivedStatus !== 'PAID') || null;
  const activeInvoice = currentMonthInvoice || currentInvoice || null;
  const reminders = state.reminders
    .filter((reminder) => reminder.tenantId === tenant?.id)
    .sort((left, right) => left.triggerDate.localeCompare(right.triggerDate));
  const submissions = state.paymentSubmissions
    .filter((submission) => submission.tenantId === tenant?.id)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  const meterReadings = state.meterReadings
    .filter(
      (reading) =>
        reading.tenantId === tenant?.id ||
        (tenancy?.id && reading.tenancyId === tenancy.id),
    )
    .sort((left, right) => {
      const monthComparison = right.month.localeCompare(left.month);
      return monthComparison !== 0 ? monthComparison : right.capturedAt.localeCompare(left.capturedAt);
    });
  const currentMonthReading = meterReadings.find((reading) => reading.month === currentMonth) || null;
  const activeReading =
    currentMonthReading ||
    meterReadings.find((reading) => reading.invoiceId === activeInvoice?.id) ||
    null;
  const activeSubmission =
    submissions.find((submission) => submission.invoiceId === activeInvoice?.id) || null;
  const isProfileComplete = tenant?.profileStatus === 'COMPLETE';

  const [profileForm, setProfileForm] = useState({
    fullName: tenant?.fullName || '',
    email: tenant?.email || '',
    emergencyContact: tenant?.emergencyContact || '',
    idDocument: tenant?.idDocument || '',
    notes: tenant?.notes || '',
  });
  const [paymentForm, setPaymentForm] = useState({ utr: '', note: '', proofUpload: null });
  const [meterForm, setMeterForm] = useState({
    closingReading: roomMeter?.lastReading ? String(roomMeter.lastReading) : '',
    photoUpload: null,
  });

  useEffect(() => {
    setProfileForm({
      fullName: tenant?.fullName || '',
      email: tenant?.email || '',
      emergencyContact: tenant?.emergencyContact || '',
      idDocument: tenant?.idDocument || '',
      notes: tenant?.notes || '',
    });
  }, [tenant]);

  useEffect(() => {
    setMeterForm({
      closingReading: roomMeter?.lastReading ? String(roomMeter.lastReading) : '',
      photoUpload: null,
    });
  }, [roomMeter?.lastReading, currentMonth, activeInvoice?.id]);

  useEffect(() => {
    setPaymentForm({ utr: '', note: '', proofUpload: null });
  }, [activeInvoice?.id]);

  const submitMeterAction = useAsyncAction(async () => {
    await actions.submitMeterReading({
      tenancyId: tenancy.id,
      month: currentMonth,
      closingReading: Number(meterForm.closingReading),
      photoUpload: meterForm.photoUpload,
    });
    toast.show({ tone: 'success', message: 'Reading submitted.' });
    haptic.success();
  });

  const submitPaymentAction = useAsyncAction(async () => {
    await actions.submitPayment({
      invoiceId: activeInvoice.id,
      utr: paymentForm.utr,
      note: paymentForm.note,
      proofUpload: paymentForm.proofUpload,
    });
    setPaymentForm({ utr: '', note: '', proofUpload: null });
    toast.show({ tone: 'success', message: 'Proof submitted.' });
    haptic.success();
  });

  const saveProfileAction = useAsyncAction(async () => {
    await actions.completeTenantProfile({ tenantId: tenant.id, ...profileForm });
    toast.show({ tone: 'success', message: 'Details saved.' });
    haptic.success();
  });

  const refreshAction = useAsyncAction(() => actions.refresh());

  const chooseMeterPhoto = async () => {
    try {
      const upload = await pickImageUpload();
      if (upload) setMeterForm((current) => ({ ...current, photoUpload: upload }));
    } catch (error) {
      toast.show({ tone: 'danger', message: error.message });
    }
  };

  const choosePaymentProof = async () => {
    try {
      const upload = await pickImageUpload();
      if (upload) setPaymentForm((current) => ({ ...current, proofUpload: upload }));
    } catch (error) {
      toast.show({ tone: 'danger', message: error.message });
    }
  };

  const handleSubmitMeter = async () => {
    try { await submitMeterAction.run(); } catch (error) { toast.show({ tone: 'danger', message: error.message }); }
  };
  const handleSubmitPayment = async () => {
    try { await submitPaymentAction.run(); } catch (error) { toast.show({ tone: 'danger', message: error.message }); }
  };
  const handleSaveProfile = async () => {
    try { await saveProfileAction.run(); } catch (error) { toast.show({ tone: 'danger', message: error.message }); }
  };
  const handleRefresh = () => { refreshAction.run().catch(() => {}); };

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  if (!tenant) {
    return (
      <ScreenSurface
        hero={<PageHeader eyebrow="Tenant" title="Stay not found" subtitle="No stay for this number." />}
      >
        <SectionCard title="Session" subtitle="Ask the owner to invite this number.">
          <PrimaryButton label="Log out" tone="danger" onPress={onLogout} />
        </SectionCard>
      </ScreenSurface>
    );
  }

  const currentDue =
    activeInvoice && ['DUE', 'OVERDUE', 'PAYMENT_SUBMITTED'].includes(activeInvoice.derivedStatus)
      ? formatCurrency(activeInvoice.totalAmount)
      : 'Nothing due';
  const meterPreviewUri =
    meterForm.photoUpload?.previewUri || resolveUploadUrl(activeReading?.photoLabel);
  const paymentProofUri =
    paymentForm.proofUpload?.previewUri || resolveUploadUrl(activeSubmission?.screenshotLabel);

  const tenantFocus = !isProfileComplete
    ? { title: 'Finish your profile', description: 'Complete your details to continue.', tab: 'stay', tone: 'accent' }
    : !contract
      ? { title: 'Agreement pending', description: 'Waiting for the agreement to be uploaded.', tab: 'stay', tone: 'soft' }
      : !activeInvoice
        ? { title: 'Submit this month’s reading', description: 'Add the latest meter photo.', tab: 'rent', tone: 'accent' }
        : ['DUE', 'OVERDUE'].includes(activeInvoice.derivedStatus)
          ? {
              title: `Pay ${formatCurrency(activeInvoice.totalAmount)}`,
              description: activeInvoice.derivedStatus === 'OVERDUE' ? 'Payment is overdue.' : 'Pay now and upload proof.',
              tab: 'rent',
              tone: activeInvoice.derivedStatus === 'OVERDUE' ? 'accent' : 'forest',
            }
          : activeInvoice.derivedStatus === 'PAYMENT_SUBMITTED'
            ? { title: 'Final approval pending', description: 'Awaiting owner approval.', tab: 'rent', tone: 'soft' }
            : { title: 'All clear', description: 'You’re up to date.', tab: 'home', tone: 'forest' };

  const heroCopy = {
    home: {
      eyebrow: 'Welcome',
      title: tenant.fullName || 'Your stay',
      subtitle: room ? `Room ${room.label}` : 'Room pending',
      highlights: [
        roomMeter ? `${roomMeter.lastReading} units` : 'Meter pending',
        currentDue,
      ],
    },
    rent: {
      eyebrow: 'Rent',
      title: activeInvoice ? formatMonth(activeInvoice.month) : 'Submit reading',
      subtitle: activeReading ? formatMeterStateLabel(activeReading.status) : 'Waiting for your reading',
      highlights: [
        roomMeter ? `Last approved ${roomMeter.lastReading}` : 'No meter',
        activeInvoice ? formatInvoiceStateLabel(activeInvoice.derivedStatus) : formatMonth(currentMonth),
      ],
    },
    stay: {
      eyebrow: 'My stay',
      title: 'Profile & agreement',
      subtitle: tenant.profileStatus === 'COMPLETE' ? 'Details complete' : 'Details pending',
      highlights: [
        contract ? 'Agreement live' : 'Agreement pending',
        `${submissions.length} payment update${submissions.length === 1 ? '' : 's'}`,
      ],
    },
  }[activeTab];

  // Activity events — flatten everything into a single timeline
  const events = [];
  if (activeReading) {
    events.push({
      key: `reading-${activeReading.id}`,
      title: `Meter reading for ${formatMonth(activeReading.month)}`,
      subtitle: `${activeReading.openingReading} → ${activeReading.closingReading}`,
      status: formatMeterStateLabel(activeReading.status),
    });
  }
  submissions.slice(0, 3).forEach((submission) => {
    events.push({
      key: submission.id,
      title: 'Payment proof shared',
      subtitle: submission.utr,
      status: formatSubmissionStateLabel(submission.status),
    });
  });
  reminders.slice(0, 3).forEach((reminder) => {
    events.push({
      key: reminder.id,
      title: reminder.title,
      subtitle: formatDate(reminder.triggerDate),
      status: reminder.deliveryStatus,
    });
  });

  const renderActivityCard = () => (
    <SectionCard title="Updates">
      {events.length ? (
        <View style={styles.timeline}>
          {events.map((event, index) => (
            <TimelineEvent
              key={event.key}
              title={event.title}
              subtitle={event.subtitle}
              status={event.status}
              last={index === events.length - 1}
              delay={index * 70}
            />
          ))}
        </View>
      ) : (
        <EmptyState title="No updates yet" description="Submissions and reminders will appear here." />
      )}
    </SectionCard>
  );

  const isOverdue = activeInvoice?.derivedStatus === 'OVERDUE';
  const showAllClearOnHome = tenantFocus.title === 'All clear';

  return (
    <ScreenSurface
      hero={<PageHeader eyebrow={heroCopy.eyebrow} title={heroCopy.title} subtitle={heroCopy.subtitle} highlights={heroCopy.highlights} />}
      bottomBar={<TabStrip tabs={tenantTabs} activeTab={activeTab} onChange={setActiveTab} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshAction.isLoading}
          onRefresh={handleRefresh}
          colors={[palette.accent]}
          tintColor={palette.accent}
        />
      }
    >
      {state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}

      {activeTab === 'home' ? (
        <>
          {!showAllClearOnHome ? (
            <NextStepHero focus={tenantFocus} onPress={() => setActiveTab(tenantFocus.tab)} />
          ) : (
            <SectionCard tone="accent">
              <View style={styles.allClearWrap}>
                <View style={styles.allClearBadge}>
                  <Text style={styles.allClearBadgeText}>✓</Text>
                </View>
                <View style={styles.allClearText}>
                  <Text style={styles.allClearTitle}>You’re all clear</Text>
                  <Text style={styles.allClearSub}>Rent paid and approved. See you next month.</Text>
                </View>
              </View>
            </SectionCard>
          )}

          <SectionCard title="Stay overview" subtitle="At a glance">
            <View style={styles.statRow}>
              <View style={[styles.statTile, styles.statTileFirst]}>
                <Text style={styles.statLabel}>Room</Text>
                <Text style={styles.statValue}>{room ? room.label : '—'}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Current due</Text>
                {activeInvoice && ['DUE', 'OVERDUE', 'PAYMENT_SUBMITTED'].includes(activeInvoice.derivedStatus) ? (
                  <AnimatedAmount value={activeInvoice.totalAmount} style={styles.statValue} />
                ) : (
                  <Text style={styles.statValue}>—</Text>
                )}
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Meter</Text>
                <Text style={styles.statValue}>{roomMeter ? roomMeter.lastReading : '—'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            {!contract ? <KeyValueRow label="Agreement" value="Pending" /> : null}
            <KeyValueRow
              label="This month"
              value={activeInvoice ? formatInvoiceStateLabel(activeInvoice.derivedStatus) : 'Reading not submitted'}
            />
          </SectionCard>

          {events.length > 0 ? renderActivityCard() : null}
        </>
      ) : null}

      {activeTab === 'rent' ? (
        <>
          {tenancy ? (
            <>
              {activeInvoice && ['DUE', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PAID'].includes(activeInvoice.derivedStatus) ? (
                <InvoiceHero
                  invoice={activeInvoice}
                  isOverdue={isOverdue}
                  onPay={
                    ['DUE', 'OVERDUE'].includes(activeInvoice.derivedStatus)
                      ? () =>
                          Linking.openURL(activeInvoice.paymentLink).catch(() =>
                            toast.show({ tone: 'danger', message: 'Could not open a UPI app.' }),
                          )
                      : null
                  }
                />
              ) : null}

              <SectionCard title="This month">
                <KeyValueRow
                  label="Last approved reading"
                  value={roomMeter ? String(roomMeter.lastReading) : 'Pending'}
                />
                <KeyValueRow
                  label="Billing month"
                  value={formatMonth(activeInvoice?.month || currentMonth)}
                />
                {!activeInvoice ? (
                  <View style={styles.formStack}>
                    <Field
                      label="New meter reading"
                      value={meterForm.closingReading}
                      onChangeText={(value) =>
                        setMeterForm((current) => ({ ...current, closingReading: value }))
                      }
                      keyboardType="numeric"
                      returnKeyType="done"
                      error={
                        meterForm.closingReading && roomMeter &&
                        Number(meterForm.closingReading) <= Number(roomMeter.lastReading)
                          ? `Must be greater than last reading (${roomMeter.lastReading})`
                          : null
                      }
                    />
                    <PrimaryButton
                      label={meterForm.photoUpload ? 'Replace meter photo' : 'Upload meter photo'}
                      tone="secondary"
                      onPress={chooseMeterPhoto}
                    />
                    <UploadPreview
                      title="Meter photo"
                      subtitle={meterForm.photoUpload?.fileName || 'Selected'}
                      uri={meterForm.photoUpload?.previewUri}
                    />
                    <PrimaryButton
                      label="Submit reading"
                      onPress={handleSubmitMeter}
                      loading={submitMeterAction.isLoading}
                      disabled={
                        submitMeterAction.isLoading ||
                        !meterForm.closingReading ||
                        (roomMeter && Number(meterForm.closingReading) <= Number(roomMeter.lastReading))
                      }
                    />
                  </View>
                ) : (
                  <>
                    <View style={styles.statRow}>
                      <View style={[styles.statTile, styles.statTileFirst]}>
                        <Text style={styles.statLabel}>Total due</Text>
                        <AnimatedAmount value={activeInvoice.totalAmount} style={styles.statValue} />
                      </View>
                      <View style={styles.statTile}>
                        <Text style={styles.statLabel}>Rent</Text>
                        <AnimatedAmount value={activeInvoice.baseRent} style={styles.statValue} />
                      </View>
                      <View style={styles.statTile}>
                        <Text style={styles.statLabel}>Electricity</Text>
                        <AnimatedAmount value={activeInvoice.electricityCharge} style={styles.statValue} />
                      </View>
                    </View>
                    {activeReading ? (
                      <>
                        <KeyValueRow
                          label="Meter reading"
                          value={`${activeReading.openingReading} → ${activeReading.closingReading}`}
                        />
                        <KeyValueRow
                          label="Units used"
                          value={String(activeReading.closingReading - activeReading.openingReading)}
                        />
                      </>
                    ) : null}
                    <UploadPreview
                      title="Meter photo"
                      subtitle={activeReading?.photoLabel || 'Uploaded'}
                      uri={meterPreviewUri}
                    />

                    {['DUE', 'OVERDUE'].includes(activeInvoice.derivedStatus) ? (
                      <>
                        {activeSubmission?.status === 'REJECTED' ? (
                          <Banner tone="danger" message="Previous proof was rejected. Upload a new one." />
                        ) : null}
                        <QrCard
                          value={activeInvoice.paymentLink}
                          subtitle={`${settlementAccount.payeeName || 'Payee'} • ${settlementAccount.upiId || 'UPI'}`}
                        />
                        <View style={styles.formStack}>
                          <Field
                            label="UTR"
                            value={paymentForm.utr}
                            onChangeText={(value) =>
                              setPaymentForm((current) => ({ ...current, utr: value }))
                            }
                            autoCapitalize="characters"
                            returnKeyType="done"
                          />
                          <PrimaryButton
                            label={paymentForm.proofUpload ? 'Replace proof' : 'Upload proof'}
                            tone="secondary"
                            onPress={choosePaymentProof}
                          />
                          {paymentForm.proofUpload ? (
                            <UploadPreview
                              title="Payment proof"
                              subtitle={paymentForm.proofUpload.fileName}
                              uri={paymentForm.proofUpload.previewUri}
                            />
                          ) : (
                            <Text style={styles.uploadPlaceholder}>No proof uploaded yet</Text>
                          )}
                          <Field
                            label="Note (optional)"
                            value={paymentForm.note}
                            onChangeText={(value) =>
                              setPaymentForm((current) => ({ ...current, note: value }))
                            }
                            multiline
                          />
                          <PrimaryButton
                            label="Send proof"
                            onPress={handleSubmitPayment}
                            loading={submitPaymentAction.isLoading}
                            disabled={submitPaymentAction.isLoading}
                          />
                        </View>
                      </>
                    ) : null}

                    {activeInvoice.derivedStatus === 'PAYMENT_SUBMITTED' ? (
                      <>
                        <UploadPreview
                          title="Payment proof"
                          subtitle={activeSubmission?.screenshotLabel || 'Uploaded'}
                          uri={paymentProofUri}
                        />
                        <EmptyState title="Final approval pending" description="Waiting for owner approval." />
                      </>
                    ) : null}

                    {activeInvoice.derivedStatus === 'PAID' ? (
                      <>
                        <UploadPreview
                          title="Payment proof"
                          subtitle={activeSubmission?.screenshotLabel || 'Approved'}
                          uri={paymentProofUri}
                        />
                        <EmptyState title="Payment confirmed" description="Paid and approved." />
                      </>
                    ) : null}
                  </>
                )}
              </SectionCard>
              {renderActivityCard()}
            </>
          ) : (
            <SectionCard>
              <EmptyState title="Stay not active" description="Finish onboarding first." />
            </SectionCard>
          )}
        </>
      ) : null}

      {activeTab === 'stay' ? (
        <>
          <SectionCard title="Stay" tone="soft">
            <KeyValueRow label="Room" value={room ? `Room ${room.label}` : 'Pending'} />
            <KeyValueRow label="Details" value={tenant.profileStatus === 'COMPLETE' ? 'Complete' : 'Pending'} />
            <KeyValueRow label="Agreement" value={contract ? 'Active' : 'Pending'} />
            <PrimaryButton label="App settings" tone="secondary" onPress={() => setShowSettings(true)} />
            <PrimaryButton label="Log out" tone="danger" onPress={onLogout} />
          </SectionCard>
          <SectionCard title="Details">
            <ChoiceChips options={profileModes} value={profileMode} onChange={setProfileMode} />
            {profileMode === 'details' ? (
              <>
                <Field
                  label="Full name"
                  value={profileForm.fullName}
                  onChangeText={(value) => setProfileForm((current) => ({ ...current, fullName: value }))}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                <Field
                  label="Email"
                  value={profileForm.email}
                  onChangeText={(value) => setProfileForm((current) => ({ ...current, email: value }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                />
                <Field
                  label="Emergency contact number"
                  value={profileForm.emergencyContact}
                  onChangeText={(value) => setProfileForm((current) => ({ ...current, emergencyContact: value }))}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  returnKeyType="next"
                />
                <Field
                  label="ID number"
                  value={profileForm.idDocument}
                  onChangeText={(value) => setProfileForm((current) => ({ ...current, idDocument: value }))}
                  autoCapitalize="characters"
                  returnKeyType="next"
                />
                <Field
                  label="Notes"
                  value={profileForm.notes}
                  onChangeText={(value) => setProfileForm((current) => ({ ...current, notes: value }))}
                  multiline
                />
                <PrimaryButton
                  label="Save details"
                  onPress={handleSaveProfile}
                  loading={saveProfileAction.isLoading}
                  disabled={saveProfileAction.isLoading}
                />
              </>
            ) : contract ? (
              <>
                <KeyValueRow label="Move-in date" value={formatDate(contract.moveInDate)} />
                <KeyValueRow label="Agreement term" value={`${formatDate(contract.contractStart)} → ${formatDate(contract.contractEnd)}`} />
                <KeyValueRow label="Monthly rent" value={formatCurrency(contract.rentAmount)} />
                <KeyValueRow label="Deposit" value={formatCurrency(contract.depositAmount)} />
                <KeyValueRow label="Monthly due date" value={`Day ${contract.dueDay} of each month`} />
                {Array.isArray(contract.imageLabels) && contract.imageLabels.length ? (
                  <View style={styles.stack}>
                    {contract.imageLabels.map((imageLabel, index) => (
                      <UploadPreview
                        key={`${contract.id}-page-${index}`}
                        title={`Agreement page ${index + 1}`}
                        subtitle=""
                        uri={resolveUploadUrl(imageLabel)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : <EmptyState title="Agreement pending" description="Waiting for the agreement." />}
          </SectionCard>
        </>
      ) : null}
    </ScreenSurface>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  formStack: {
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },

  // Hero "Next step" gradient card
  heroCardWrap: { borderRadius: 30, overflow: 'hidden', ...elevation.e2 },
  heroCard: {
    minHeight: 168,
    padding: 22,
    borderRadius: 30,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  heroCardLight: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  heroCardShape: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroCardContent: { gap: 6, position: 'relative' },
  heroCardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.86)',
  },
  heroCardEyebrowLight: { color: palette.muted },
  heroCardTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: palette.white,
    letterSpacing: -0.4,
  },
  heroCardTitleLight: { color: palette.ink },
  heroCardDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.86)',
  },
  heroCardDescLight: { color: palette.muted },
  heroCardCta: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  heroCardCtaText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  heroCardCtaTextLight: { color: palette.accentDeep },

  // Invoice hero
  invoiceHeroWrap: {
    minHeight: 200,
    borderRadius: 32,
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'space-between',
    ...elevation.e2,
  },
  invoiceHeroContent: { gap: 4 },
  invoiceHeroEyebrow: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  invoiceHeroAmount: {
    color: palette.white,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 4,
  },
  invoiceHeroDue: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  invoiceHeroCta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.white,
  },
  invoiceHeroCtaText: { color: palette.ink, fontWeight: '800', fontSize: 14 },

  // Stat tiles row
  statRow: { flexDirection: 'row', gap: 1, borderRadius: 18, overflow: 'hidden' },
  statTile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: palette.surfaceMuted,
    gap: 4,
  },
  statTileFirst: {},
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 4 },

  // All clear card
  allClearWrap: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  allClearBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allClearBadgeText: { color: palette.white, fontSize: 22, fontWeight: '900' },
  allClearText: { flex: 1, gap: 2 },
  allClearTitle: { fontSize: 18, fontWeight: '800', color: palette.ink, letterSpacing: -0.2 },
  allClearSub: { fontSize: 13, color: palette.muted, lineHeight: 18 },

  // Timeline
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 14, paddingVertical: 6 },
  timelineRail: { width: 14, alignItems: 'center', paddingTop: 4 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accent,
    borderWidth: 2,
    borderColor: palette.surface,
    ...elevation.e1,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: palette.border,
    marginTop: 4,
  },
  timelineBody: { flex: 1, paddingBottom: 14, gap: 4 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: palette.ink },
  timelineSubtitle: { fontSize: 13, color: palette.muted, lineHeight: 18 },

  // Upload preview
  previewCard: {
    gap: 10,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  uploadPlaceholder: { color: palette.muted, fontSize: 13, fontStyle: 'italic' },
  previewTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  previewSubtitle: { color: palette.inkSoft, lineHeight: 20 },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted,
  },
});
