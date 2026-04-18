import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  ActionGrid,
  Banner,
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
} from '../components/ui';

const { formatCurrency, formatDate, formatMonth } = require('../lib/dateUtils');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const tenantTabs = [
  { label: 'Home', value: 'home', meta: 'See your next step right away.' },
  { label: 'Move-in', value: 'move_in', meta: 'Finish profile and check your agreement.' },
  { label: 'Rent', value: 'rent', meta: 'Pay the current bill and submit proof.' },
  { label: 'Activity', value: 'activity', meta: 'Review reminders, bills, and payment updates.' },
];

export function TenantWorkspace({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [feedback, setFeedback] = useState(null);

  const tenant = state.tenants.find((record) => record.id === state.session.currentTenantId);
  const tenancy = state.tenancies.find(
    (record) =>
      record.tenantId === tenant?.id &&
      ['INVITED', 'ACTIVE', 'MOVE_OUT_SCHEDULED'].includes(record.status),
  );
  const room = tenancy ? state.rooms.find((record) => record.id === tenancy.roomId) : null;
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
  const currentInvoice =
    invoices.find((invoice) => invoice.derivedStatus !== 'PAID') || invoices[0];
  const reminders = state.reminders
    .filter((reminder) => reminder.tenantId === tenant?.id)
    .sort((left, right) => left.triggerDate.localeCompare(right.triggerDate));
  const submissions = state.paymentSubmissions
    .filter((submission) => submission.tenantId === tenant?.id)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  const pendingReminderCount = reminders.filter((reminder) => reminder.deliveryStatus !== 'CANCELED').length;
  const isProfileComplete = tenant?.profileStatus === 'COMPLETE';
  const isAgreementActive = Boolean(contract);

  const [profileForm, setProfileForm] = useState({
    fullName: tenant?.fullName || '',
    email: tenant?.email || '',
    emergencyContact: tenant?.emergencyContact || '',
    idDocument: tenant?.idDocument || '',
    notes: tenant?.notes || '',
  });
  const [paymentForm, setPaymentForm] = useState({
    utr: '',
    screenshotLabel: '',
    note: '',
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

  const handleAction = async (callback, successMessage) => {
    try {
      setFeedback(null);
      await callback();
      setFeedback({ tone: 'success', text: successMessage });
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  const tenantFocus = (() => {
    if (!isProfileComplete) {
      return {
        eyebrow: 'Next step',
        title: 'Complete your move-in details',
        description: 'Finish your profile so your landlord can activate the agreement.',
        tab: 'move_in',
        actionLabel: 'Complete move-in',
        tone: 'accent',
      };
    }

    if (!isAgreementActive) {
      return {
        eyebrow: 'Next step',
        title: 'Wait for agreement confirmation',
        description: 'Your details are done. Your landlord now needs to activate the agreement.',
        tab: 'move_in',
        actionLabel: 'Review move-in',
        tone: 'soft',
      };
    }

    if (currentInvoice && ['DUE', 'OVERDUE'].includes(currentInvoice.derivedStatus)) {
      return {
        eyebrow: 'Next step',
        title: `Pay ${formatCurrency(currentInvoice.totalAmount)} for ${formatMonth(currentInvoice.month)}`,
        description: 'Open your UPI app, make the payment, and share proof for review.',
        tab: 'rent',
        actionLabel: 'Pay rent',
        tone: currentInvoice.derivedStatus === 'OVERDUE' ? 'accent' : 'forest',
      };
    }

    if (currentInvoice?.derivedStatus === 'PAYMENT_SUBMITTED') {
      return {
        eyebrow: 'Latest update',
        title: 'Your payment proof is under review',
        description: 'No extra action is needed. Your landlord will confirm the payment soon.',
        tab: 'activity',
        actionLabel: 'See activity',
        tone: 'soft',
      };
    }

    return {
      eyebrow: 'You are up to date',
      title: 'Your stay is on track',
      description: 'Use the tabs below whenever you need your agreement, rent details, or reminder history.',
      tab: 'activity',
      actionLabel: 'View activity',
      tone: 'forest',
    };
  })();

  if (!tenant) {
    return (
      <ScreenSurface>
        <PageHeader
          eyebrow="Tenant space"
          title="We couldn't find this tenant"
          subtitle="Use one of the demo tenant numbers from the sign-in screen."
          actionLabel="Log out"
          onAction={onLogout}
        />
      </ScreenSurface>
    );
  }

  const renderHome = () => (
    <>
      <FocusCard
        eyebrow={tenantFocus.eyebrow}
        title={tenantFocus.title}
        description={tenantFocus.description}
        tone={tenantFocus.tone}
        actionLabel={tenantFocus.actionLabel}
        onAction={() => setActiveTab(tenantFocus.tab)}
      />

      <SectionCard title={`Welcome, ${tenant.fullName || 'tenant'}`} subtitle="Your room, rent status, and next step all live here." tone="soft">
        <InlineGroup>
          <StatusBadge label={tenant.profileStatus || 'PENDING'} />
          {tenancy ? <StatusBadge label={tenancy.status} /> : null}
        </InlineGroup>
        <MetricRow
          items={[
            { label: 'Assigned room', value: room ? room.label : 'Pending' },
            { label: 'Current due', value: currentInvoice ? formatCurrency(currentInvoice.totalAmount) : 'No bill' },
            { label: 'Reminder updates', value: pendingReminderCount },
          ]}
        />
      </SectionCard>

      <SectionCard title="What you can do here" subtitle="The tenant app is split into clear journeys so you do not have to guess where to go.">
        <ActionGrid
          items={[
            {
              eyebrow: isProfileComplete ? 'Done' : 'Needs action',
              title: 'Finish move-in',
              description: 'Complete your profile and check the agreement details from one place.',
              label: 'Open move-in',
              onPress: () => setActiveTab('move_in'),
              tone: isProfileComplete && isAgreementActive ? 'forest' : 'accent',
            },
            {
              eyebrow: currentInvoice ? currentInvoice.derivedStatus.replaceAll('_', ' ') : 'No bill yet',
              title: 'Pay rent',
              description: 'Use UPI for the current bill and upload the reference after payment.',
              label: 'Open rent',
              onPress: () => setActiveTab('rent'),
            },
            {
              eyebrow: `${reminders.length} update${reminders.length === 1 ? '' : 's'}`,
              title: 'Track reminders',
              description: 'See any WhatsApp or in-app reminders linked to your rent cycle.',
              label: 'Open activity',
              onPress: () => setActiveTab('activity'),
            },
            {
              eyebrow: `${submissions.length} submission${submissions.length === 1 ? '' : 's'}`,
              title: 'Check payment status',
              description: 'Review whether your proof is pending, approved, or rejected.',
              label: 'See activity',
              onPress: () => setActiveTab('activity'),
              tone: 'forest',
            },
          ]}
        />
      </SectionCard>

      <SectionCard title="Latest reminder updates" subtitle="Any in-app or WhatsApp reminders from your landlord will appear here." tone="accent">
        {reminders.length ? (
          reminders.slice(0, 4).map((reminder) => (
            <View key={reminder.id} style={{ gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
              <InlineGroup>
                <StatusBadge label={reminder.channel} />
                <StatusBadge label={reminder.deliveryStatus} />
              </InlineGroup>
              <Text style={{ fontWeight: '700', color: '#19231f' }}>{reminder.title}</Text>
              <Text style={{ color: '#66756d' }}>{formatDate(reminder.triggerDate)}</Text>
            </View>
          ))
        ) : (
          <EmptyState title="No reminders right now" description="Once a rent bill is issued, reminder updates will show here." />
        )}
      </SectionCard>
    </>
  );

  const renderMoveIn = () => (
    <>
      <FocusCard
        eyebrow="Move-in journey"
        title="Finish your details, then review the agreement"
        description="This tab combines the two things a tenant needs before regular rent begins: profile completion and agreement confirmation."
        tone="accent"
      />

      <SectionCard title="Move-in checklist" subtitle="Use this as your progress tracker.">
        <View style={styles.stack}>
          <View style={styles.checklistRow}>
            <InlineGroup>
              <Text style={styles.checklistTitle}>1. Profile details</Text>
              <StatusBadge label={tenant.profileStatus || 'PENDING'} />
            </InlineGroup>
            <Text style={styles.supportingText}>Add your contact and ID details so the landlord can activate the stay.</Text>
          </View>
          <View style={styles.checklistRow}>
            <InlineGroup>
              <Text style={styles.checklistTitle}>2. Room assignment</Text>
              <StatusBadge label={room ? 'COMPLETE' : 'PENDING'} />
            </InlineGroup>
            <Text style={styles.supportingText}>{room ? `Room ${room.label} is assigned to you.` : 'Your room number will appear here once assigned.'}</Text>
          </View>
          <View style={styles.checklistRow}>
            <InlineGroup>
              <Text style={styles.checklistTitle}>3. Agreement activation</Text>
              <StatusBadge label={contract ? 'COMPLETE' : 'PENDING'} />
            </InlineGroup>
            <Text style={styles.supportingText}>{contract ? 'Your agreement is active and rent tracking is live.' : 'Your landlord still needs to confirm the signed agreement.'}</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Your profile" subtitle="Your landlord can activate the agreement only after these details are complete." tone="soft">
        <Field label="Full name" value={profileForm.fullName} onChangeText={(value) => setProfileForm((current) => ({ ...current, fullName: value }))} />
        <Field label="Email" value={profileForm.email} onChangeText={(value) => setProfileForm((current) => ({ ...current, email: value }))} keyboardType="email-address" />
        <Field label="Emergency contact number" value={profileForm.emergencyContact} onChangeText={(value) => setProfileForm((current) => ({ ...current, emergencyContact: value }))} keyboardType="phone-pad" />
        <Field label="ID number" value={profileForm.idDocument} onChangeText={(value) => setProfileForm((current) => ({ ...current, idDocument: value }))} />
        <Field label="Anything your landlord should know" value={profileForm.notes} onChangeText={(value) => setProfileForm((current) => ({ ...current, notes: value }))} multiline />
        <PrimaryButton
          label="Save details"
          onPress={() =>
            handleAction(
              () => actions.completeTenantProfile({ tenantId: tenant.id, ...profileForm }),
              'Profile saved.',
            )
          }
        />
      </SectionCard>

      <SectionCard title="Your agreement" subtitle="Once your landlord uploads the signed agreement, the key terms will appear here." tone="forest">
        {contract ? (
          <>
            <InlineGroup>
              <StatusBadge label={tenancy.status} />
              <Text style={styles.supportingText}>{contract.fileName}</Text>
            </InlineGroup>
            <KeyValueRow label="Move-in date" value={formatDate(contract.moveInDate)} />
            <KeyValueRow label="Agreement term" value={`${formatDate(contract.contractStart)} to ${formatDate(contract.contractEnd)}`} />
            <KeyValueRow label="Rent" value={formatCurrency(contract.rentAmount)} />
            <KeyValueRow label="Deposit" value={formatCurrency(contract.depositAmount)} />
            <KeyValueRow label="Monthly due date" value={`Day ${contract.dueDay} of each month`} />
          </>
        ) : (
          <EmptyState title="Agreement not active yet" description="Finish your profile first. After your landlord confirms the agreement, the details will appear here." />
        )}
      </SectionCard>
    </>
  );

  const renderRent = () => (
    <>
      <FocusCard
        eyebrow="Rent flow"
        title="Pay the bill, then share proof"
        description="This screen follows the real tenant payment journey: check the amount, pay by UPI, and submit the reference for landlord review."
        tone="forest"
      />

      <SectionCard title="This month’s rent" subtitle="Use UPI to pay the current bill, then upload the payment reference for review." tone="soft">
        {currentInvoice ? (
          <>
            <InlineGroup>
              <StatusBadge label={currentInvoice.derivedStatus} />
              <Text style={styles.supportingText}>{formatMonth(currentInvoice.month)}</Text>
            </InlineGroup>
            <MetricRow
              items={[
                { label: 'Total due', value: formatCurrency(currentInvoice.totalAmount) },
                { label: 'Due date', value: formatDate(currentInvoice.dueDate) },
              ]}
            />
            <QrCard
              value={currentInvoice.paymentLink}
              subtitle={`${state.settlementAccount.payeeName} | ${state.settlementAccount.upiId}`}
            />
            <KeyValueRow label="Rent" value={formatCurrency(currentInvoice.baseRent)} />
            <KeyValueRow label="Electricity" value={formatCurrency(currentInvoice.electricityCharge)} />
            <PrimaryButton
              label="Open UPI app"
              tone="ghost"
              onPress={() =>
                Linking.openURL(currentInvoice.paymentLink).catch(() =>
                  setFeedback({ tone: 'danger', text: "We couldn't open a UPI app on this device." }),
                )
              }
            />
            {['PAYMENT_SUBMITTED', 'PAID'].includes(currentInvoice.derivedStatus) ? (
              <EmptyState
                title={currentInvoice.derivedStatus === 'PAID' ? 'Payment confirmed' : 'Proof submitted'}
                description={
                  currentInvoice.derivedStatus === 'PAID'
                    ? 'Your landlord has approved this payment. No action is needed.'
                    : 'Your payment is waiting for landlord review.'
                }
              />
            ) : (
              <>
                <SectionCard title="After payment, share your proof" subtitle="This is what your landlord uses to mark the bill paid." tone="accent">
                  <Field label="UTR / reference number" value={paymentForm.utr} onChangeText={(value) => setPaymentForm((current) => ({ ...current, utr: value }))} />
                  <Field label="Proof file or screenshot name" value={paymentForm.screenshotLabel} onChangeText={(value) => setPaymentForm((current) => ({ ...current, screenshotLabel: value }))} placeholder="upi-proof-april.png" />
                  <Field label="Note for landlord (optional)" value={paymentForm.note} onChangeText={(value) => setPaymentForm((current) => ({ ...current, note: value }))} multiline />
                  <PrimaryButton
                    label="Submit proof"
                    onPress={() =>
                      handleAction(
                        async () => {
                          await actions.submitPayment({ invoiceId: currentInvoice.id, ...paymentForm });
                          setPaymentForm({ utr: '', screenshotLabel: '', note: '' });
                        },
                        'Payment proof shared for review.',
                      )
                    }
                  />
                </SectionCard>
              </>
            )}
          </>
        ) : (
          <EmptyState title="No rent bill yet" description="Your current bill will appear here after your landlord generates it." />
        )}
      </SectionCard>
    </>
  );

  const renderActivity = () => (
    <>
      <FocusCard
        eyebrow="Activity"
        title="Check reminders, rent history, and payment updates"
        description="This is your record of what has happened already: reminders sent, bills raised, and payment proof status."
        tone="soft"
      />

      <SectionCard title="Reminder history" subtitle="Use this list to track what your landlord has sent you and when." tone="accent">
        {reminders.length ? (
          reminders.map((reminder) => (
            <View key={reminder.id} style={{ gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
              <InlineGroup>
                <StatusBadge label={reminder.channel} />
                <StatusBadge label={reminder.deliveryStatus} />
              </InlineGroup>
              <Text style={{ fontWeight: '800', color: '#19231f' }}>{reminder.title}</Text>
              <Text style={{ color: '#66756d' }}>{formatDate(reminder.triggerDate)}</Text>
            </View>
          ))
        ) : (
          <EmptyState title="No reminder history yet" description="Reminder activity will appear here after your landlord raises a bill." />
        )}
      </SectionCard>

      <SectionCard title="Rent history" subtitle="Each bill shows the exact rent and electricity snapshot used for that month.">
        {invoices.length ? (
          invoices.map((invoice) => (
            <View key={invoice.id} style={{ gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
              <InlineGroup>
                <Text style={{ fontWeight: '800', color: '#19231f' }}>{formatMonth(invoice.month)}</Text>
                <StatusBadge label={invoice.derivedStatus} />
              </InlineGroup>
              <KeyValueRow label="Base rent" value={formatCurrency(invoice.baseRent)} />
              <KeyValueRow label="Electricity" value={formatCurrency(invoice.electricityCharge)} />
              <KeyValueRow label="Total" value={formatCurrency(invoice.totalAmount)} />
            </View>
          ))
        ) : (
          <EmptyState title="No rent history yet" description="Your first rent bill will appear after the agreement is active." />
        )}
      </SectionCard>

      <SectionCard title="Payment proof history" subtitle="See whether your submitted proof is pending, approved, or rejected." tone="forest">
        {submissions.length ? (
          submissions.map((submission) => (
            <View key={submission.id} style={{ gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
              <InlineGroup>
                <StatusBadge label={submission.status} />
                <Text style={{ color: '#66756d' }}>{formatDate(submission.submittedAt)}</Text>
              </InlineGroup>
              <KeyValueRow label="UTR" value={submission.utr} />
              <KeyValueRow label="Proof" value={submission.screenshotLabel} />
            </View>
          ))
        ) : (
          <EmptyState title="No payment proof history" description="After you submit a payment reference, it will appear here." />
        )}
      </SectionCard>
    </>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'move_in':
        return renderMoveIn();
      case 'rent':
        return renderRent();
      case 'activity':
        return renderActivity();
      default:
        return renderHome();
    }
  };

  return (
    <ScreenSurface>
      <PageHeader
        eyebrow="Tenant space"
        title="Everything a tenant needs, without the clutter"
        subtitle="Move through your stay in a simple order: home, move-in, rent, and activity."
        highlights={[
          room ? `Room ${room.label}` : 'Room pending',
          currentInvoice ? `${formatCurrency(currentInvoice.totalAmount)} due` : 'No bill yet',
          `${submissions.length} payment update${submissions.length === 1 ? '' : 's'}`,
        ]}
        actionLabel="Log out"
        onAction={onLogout}
      />
      {state.isSyncing ? <Banner tone="info" message="Updating your latest rent details..." /> : null}
      {!feedback && state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}
      {feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null}
      <TabStrip tabs={tenantTabs} activeTab={activeTab} onChange={setActiveTab} />
      {renderCurrentTab()}
    </ScreenSurface>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  checklistRow: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 8,
  },
  checklistTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.ink,
  },
  supportingText: {
    color: palette.muted,
    lineHeight: 20,
  },
});
