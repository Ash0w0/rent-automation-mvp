import React, { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import {
  Banner,
  EmptyState,
  Field,
  InlineGroup,
  KeyValueRow,
  PageHeader,
  PrimaryButton,
  QrCard,
  ScreenSurface,
  SectionCard,
  StatusBadge,
  TabStrip,
} from '../components/ui';

const { formatCurrency, formatDate, formatMonth } = require('../lib/dateUtils');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const tenantTabs = [
  { label: 'Home', value: 'home' },
  { label: 'Profile', value: 'profile' },
  { label: 'Contract', value: 'contract' },
  { label: 'Payments', value: 'payments' },
  { label: 'History', value: 'history' },
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
  const invoices = state.invoices
    .filter((invoice) => invoice.tenantId === tenant?.id)
    .map((invoice) => ({ ...invoice, derivedStatus: deriveInvoiceStatus(invoice, state.referenceDate) }))
    .sort((left, right) => right.month.localeCompare(left.month));
  const currentInvoice =
    invoices.find((invoice) => invoice.derivedStatus !== 'PAID') || invoices[0];
  const reminders = state.reminders
    .filter((reminder) => reminder.tenantId === tenant?.id)
    .sort((left, right) => left.triggerDate.localeCompare(right.triggerDate));
  const submissions = state.paymentSubmissions
    .filter((submission) => submission.tenantId === tenant?.id)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));

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

  const handleAction = (callback, successMessage) => {
    try {
      callback();
      setFeedback({ tone: 'success', text: successMessage });
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  if (!tenant) {
    return (
      <ScreenSurface>
        <PageHeader
          eyebrow="Tenant portal"
          title="Tenant not found"
          subtitle="Use one of the seeded tenant phone numbers from the login screen."
          actionLabel="Log out"
          onAction={onLogout}
        />
      </ScreenSurface>
    );
  }

  const renderHome = () => (
    <>
      <SectionCard title={`Welcome back, ${tenant.fullName || 'tenant'}`} subtitle="Your room, invoice, and reminder status all stay visible here.">
        <InlineGroup>
          <StatusBadge label={tenant.profileStatus || 'PENDING'} />
          {tenancy ? <StatusBadge label={tenancy.status} /> : null}
        </InlineGroup>
        <KeyValueRow label="Room" value={room ? `Room ${room.label}` : 'Awaiting assignment'} />
        <KeyValueRow label="Current invoice" value={currentInvoice ? formatCurrency(currentInvoice.totalAmount) : 'No invoice yet'} />
        <KeyValueRow label="Due date" value={currentInvoice ? formatDate(currentInvoice.dueDate) : 'No due date'} />
      </SectionCard>

      <SectionCard title="Reminder feed" subtitle="This mirrors the in-app and WhatsApp reminder cadence configured by the owner.">
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
          <EmptyState title="No reminders yet" description="As soon as an invoice is issued, reminder cards will appear here." />
        )}
      </SectionCard>
    </>
  );

  const renderProfile = () => (
    <SectionCard title="Complete your tenant profile" subtitle="The owner can only activate your contract after these details are filled in.">
      <Field label="Full name" value={profileForm.fullName} onChangeText={(value) => setProfileForm((current) => ({ ...current, fullName: value }))} />
      <Field label="Email" value={profileForm.email} onChangeText={(value) => setProfileForm((current) => ({ ...current, email: value }))} keyboardType="email-address" />
      <Field label="Emergency contact" value={profileForm.emergencyContact} onChangeText={(value) => setProfileForm((current) => ({ ...current, emergencyContact: value }))} keyboardType="phone-pad" />
      <Field label="ID document number" value={profileForm.idDocument} onChangeText={(value) => setProfileForm((current) => ({ ...current, idDocument: value }))} />
      <Field label="Notes" value={profileForm.notes} onChangeText={(value) => setProfileForm((current) => ({ ...current, notes: value }))} multiline />
      <PrimaryButton
        label="Save profile"
        onPress={() =>
          handleAction(
            () => actions.completeTenantProfile({ tenantId: tenant.id, ...profileForm }),
            'Tenant profile updated.',
          )
        }
      />
    </SectionCard>
  );

  const renderContract = () => (
    <SectionCard title="Contract summary" subtitle="Owner uploads the signed PDF and confirms the structured tenancy details here.">
      {contract ? (
        <>
          <InlineGroup>
            <StatusBadge label={tenancy.status} />
            <Text style={{ color: '#66756d' }}>{contract.fileName}</Text>
          </InlineGroup>
          <KeyValueRow label="Move-in date" value={formatDate(contract.moveInDate)} />
          <KeyValueRow label="Contract term" value={`${formatDate(contract.contractStart)} to ${formatDate(contract.contractEnd)}`} />
          <KeyValueRow label="Rent" value={formatCurrency(contract.rentAmount)} />
          <KeyValueRow label="Deposit" value={formatCurrency(contract.depositAmount)} />
          <KeyValueRow label="Due day" value={`Every month on day ${contract.dueDay}`} />
        </>
      ) : (
        <EmptyState title="Contract not activated yet" description="Complete your profile first. Once the owner uploads the lease PDF and confirms terms, your contract summary will show up here." />
      )}
    </SectionCard>
  );

  const renderPayments = () => (
    <SectionCard title="Pay rent with UPI" subtitle="Use the UPI QR or deep link, then upload your UTR and screenshot for owner approval.">
      {currentInvoice ? (
        <>
          <InlineGroup>
            <StatusBadge label={currentInvoice.derivedStatus} />
            <Text style={{ color: '#66756d' }}>{formatMonth(currentInvoice.month)}</Text>
          </InlineGroup>
          <QrCard
            value={currentInvoice.paymentLink}
            subtitle={`${state.settlementAccount.payeeName} | ${state.settlementAccount.upiId}`}
          />
          <KeyValueRow label="Rent" value={formatCurrency(currentInvoice.baseRent)} />
          <KeyValueRow label="Electricity" value={formatCurrency(currentInvoice.electricityCharge)} />
          <KeyValueRow label="Total due" value={formatCurrency(currentInvoice.totalAmount)} />
          <KeyValueRow label="Due date" value={formatDate(currentInvoice.dueDate)} />
          <PrimaryButton
            label="Open UPI app"
            tone="ghost"
            onPress={() =>
              Linking.openURL(currentInvoice.paymentLink).catch(() =>
                setFeedback({ tone: 'danger', text: 'Unable to open the UPI link on this device.' }),
              )
            }
          />
          {['PAYMENT_SUBMITTED', 'PAID'].includes(currentInvoice.derivedStatus) ? (
            <EmptyState
              title={currentInvoice.derivedStatus === 'PAID' ? 'Payment already approved' : 'Payment proof submitted'}
              description="No further action is needed right now unless the owner asks for clarification."
            />
          ) : (
            <>
              <Field label="UTR or payment reference" value={paymentForm.utr} onChangeText={(value) => setPaymentForm((current) => ({ ...current, utr: value }))} />
              <Field label="Screenshot or proof file name" value={paymentForm.screenshotLabel} onChangeText={(value) => setPaymentForm((current) => ({ ...current, screenshotLabel: value }))} placeholder="upi-proof-april.png" />
              <Field label="Optional note" value={paymentForm.note} onChangeText={(value) => setPaymentForm((current) => ({ ...current, note: value }))} multiline />
              <PrimaryButton
                label="Submit payment proof"
                onPress={() =>
                  handleAction(
                    () => {
                      actions.submitPayment({ invoiceId: currentInvoice.id, ...paymentForm });
                      setPaymentForm({ utr: '', screenshotLabel: '', note: '' });
                    },
                    'Payment proof submitted for owner review.',
                  )
                }
              />
            </>
          )}
        </>
      ) : (
        <EmptyState title="No invoice available yet" description="Once the owner issues a bill, this screen will show the UPI QR and total amount due." />
      )}
    </SectionCard>
  );

  const renderHistory = () => (
    <>
      <SectionCard title="Invoice history" subtitle="Every invoice keeps the rent and electricity snapshot that was used for billing.">
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
          <EmptyState title="No invoices yet" description="Your owner will issue the first rent bill after the contract is activated." />
        )}
      </SectionCard>

      <SectionCard title="Payment submissions" subtitle="Track whether your proof is pending review, approved, or rejected.">
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
          <EmptyState title="No payment proofs submitted" description="Use the Payments tab to submit your UTR and screenshot after paying." />
        )}
      </SectionCard>
    </>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfile();
      case 'contract':
        return renderContract();
      case 'payments':
        return renderPayments();
      case 'history':
        return renderHistory();
      default:
        return renderHome();
    }
  };

  return (
    <ScreenSurface>
      <PageHeader
        eyebrow="Tenant portal"
        title="Your room, rent, and reminders in one place"
        subtitle="Complete your profile, view your contract, pay using UPI, upload proof, and follow reminder status without depending on manual follow-ups."
        actionLabel="Log out"
        onAction={onLogout}
      />
      {feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null}
      <TabStrip tabs={tenantTabs} activeTab={activeTab} onChange={setActiveTab} />
      {renderCurrentTab()}
    </ScreenSurface>
  );
}
