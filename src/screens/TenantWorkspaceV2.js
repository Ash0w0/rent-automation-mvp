import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  Banner,
  ChoiceChips,
  EmptyState,
  Field,
  FeatureCard,
  FocusCard,
  InlineGroup,
  KeyValueRow,
  MetricRow,
  PageHeader,
  PrimaryButton,
  QrCard,
  SearchCluster,
  ScreenSurface,
  SectionCard,
  StatusBadge,
  TabStrip,
  palette,
} from '../components/uiAirbnb';

const { formatCurrency, formatDate, formatMonth } = require('../lib/dateUtils');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const tenantTabs = [
  { label: 'Overview', value: 'home' },
  { label: 'Rent', value: 'rent' },
  { label: 'Stay', value: 'stay' },
];

const TENANT_HOME_IMAGE =
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80';
const TENANT_RENT_IMAGE =
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1400&q=80';

export function TenantWorkspaceV2({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [feedback, setFeedback] = useState(null);
  const tenant = state.tenants.find((record) => record.id === state.session.currentTenantId);
  const tenancy = state.tenancies.find(
    (record) =>
      record.tenantId === tenant?.id &&
      ['INVITED', 'ACTIVE', 'MOVE_OUT_SCHEDULED'].includes(record.status),
  );
  const room = tenancy ? state.rooms.find((record) => record.id === tenancy.roomId) : null;
  const contract = tenancy?.contractId ? state.contracts.find((record) => record.id === tenancy.contractId) : null;
  const invoices = useMemo(
    () =>
      state.invoices
        .filter((invoice) => invoice.tenantId === tenant?.id)
        .map((invoice) => ({ ...invoice, derivedStatus: deriveInvoiceStatus(invoice, state.referenceDate) }))
        .sort((left, right) => right.month.localeCompare(left.month)),
    [state.invoices, tenant?.id, state.referenceDate],
  );
  const currentInvoice = invoices.find((invoice) => invoice.derivedStatus !== 'PAID') || invoices[0];
  const reminders = state.reminders
    .filter((reminder) => reminder.tenantId === tenant?.id)
    .sort((left, right) => left.triggerDate.localeCompare(right.triggerDate));
  const submissions = state.paymentSubmissions
    .filter((submission) => submission.tenantId === tenant?.id)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  const isProfileComplete = tenant?.profileStatus === 'COMPLETE';

  const [profileForm, setProfileForm] = useState({
    fullName: tenant?.fullName || '',
    email: tenant?.email || '',
    emergencyContact: tenant?.emergencyContact || '',
    idDocument: tenant?.idDocument || '',
    notes: tenant?.notes || '',
  });
  const [paymentForm, setPaymentForm] = useState({ utr: '', screenshotLabel: '', note: '' });

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

  if (!tenant) {
    return (
      <ScreenSurface>
        <PageHeader
          eyebrow="Tenant"
          title="We could not find this tenant"
          subtitle="Use one of the demo tenant numbers from the sign-in screen."
          actionLabel="Log out"
          onAction={onLogout}
        />
      </ScreenSurface>
    );
  }

  const tenantFocus = !isProfileComplete
    ? { title: 'Finish your profile', description: 'Your landlord can start the agreement after this step.', tab: 'stay', tone: 'accent' }
    : !contract
      ? { title: 'Your profile is done', description: 'Your landlord is preparing the agreement now.', tab: 'stay', tone: 'soft' }
      : currentInvoice && ['DUE', 'OVERDUE'].includes(currentInvoice.derivedStatus)
        ? { title: `Pay ${formatCurrency(currentInvoice.totalAmount)}`, description: 'Pay by UPI, then share the payment proof.', tab: 'rent', tone: currentInvoice.derivedStatus === 'OVERDUE' ? 'accent' : 'forest' }
        : currentInvoice?.derivedStatus === 'PAYMENT_SUBMITTED'
          ? { title: 'Payment shared', description: 'Your landlord is reviewing it now.', tab: 'rent', tone: 'soft' }
          : { title: 'You are all set', description: 'Use the tabs below whenever you need rent or stay details.', tab: 'home', tone: 'forest' };

  const renderHome = () => (
    <>
      <SearchCluster
        items={[
          { label: 'Room', value: room ? `Room ${room.label}` : 'Pending' },
          { label: 'Current due', value: currentInvoice ? formatCurrency(currentInvoice.totalAmount) : 'No bill' },
          { label: 'Next update', value: reminders[0] ? formatDate(reminders[0].triggerDate) : 'No reminders' },
        ]}
        actionLabel="Open rent"
        onAction={() => setActiveTab('rent')}
      />

      <FeatureCard
        imageUri={TENANT_HOME_IMAGE}
        eyebrow="Tenant overview"
        title={tenantFocus.title}
        description={tenantFocus.description}
        badges={[
          contract ? 'Agreement active' : 'Agreement pending',
          isProfileComplete ? 'Profile complete' : 'Profile pending',
          currentInvoice ? formatMonth(currentInvoice.month) : 'No current bill',
        ]}
        actionLabel="Open next step"
        onAction={() => setActiveTab(tenantFocus.tab)}
      />

      <FocusCard
        eyebrow="Next step"
        title={tenantFocus.title}
        description={tenantFocus.description}
        tone={tenantFocus.tone}
        actionLabel="Open"
        onAction={() => setActiveTab(tenantFocus.tab)}
      />

      <SectionCard title={`Welcome, ${tenant.fullName || 'tenant'}`} subtitle="Only the essentials you need right now." tone="soft">
        <MetricRow
          items={[
            { label: 'Room', value: room ? room.label : 'Pending' },
            { label: 'Current due', value: currentInvoice ? formatCurrency(currentInvoice.totalAmount) : 'No bill' },
            { label: 'Updates', value: reminders.length },
          ]}
        />
      </SectionCard>

      <SectionCard title="Recent updates" subtitle="Latest messages linked to your rent and stay.">
        {reminders.length ? (
          <View style={styles.stack}>
            {reminders.slice(0, 3).map((reminder) => (
              <View key={reminder.id} style={styles.listCard}>
                <InlineGroup>
                  <StatusBadge label={reminder.channel} />
                  <StatusBadge label={reminder.deliveryStatus} />
                </InlineGroup>
                <Text style={styles.titleText}>{reminder.title}</Text>
                <Text style={styles.subtleText}>{formatDate(reminder.triggerDate)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="No reminders yet" description="Reminder updates will appear here after your landlord raises a bill." />
        )}
      </SectionCard>
    </>
  );

  const renderRent = () => (
    <>
      <FeatureCard
        imageUri={TENANT_RENT_IMAGE}
        eyebrow="Rent"
        title="Pay in two simple steps"
        description="Step 1: pay by UPI. Step 2: share proof so your landlord can confirm it."
        tone="soft"
      />

      <SectionCard title="Current bill" subtitle="Your latest bill and payment actions live here.">
        {currentInvoice ? (
          <>
            <InlineGroup>
              <StatusBadge label={currentInvoice.derivedStatus} />
              <Text style={styles.subtleText}>{formatMonth(currentInvoice.month)}</Text>
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
                  setFeedback({ tone: 'danger', text: "We could not open a UPI app on this device." }),
                )
              }
            />

            {['PAYMENT_SUBMITTED', 'PAID'].includes(currentInvoice.derivedStatus) ? (
              <EmptyState
                title={currentInvoice.derivedStatus === 'PAID' ? 'Payment confirmed' : 'Proof submitted'}
                description={
                  currentInvoice.derivedStatus === 'PAID'
                    ? 'Your landlord has approved this payment.'
                    : 'Your payment is waiting for landlord review.'
                }
              />
            ) : (
              <View style={styles.innerPanel}>
                <Text style={styles.innerTitle}>After payment, share proof</Text>
                <Text style={styles.innerSubtitle}>Your landlord uses this to confirm the payment.</Text>
                <Field label="UTR / reference number" value={paymentForm.utr} onChangeText={(value) => setPaymentForm((current) => ({ ...current, utr: value }))} />
                <Field label="Proof file or screenshot name" value={paymentForm.screenshotLabel} onChangeText={(value) => setPaymentForm((current) => ({ ...current, screenshotLabel: value }))} placeholder="upi-proof.png" />
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
              </View>
            )}
          </>
        ) : (
          <EmptyState title="No rent bill yet" description="Your current bill will appear here after your landlord generates it." />
        )}
      </SectionCard>
    </>
  );

  const renderStay = () => (
    <>
      <FocusCard
        eyebrow="Stay"
        title="Profile and agreement live together here"
        description="Use this area for move-in details, room information, and the agreement attached to your stay."
        tone="soft"
      />

      <SectionCard title="Move-in checklist" subtitle="A quick way to see what is still pending.">
        <View style={styles.stack}>
          <View style={styles.listCard}>
            <InlineGroup>
              <Text style={styles.titleText}>Profile details</Text>
              <StatusBadge label={tenant.profileStatus || 'PENDING'} />
            </InlineGroup>
            <Text style={styles.subtleText}>Add your contact and ID details so the landlord can activate the stay.</Text>
          </View>
          <View style={styles.listCard}>
            <InlineGroup>
              <Text style={styles.titleText}>Agreement</Text>
              <StatusBadge label={contract ? 'COMPLETE' : 'PENDING'} />
            </InlineGroup>
            <Text style={styles.subtleText}>{contract ? 'Your agreement is active.' : 'Your landlord still needs to activate the agreement.'}</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Your details" subtitle="Update the details your landlord needs to keep on file.">
        <Field label="Full name" value={profileForm.fullName} onChangeText={(value) => setProfileForm((current) => ({ ...current, fullName: value }))} />
        <Field label="Email" value={profileForm.email} onChangeText={(value) => setProfileForm((current) => ({ ...current, email: value }))} keyboardType="email-address" />
        <Field label="Emergency contact number" value={profileForm.emergencyContact} onChangeText={(value) => setProfileForm((current) => ({ ...current, emergencyContact: value }))} keyboardType="phone-pad" />
        <Field label="ID number" value={profileForm.idDocument} onChangeText={(value) => setProfileForm((current) => ({ ...current, idDocument: value }))} />
        <Field label="Anything your landlord should know" value={profileForm.notes} onChangeText={(value) => setProfileForm((current) => ({ ...current, notes: value }))} multiline />
        <PrimaryButton label="Save details" onPress={() => handleAction(() => actions.completeTenantProfile({ tenantId: tenant.id, ...profileForm }), 'Profile saved.')} />
      </SectionCard>

      <SectionCard title="Agreement" subtitle="Your active agreement details.">
        {contract ? (
          <>
            <KeyValueRow label="Room" value={room ? `Room ${room.label}` : 'Pending'} />
            <KeyValueRow label="Move-in date" value={formatDate(contract.moveInDate)} />
            <KeyValueRow label="Agreement term" value={`${formatDate(contract.contractStart)} to ${formatDate(contract.contractEnd)}`} />
            <KeyValueRow label="Rent" value={formatCurrency(contract.rentAmount)} />
            <KeyValueRow label="Deposit" value={formatCurrency(contract.depositAmount)} />
            <KeyValueRow label="Monthly due date" value={`Day ${contract.dueDay} of each month`} />
          </>
        ) : (
          <EmptyState title="Agreement not active yet" description="Once your landlord confirms the agreement, the details will appear here." />
        )}
      </SectionCard>
    </>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'rent':
        return renderRent();
      case 'stay':
        return renderStay();
      default:
        return renderHome();
    }
  };

  return (
    <ScreenSurface bottomBar={<TabStrip tabs={tenantTabs} activeTab={activeTab} onChange={setActiveTab} />}>
      <PageHeader
        eyebrow="Tenant"
        title={tenant.fullName || 'Your stay'}
        subtitle="Overview keeps the next step visible. Rent handles payments. Stay keeps your profile and agreement together."
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
      {renderCurrentTab()}
    </ScreenSurface>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  listCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  innerPanel: {
    gap: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: palette.surfaceTint,
    borderWidth: 1,
    borderColor: '#FFD8DF',
  },
  innerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
  },
  innerSubtitle: {
    color: palette.muted,
    lineHeight: 22,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
  },
  subtleText: {
    color: palette.muted,
    lineHeight: 22,
  },
});
