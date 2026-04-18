import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

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
  QrCard,
  ScreenSurface,
  SectionCard,
  StatusBadge,
  TabStrip,
  palette,
} from '../components/uiAirbnb';
import { pickImageUpload } from '../lib/imageUploads';

const { formatCurrency, formatDate, formatMonth } = require('../lib/dateUtils');
const { resolveUploadUrl } = require('../lib/apiClient');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const tenantTabs = [
  { label: 'Home', value: 'home' },
  { label: 'Rent', value: 'rent' },
  { label: 'Profile', value: 'profile' },
];

const profileModes = [
  { label: 'Details', value: 'details' },
  { label: 'Agreement', value: 'agreement' },
];

function UploadPreview({ title, subtitle, uri }) {
  if (!uri) {
    return null;
  }

  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>{title}</Text>
      {subtitle ? <Text style={styles.previewSubtitle}>{subtitle}</Text> : null}
      <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
    </View>
  );
}

export function TenantWorkspaceMobile({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [profileMode, setProfileMode] = useState('details');
  const [feedback, setFeedback] = useState(null);
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

  const handleAction = async (callback, successMessage) => {
    try {
      setFeedback(null);
      await callback();
      setFeedback({ tone: 'success', text: successMessage });
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  const chooseMeterPhoto = async () => {
    try {
      setFeedback(null);
      const upload = await pickImageUpload();
      if (upload) {
        setMeterForm((current) => ({ ...current, photoUpload: upload }));
      }
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  const choosePaymentProof = async () => {
    try {
      setFeedback(null);
      const upload = await pickImageUpload();
      if (upload) {
        setPaymentForm((current) => ({ ...current, proofUpload: upload }));
      }
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  if (!tenant) {
    return (
      <ScreenSurface
        hero={<PageHeader eyebrow="Tenant" title="Tenant not found" subtitle="Use one of the demo tenant numbers from the sign-up screen." />}
      >
        <SectionCard title="Session" subtitle="This demo login does not match a tenant record.">
          <PrimaryButton label="Log out" onPress={onLogout} />
        </SectionCard>
      </ScreenSurface>
    );
  }

  const currentDue =
    activeInvoice && ['DUE', 'OVERDUE', 'PAYMENT_SUBMITTED'].includes(activeInvoice.derivedStatus)
      ? formatCurrency(activeInvoice.totalAmount)
      : 'No bill';
  const meterPreviewUri =
    meterForm.photoUpload?.previewUri || resolveUploadUrl(activeReading?.photoLabel);
  const paymentProofUri =
    paymentForm.proofUpload?.previewUri || resolveUploadUrl(activeSubmission?.screenshotLabel);

  const tenantFocus = !isProfileComplete
    ? {
        title: 'Finish your profile',
        description: 'Your landlord can start the agreement after this step.',
        tab: 'profile',
        tone: 'accent',
      }
    : !contract
      ? {
          title: 'Agreement is on the way',
          description: 'Your landlord is preparing the agreement now.',
          tab: 'profile',
          tone: 'soft',
        }
      : !activeInvoice
        ? {
            title: "Submit this month's meter reading",
            description: 'Upload the meter photo once and your bill is created automatically.',
            tab: 'rent',
            tone: 'accent',
          }
        : ['DUE', 'OVERDUE'].includes(activeInvoice.derivedStatus)
          ? {
              title: `Pay ${formatCurrency(activeInvoice.totalAmount)}`,
              description:
                'After you pay, upload the proof and your landlord will do one final approval.',
              tab: 'rent',
              tone: activeInvoice.derivedStatus === 'OVERDUE' ? 'accent' : 'forest',
            }
          : activeInvoice.derivedStatus === 'PAYMENT_SUBMITTED'
            ? {
                title: 'Final approval pending',
                description:
                  'Your meter update and payment proof are both with the landlord now.',
                tab: 'rent',
                tone: 'soft',
              }
            : {
                title: 'You are all set',
                description: 'Your stay and rent are under control.',
                tab: 'home',
                tone: 'forest',
              };

  const heroCopy = {
    home: {
      eyebrow: 'Tenant',
      title: tenant.fullName || 'Your stay',
      subtitle: "Keep this month's bill, your meter update, and your agreement in one clear flow.",
      highlights: [
        room ? `Room ${room.label}` : 'Room pending',
        roomMeter ? `${roomMeter.lastReading} units` : 'Meter pending',
        currentDue,
      ],
    },
    rent: {
      eyebrow: 'Rent',
      title: activeInvoice ? formatCurrency(activeInvoice.totalAmount) : "Create this month's bill",
      subtitle: activeInvoice
        ? 'Your bill is already calculated from the meter reading. Pay once, upload proof once.'
        : "Upload the new reading and meter photo to generate this month's bill automatically.",
      highlights: [
        roomMeter ? `Last approved ${roomMeter.lastReading}` : 'No meter',
        activeReading?.status || 'READY',
        activeInvoice ? activeInvoice.derivedStatus : formatMonth(currentMonth),
      ],
    },
    profile: {
      eyebrow: 'Profile',
      title: 'Your details and agreement',
      subtitle: 'Keep your move-in details and agreement together in one place.',
      highlights: [
        tenant.profileStatus || 'PENDING',
        contract ? 'Agreement live' : 'Agreement pending',
        `${submissions.length} payment update${submissions.length === 1 ? '' : 's'}`,
      ],
    },
  }[activeTab];

  const renderActivityCard = () => (
    <SectionCard title="Recent updates" subtitle="The latest rent-related updates for your stay.">
      {activeReading || reminders.length || submissions.length ? (
        <View style={styles.stack}>
          {activeReading ? (
            <View key={`reading-${activeReading.id}`} style={styles.listCard}>
              <InlineGroup>
                <Text style={styles.listTitle}>Meter update for {formatMonth(activeReading.month)}</Text>
                <StatusBadge label={activeReading.status} />
              </InlineGroup>
              <Text style={styles.listText}>
                {activeReading.openingReading} to {activeReading.closingReading}
              </Text>
            </View>
          ) : null}
          {submissions.slice(0, 2).map((submission) => (
            <View key={submission.id} style={styles.listCard}>
              <InlineGroup>
                <Text style={styles.listTitle}>Payment proof shared</Text>
                <StatusBadge label={submission.status} />
              </InlineGroup>
              <Text style={styles.listText}>{submission.utr}</Text>
            </View>
          ))}
          {reminders.slice(0, 2).map((reminder) => (
            <View key={reminder.id} style={styles.listCard}>
              <InlineGroup>
                <Text style={styles.listTitle}>{reminder.title}</Text>
                <StatusBadge label={reminder.deliveryStatus} />
              </InlineGroup>
              <Text style={styles.listText}>{formatDate(reminder.triggerDate)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No updates yet"
          description="Meter, bill, and payment updates will appear here as your monthly cycle moves."
        />
      )}
    </SectionCard>
  );

  return (
    <ScreenSurface
      hero={<PageHeader eyebrow={heroCopy.eyebrow} title={heroCopy.title} subtitle={heroCopy.subtitle} highlights={heroCopy.highlights} />}
      bottomBar={<TabStrip tabs={tenantTabs} activeTab={activeTab} onChange={setActiveTab} />}
    >
      {state.isSyncing ? <Banner tone="info" message="Updating your latest rent details..." /> : null}
      {!feedback && state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}
      {feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null}

      {activeTab === 'home' ? (
        <>
          <FocusCard
            eyebrow="Next step"
            title={tenantFocus.title}
            description={tenantFocus.description}
            tone={tenantFocus.tone}
            actionLabel="Open"
            onAction={() => setActiveTab(tenantFocus.tab)}
          />
          <SectionCard title="Stay overview" subtitle="Only the details you need right now." tone="soft">
            <MetricRow
              items={[
                { label: 'Room', value: room ? room.label : 'Pending' },
                { label: 'Current due', value: currentDue },
                { label: 'Meter', value: roomMeter ? roomMeter.lastReading : 'Pending' },
              ]}
            />
            <KeyValueRow label="Agreement" value={contract ? 'Active' : 'Pending'} />
            <KeyValueRow
              label="This month"
              value={activeInvoice ? activeInvoice.derivedStatus.replaceAll('_', ' ') : 'Bill not created'}
            />
          </SectionCard>
          {renderActivityCard()}
        </>
      ) : null}

      {activeTab === 'rent' ? (
        <>
          <SectionCard
            title="This month"
            subtitle="The meter update, rent calculation, and payment proof all happen in one flow."
          >
            {tenancy ? (
              <>
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
                    />
                    <PrimaryButton
                      label={meterForm.photoUpload ? 'Replace meter photo' : 'Upload meter photo'}
                      tone="secondary"
                      onPress={chooseMeterPhoto}
                    />
                    <UploadPreview
                      title="Meter photo"
                      subtitle={meterForm.photoUpload?.fileName || 'Selected from your device'}
                      uri={meterForm.photoUpload?.previewUri}
                    />
                    <PrimaryButton
                      label="Create this month's bill"
                      onPress={() =>
                        handleAction(
                          () =>
                            actions.submitMeterReading({
                              tenancyId: tenancy.id,
                              month: currentMonth,
                              closingReading: Number(meterForm.closingReading),
                              photoUpload: meterForm.photoUpload,
                            }),
                          "This month's bill is ready. You can pay it now.",
                        )
                      }
                    />
                  </View>
                ) : (
                  <>
                    <InlineGroup>
                      <StatusBadge label={activeInvoice.derivedStatus} />
                      <Text style={styles.listText}>
                        {formatMonth(activeInvoice.month)} | due {formatDate(activeInvoice.dueDate)}
                      </Text>
                    </InlineGroup>
                    <MetricRow
                      items={[
                        { label: 'Total due', value: formatCurrency(activeInvoice.totalAmount) },
                        { label: 'Rent', value: formatCurrency(activeInvoice.baseRent) },
                        {
                          label: 'Electricity',
                          value: formatCurrency(activeInvoice.electricityCharge),
                        },
                      ]}
                    />
                    {activeReading ? (
                      <>
                        <KeyValueRow
                          label="Meter reading"
                          value={`${activeReading.openingReading} to ${activeReading.closingReading}`}
                        />
                        <KeyValueRow
                          label="Units used"
                          value={String(activeReading.closingReading - activeReading.openingReading)}
                        />
                      </>
                    ) : null}
                    <UploadPreview
                      title="Meter photo"
                      subtitle={activeReading?.photoLabel || 'Uploaded meter proof'}
                      uri={meterPreviewUri}
                    />

                    {['DUE', 'OVERDUE'].includes(activeInvoice.derivedStatus) ? (
                      <>
                        {activeSubmission?.status === 'REJECTED' ? (
                          <Banner
                            tone="danger"
                            message="The last final review was rejected. Upload a fresh payment proof below."
                          />
                        ) : null}
                        <QrCard
                          value={activeInvoice.paymentLink}
                          subtitle={`${state.settlementAccount.payeeName} | ${state.settlementAccount.upiId}`}
                        />
                        <PrimaryButton
                          label="Open UPI app"
                          tone="secondary"
                          onPress={() =>
                            Linking.openURL(activeInvoice.paymentLink).catch(() =>
                              setFeedback({
                                tone: 'danger',
                                text: 'We could not open a UPI app on this device.',
                              }),
                            )
                          }
                        />
                        <View style={styles.formStack}>
                          <Field
                            label="UTR / reference number"
                            value={paymentForm.utr}
                            onChangeText={(value) =>
                              setPaymentForm((current) => ({ ...current, utr: value }))
                            }
                          />
                          <PrimaryButton
                            label={
                              paymentForm.proofUpload
                                ? 'Replace payment proof'
                                : 'Upload payment proof'
                            }
                            tone="secondary"
                            onPress={choosePaymentProof}
                          />
                          <UploadPreview
                            title="Payment proof"
                            subtitle={
                              paymentForm.proofUpload?.fileName || 'Selected from your device'
                            }
                            uri={paymentForm.proofUpload?.previewUri}
                          />
                          <Field
                            label="Note for landlord (optional)"
                            value={paymentForm.note}
                            onChangeText={(value) =>
                              setPaymentForm((current) => ({ ...current, note: value }))
                            }
                            multiline
                          />
                          <PrimaryButton
                            label="Send for final approval"
                            onPress={() =>
                              handleAction(
                                async () => {
                                  await actions.submitPayment({
                                    invoiceId: activeInvoice.id,
                                    utr: paymentForm.utr,
                                    note: paymentForm.note,
                                    proofUpload: paymentForm.proofUpload,
                                  });
                                  setPaymentForm({ utr: '', note: '', proofUpload: null });
                                },
                                'Payment proof shared. Your landlord now has one final approval to do.',
                              )
                            }
                          />
                        </View>
                      </>
                    ) : null}

                    {activeInvoice.derivedStatus === 'PAYMENT_SUBMITTED' ? (
                      <>
                        <UploadPreview
                          title="Payment proof"
                          subtitle={activeSubmission?.screenshotLabel || 'Uploaded payment proof'}
                          uri={paymentProofUri}
                        />
                        <EmptyState
                          title="Final approval pending"
                          description="Your landlord will confirm the meter update and the payment together in one review."
                        />
                      </>
                    ) : null}

                    {activeInvoice.derivedStatus === 'PAID' ? (
                      <>
                        <UploadPreview
                          title="Payment proof"
                          subtitle={activeSubmission?.screenshotLabel || 'Approved payment proof'}
                          uri={paymentProofUri}
                        />
                        <EmptyState
                          title="Payment confirmed"
                          description="This month is closed and approved."
                        />
                      </>
                    ) : null}
                  </>
                )}
              </>
            ) : (
              <EmptyState
                title="Your stay is not active yet"
                description="Complete onboarding first. Monthly meter updates start after the stay is active."
              />
            )}
          </SectionCard>
          {renderActivityCard()}
        </>
      ) : null}

      {activeTab === 'profile' ? (
        <>
          <SectionCard title="Your stay" subtitle="Profile, room, and account actions live here." tone="soft">
            <KeyValueRow label="Room" value={room ? `Room ${room.label}` : 'Pending'} />
            <KeyValueRow label="Profile status" value={tenant.profileStatus || 'PENDING'} />
            <KeyValueRow label="Agreement" value={contract ? 'Active' : 'Pending'} />
            <PrimaryButton label="Log out" tone="secondary" onPress={onLogout} />
          </SectionCard>
          <SectionCard title="Profile" subtitle="Update only the details your landlord needs.">
            <ChoiceChips options={profileModes} value={profileMode} onChange={setProfileMode} />
            {profileMode === 'details' ? (
              <>
                <Field label="Full name" value={profileForm.fullName} onChangeText={(value) => setProfileForm((current) => ({ ...current, fullName: value }))} />
                <Field label="Email" value={profileForm.email} onChangeText={(value) => setProfileForm((current) => ({ ...current, email: value }))} keyboardType="email-address" />
                <Field label="Emergency contact number" value={profileForm.emergencyContact} onChangeText={(value) => setProfileForm((current) => ({ ...current, emergencyContact: value }))} keyboardType="phone-pad" />
                <Field label="ID number" value={profileForm.idDocument} onChangeText={(value) => setProfileForm((current) => ({ ...current, idDocument: value }))} />
                <Field label="Anything your landlord should know" value={profileForm.notes} onChangeText={(value) => setProfileForm((current) => ({ ...current, notes: value }))} multiline />
                <PrimaryButton label="Save details" onPress={() => handleAction(() => actions.completeTenantProfile({ tenantId: tenant.id, ...profileForm }), 'Profile saved.')} />
              </>
            ) : contract ? (
              <>
                <KeyValueRow label="Move-in date" value={formatDate(contract.moveInDate)} />
                <KeyValueRow label="Agreement term" value={`${formatDate(contract.contractStart)} to ${formatDate(contract.contractEnd)}`} />
                <KeyValueRow label="Monthly rent" value={formatCurrency(contract.rentAmount)} />
                <KeyValueRow label="Deposit" value={formatCurrency(contract.depositAmount)} />
                <KeyValueRow label="Monthly due date" value={`Day ${contract.dueDay} of each month`} />
              </>
            ) : <EmptyState title="Agreement not active yet" description="Once your landlord confirms the agreement, the details will appear here." />}
          </SectionCard>
        </>
      ) : null}
    </ScreenSurface>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  formStack: {
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  listCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  listTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
  },
  listText: {
    color: palette.inkSoft,
    lineHeight: 21,
  },
  previewCard: {
    gap: 10,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  previewSubtitle: {
    color: palette.inkSoft,
    lineHeight: 20,
  },
  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: 18,
    backgroundColor: palette.surfaceMuted,
  },
});
