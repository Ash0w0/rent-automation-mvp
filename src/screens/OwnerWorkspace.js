import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Banner,
  ChoiceChips,
  EmptyState,
  Field,
  InlineGroup,
  KeyValueRow,
  MetricRow,
  PageHeader,
  PrimaryButton,
  ScreenSurface,
  SectionCard,
  StatusBadge,
  TabStrip,
} from '../components/ui';

const { formatCurrency, formatDate, formatMonth, toMonthKey } = require('../lib/dateUtils');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const ownerTabs = [
  { label: 'Overview', value: 'overview' },
  { label: 'Setup', value: 'setup' },
  { label: 'Tenants', value: 'tenants' },
  { label: 'Billing', value: 'billing' },
  { label: 'Reminders', value: 'reminders' },
];

export function OwnerWorkspace({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [feedback, setFeedback] = useState(null);

  const [propertyForm, setPropertyForm] = useState({
    name: state.property.name,
    address: state.property.address,
    managerName: state.property.managerName,
    managerPhone: state.property.managerPhone,
    defaultTariff: String(state.property.defaultTariff),
  });
  const [settlementForm, setSettlementForm] = useState({
    payeeName: state.settlementAccount.payeeName,
    upiId: state.settlementAccount.upiId,
    instructions: state.settlementAccount.instructions,
  });
  const [roomForm, setRoomForm] = useState({
    label: '',
    floor: '',
    serialNumber: '',
    openingReading: '0',
  });
  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    phone: '',
    roomId: '',
  });
  const [contractForm, setContractForm] = useState({
    tenancyId: '',
    fileName: '',
    rentAmount: '15000',
    depositAmount: '30000',
    dueDay: '5',
    moveInDate: state.referenceDate,
    contractStart: state.referenceDate,
    contractEnd: '2027-03-31',
  });
  const [billingForm, setBillingForm] = useState({
    tenancyId: '',
    month: toMonthKey(state.referenceDate),
    openingReading: '',
    closingReading: '',
    tariff: String(state.property.defaultTariff),
  });
  const [moveOutForm, setMoveOutForm] = useState({
    tenancyId: '',
    moveOutDate: state.referenceDate,
  });

  const getTenant = (tenantId) => state.tenants.find((tenant) => tenant.id === tenantId);
  const getRoom = (roomId) => state.rooms.find((room) => room.id === roomId);
  const getMeter = (meterId) => state.roomMeters.find((meter) => meter.id === meterId);

  const invoices = [...state.invoices]
    .map((invoice) => ({ ...invoice, derivedStatus: deriveInvoiceStatus(invoice, state.referenceDate) }))
    .sort((left, right) => right.month.localeCompare(left.month));

  const invitedTenancies = state.tenancies.filter((tenancy) => tenancy.status === 'INVITED');
  const activeTenancies = state.tenancies.filter((tenancy) =>
    ['ACTIVE', 'MOVE_OUT_SCHEDULED'].includes(tenancy.status),
  );
  const pendingSubmissions = state.paymentSubmissions.filter((submission) => submission.status === 'PENDING_REVIEW');
  const reminderQueue = [...state.reminders].sort((left, right) => left.triggerDate.localeCompare(right.triggerDate));
  const vacantRooms = state.rooms.filter((room) => room.status === 'VACANT');

  useEffect(() => {
    setPropertyForm({
      name: state.property.name,
      address: state.property.address,
      managerName: state.property.managerName,
      managerPhone: state.property.managerPhone,
      defaultTariff: String(state.property.defaultTariff),
    });
    setBillingForm((current) => ({
      ...current,
      tariff: String(state.property.defaultTariff),
    }));
  }, [state.property]);

  useEffect(() => {
    setSettlementForm({
      payeeName: state.settlementAccount.payeeName,
      upiId: state.settlementAccount.upiId,
      instructions: state.settlementAccount.instructions,
    });
  }, [state.settlementAccount]);

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
    if (!billingForm.tenancyId && activeTenancies[0]) {
      const room = getRoom(activeTenancies[0].roomId);
      const meter = room ? getMeter(room.meterId) : null;
      setBillingForm((current) => ({
        ...current,
        tenancyId: activeTenancies[0].id,
        openingReading: meter ? String(meter.lastReading) : current.openingReading,
      }));
    }
  }, [activeTenancies, billingForm.tenancyId, state.roomMeters, state.rooms]);

  useEffect(() => {
    if (!moveOutForm.tenancyId && activeTenancies[0]) {
      setMoveOutForm((current) => ({ ...current, tenancyId: activeTenancies[0].id }));
    }
  }, [activeTenancies, moveOutForm.tenancyId]);

  const summary = {
    occupiedRooms: state.rooms.filter((room) => room.status === 'OCCUPIED').length,
    dueInvoices: invoices.filter((invoice) => invoice.derivedStatus === 'DUE').length,
    overdueInvoices: invoices.filter((invoice) => invoice.derivedStatus === 'OVERDUE').length,
    pendingApprovals: pendingSubmissions.length,
  };

  const handleAction = async (callback, successMessage) => {
    try {
      setFeedback(null);
      await callback();
      setFeedback({ tone: 'success', text: successMessage });
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  const renderOverview = () => (
    <>
      <SectionCard title="Portfolio snapshot" subtitle="Single-property UI with a multi-property-ready data model underneath.">
        <MetricRow
          items={[
            { label: 'Occupied rooms', value: summary.occupiedRooms },
            { label: 'Invoices due', value: summary.dueInvoices },
            { label: 'Overdue invoices', value: summary.overdueInvoices },
            { label: 'Payments to review', value: summary.pendingApprovals },
          ]}
        />
        <KeyValueRow label="Property" value={state.property.name} />
        <KeyValueRow label="Manager" value={`${state.property.managerName} | ${state.property.managerPhone}`} />
        <KeyValueRow label="UPI settlement" value={state.settlementAccount.upiId} />
      </SectionCard>

      <SectionCard title="Rooms and occupancy" subtitle="Room status shows available, occupied, or on notice.">
        {state.rooms.map((room) => {
          const tenancy = state.tenancies.find(
            (record) =>
              record.roomId === room.id &&
              ['ACTIVE', 'MOVE_OUT_SCHEDULED', 'INVITED'].includes(record.status),
          );
          const tenant = tenancy ? getTenant(tenancy.tenantId) : null;
          const meter = getMeter(room.meterId);

          return (
            <View key={room.id} style={{ gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
              <InlineGroup>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#19231f' }}>Room {room.label}</Text>
                <StatusBadge label={room.status} />
              </InlineGroup>
              <KeyValueRow label="Floor" value={room.floor} />
              <KeyValueRow label="Meter" value={`${meter.serialNumber} | last ${meter.lastReading}`} />
              <KeyValueRow label="Occupant" value={tenant ? tenant.fullName : 'Vacant'} />
            </View>
          );
        })}
      </SectionCard>

      <SectionCard title="Live operations" subtitle="Quick summary of payment proofs still waiting for review.">
        {pendingSubmissions.length ? (
          pendingSubmissions.map((submission) => {
            const invoice = state.invoices.find((record) => record.id === submission.invoiceId);
            const tenant = getTenant(submission.tenantId);
            const room = getRoom(invoice.roomId);

            return (
              <View key={submission.id} style={{ gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
                <InlineGroup>
                  <Text style={{ fontWeight: '800', color: '#19231f' }}>{tenant.fullName}</Text>
                  <StatusBadge label={submission.status} />
                </InlineGroup>
                <Text style={{ color: '#66756d' }}>
                  Room {room.label} | {formatMonth(invoice.month)} | {formatCurrency(invoice.totalAmount)}
                </Text>
              </View>
            );
          })
        ) : (
          <EmptyState title="No payment proofs are waiting" description="As tenants submit UTRs and screenshots, they will show up here for approval." />
        )}
      </SectionCard>
    </>
  );

  const renderSetup = () => (
    <>
      <SectionCard title="Property setup" subtitle="Owner-facing property and default billing details.">
        <Field label="Property name" value={propertyForm.name} onChangeText={(value) => setPropertyForm((current) => ({ ...current, name: value }))} />
        <Field label="Address" value={propertyForm.address} onChangeText={(value) => setPropertyForm((current) => ({ ...current, address: value }))} multiline />
        <Field label="Manager name" value={propertyForm.managerName} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerName: value }))} />
        <Field label="Manager phone" value={propertyForm.managerPhone} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerPhone: value }))} keyboardType="phone-pad" />
        <Field label="Default tariff" value={propertyForm.defaultTariff} onChangeText={(value) => setPropertyForm((current) => ({ ...current, defaultTariff: value }))} keyboardType="decimal-pad" />
        <PrimaryButton
          label="Save property details"
          onPress={() =>
            handleAction(
              () => actions.updateProperty({ ...propertyForm, defaultTariff: Number(propertyForm.defaultTariff) }),
              'Property details updated.',
            )
          }
        />
      </SectionCard>

      <SectionCard title="Settlement account" subtitle="Used for every UPI link and QR on invoices.">
        <Field label="Payee name" value={settlementForm.payeeName} onChangeText={(value) => setSettlementForm((current) => ({ ...current, payeeName: value }))} />
        <Field label="UPI ID" value={settlementForm.upiId} onChangeText={(value) => setSettlementForm((current) => ({ ...current, upiId: value }))} />
        <Field label="Payment instructions" value={settlementForm.instructions} onChangeText={(value) => setSettlementForm((current) => ({ ...current, instructions: value }))} multiline />
        <PrimaryButton
          label="Save settlement account"
          onPress={() => handleAction(() => actions.updateSettlement(settlementForm), 'UPI settlement details updated.')}
        />
      </SectionCard>

      <SectionCard title="Add a room and meter" subtitle="Every room has a meter so monthly electricity can be billed from snapshots.">
        <Field label="Room label" value={roomForm.label} onChangeText={(value) => setRoomForm((current) => ({ ...current, label: value }))} placeholder="303" />
        <Field label="Floor" value={roomForm.floor} onChangeText={(value) => setRoomForm((current) => ({ ...current, floor: value }))} placeholder="3" />
        <Field label="Meter serial number" value={roomForm.serialNumber} onChangeText={(value) => setRoomForm((current) => ({ ...current, serialNumber: value }))} placeholder="LT-303-C" />
        <Field label="Opening reading" value={roomForm.openingReading} onChangeText={(value) => setRoomForm((current) => ({ ...current, openingReading: value }))} keyboardType="numeric" />
        <PrimaryButton
          label="Create room"
          onPress={() =>
            handleAction(
              async () => {
                await actions.addRoom(roomForm);
                setRoomForm({ label: '', floor: '', serialNumber: '', openingReading: '0' });
              },
              'New room and meter created.',
            )
          }
        />
      </SectionCard>
    </>
  );

  const renderTenants = () => (
    <>
      <SectionCard title="Invite a tenant" subtitle="Reserve a room first; the tenant completes profile details in the portal.">
        <Field label="Tenant full name" value={inviteForm.fullName} onChangeText={(value) => setInviteForm((current) => ({ ...current, fullName: value }))} />
        <Field label="Phone number" value={inviteForm.phone} onChangeText={(value) => setInviteForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
        <ChoiceChips
          value={inviteForm.roomId}
          onChange={(value) => setInviteForm((current) => ({ ...current, roomId: value }))}
          options={vacantRooms.map((room) => ({ value: room.id, label: `Room ${room.label}`, meta: `Floor ${room.floor}` }))}
        />
        <PrimaryButton
          label="Send tenant invite"
          onPress={() =>
            handleAction(
              async () => {
                await actions.inviteTenant(inviteForm);
                setInviteForm({ fullName: '', phone: '', roomId: vacantRooms[0]?.id || '' });
              },
              'Tenant invited and room reserved for onboarding.',
            )
          }
        />
      </SectionCard>

      <SectionCard title="Activate invited tenancy" subtitle="Owner records rent, deposit, dates, and the uploaded PDF file name.">
        {invitedTenancies.length ? (
          <>
            <ChoiceChips
              value={contractForm.tenancyId}
              onChange={(value) => setContractForm((current) => ({ ...current, tenancyId: value }))}
              options={invitedTenancies.map((tenancy) => ({
                value: tenancy.id,
                label: getTenant(tenancy.tenantId)?.fullName || 'Pending tenant',
                meta: `Room ${getRoom(tenancy.roomId)?.label}`,
              }))}
            />
            <Field label="Contract PDF file name" value={contractForm.fileName} onChangeText={(value) => setContractForm((current) => ({ ...current, fileName: value }))} placeholder="lease-priya-nair.pdf" />
            <Field label="Monthly rent" value={contractForm.rentAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, rentAmount: value }))} keyboardType="numeric" />
            <Field label="Deposit amount" value={contractForm.depositAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, depositAmount: value }))} keyboardType="numeric" />
            <Field label="Due day" value={contractForm.dueDay} onChangeText={(value) => setContractForm((current) => ({ ...current, dueDay: value }))} keyboardType="numeric" />
            <Field label="Move-in date" value={contractForm.moveInDate} onChangeText={(value) => setContractForm((current) => ({ ...current, moveInDate: value }))} placeholder="YYYY-MM-DD" />
            <Field label="Contract start" value={contractForm.contractStart} onChangeText={(value) => setContractForm((current) => ({ ...current, contractStart: value }))} placeholder="YYYY-MM-DD" />
            <Field label="Contract end" value={contractForm.contractEnd} onChangeText={(value) => setContractForm((current) => ({ ...current, contractEnd: value }))} placeholder="YYYY-MM-DD" />
            <PrimaryButton
              label="Activate tenancy"
              onPress={() => handleAction(() => actions.activateTenancy(contractForm), 'Contract captured and tenancy moved to active.')}
            />
          </>
        ) : (
          <EmptyState title="No invited tenancies" description="Invite a tenant and wait for profile completion to activate the contract." />
        )}
      </SectionCard>

      <SectionCard title="Tenant lifecycle" subtitle="Move-out is basic in MVP: schedule the exit, collect the final bill, then close the tenancy and free the room.">
        {activeTenancies.length ? (
          <>
            <ChoiceChips
              value={moveOutForm.tenancyId}
              onChange={(value) => setMoveOutForm((current) => ({ ...current, tenancyId: value }))}
              options={activeTenancies.map((tenancy) => ({
                value: tenancy.id,
                label: getTenant(tenancy.tenantId)?.fullName || 'Tenant',
                meta: `Room ${getRoom(tenancy.roomId)?.label} | ${tenancy.status.replaceAll('_', ' ')}`,
              }))}
            />
            <Field label="Move-out date" value={moveOutForm.moveOutDate} onChangeText={(value) => setMoveOutForm((current) => ({ ...current, moveOutDate: value }))} />
            <InlineGroup>
              <PrimaryButton label="Schedule move-out" onPress={() => handleAction(() => actions.scheduleMoveOut(moveOutForm), 'Move-out scheduled and room placed on notice.')} />
              <PrimaryButton label="Close tenancy" tone="ghost" onPress={() => handleAction(() => actions.closeTenancy(moveOutForm.tenancyId), 'Tenancy closed and room returned to vacant inventory.')} />
            </InlineGroup>
          </>
        ) : (
          <EmptyState title="No active tenants" description="Once a contract is activated, tenant lifecycle actions will appear here." />
        )}
      </SectionCard>
    </>
  );

  const renderBilling = () => (
    <>
      <SectionCard title="Generate monthly invoice" subtitle="Each invoice stores a rent and meter snapshot, so later edits do not rewrite history.">
        {activeTenancies.length ? (
          <>
            <ChoiceChips
              value={billingForm.tenancyId}
              onChange={(value) => setBillingForm((current) => ({ ...current, tenancyId: value }))}
              options={activeTenancies.map((tenancy) => ({
                value: tenancy.id,
                label: getTenant(tenancy.tenantId)?.fullName || 'Tenant',
                meta: `Room ${getRoom(tenancy.roomId)?.label}`,
              }))}
            />
            <Field label="Billing month" value={billingForm.month} onChangeText={(value) => setBillingForm((current) => ({ ...current, month: value }))} placeholder="YYYY-MM" />
            <Field label="Opening reading" value={billingForm.openingReading} onChangeText={(value) => setBillingForm((current) => ({ ...current, openingReading: value }))} keyboardType="numeric" />
            <Field label="Closing reading" value={billingForm.closingReading} onChangeText={(value) => setBillingForm((current) => ({ ...current, closingReading: value }))} keyboardType="numeric" />
            <Field label="Tariff per unit" value={billingForm.tariff} onChangeText={(value) => setBillingForm((current) => ({ ...current, tariff: value }))} keyboardType="decimal-pad" />
            <PrimaryButton
              label="Generate invoice"
              onPress={() =>
                handleAction(
                  () =>
                    actions.generateInvoice({
                      ...billingForm,
                      openingReading: Number(billingForm.openingReading),
                      closingReading: Number(billingForm.closingReading),
                      tariff: Number(billingForm.tariff),
                    }),
                  'Invoice created with reminder schedule.',
                )
              }
            />
          </>
        ) : (
          <EmptyState title="No active tenancy to bill" description="Activate a contract first to generate invoices." />
        )}
      </SectionCard>

      <SectionCard title="Payment approvals" subtitle="Tenants pay through UPI and submit proof; owners approve or reject after checking the bank record.">
        {pendingSubmissions.length ? (
          pendingSubmissions.map((submission) => {
            const invoice = state.invoices.find((record) => record.id === submission.invoiceId);
            const tenant = getTenant(submission.tenantId);
            const room = getRoom(invoice.roomId);

            return (
              <View key={submission.id} style={{ gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
                <InlineGroup>
                  <Text style={{ fontWeight: '800', color: '#19231f' }}>{tenant.fullName}</Text>
                  <StatusBadge label={submission.status} />
                </InlineGroup>
                <Text style={{ color: '#66756d' }}>
                  Room {room.label} | {formatMonth(invoice.month)} | {formatCurrency(invoice.totalAmount)}
                </Text>
                <KeyValueRow label="UTR" value={submission.utr} />
                <KeyValueRow label="Proof" value={submission.screenshotLabel} />
                <InlineGroup>
                  <PrimaryButton label="Approve" onPress={() => handleAction(() => actions.reviewPayment({ submissionId: submission.id, decision: 'APPROVE' }), 'Payment approved and invoice marked paid.')} />
                  <PrimaryButton label="Reject" tone="danger" onPress={() => handleAction(() => actions.reviewPayment({ submissionId: submission.id, decision: 'REJECT' }), 'Payment proof rejected and invoice reopened.')} />
                </InlineGroup>
              </View>
            );
          })
        ) : (
          <EmptyState title="No pending payment proofs" description="Once tenants submit UTRs and screenshots, they can be reviewed here." />
        )}
      </SectionCard>

      <SectionCard title="Invoice ledger" subtitle="Owner-facing ledger across active and historical invoices.">
        {invoices.map((invoice) => {
          const tenant = getTenant(invoice.tenantId);
          const room = getRoom(invoice.roomId);
          return (
            <View key={invoice.id} style={{ gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
              <InlineGroup>
                <Text style={{ fontWeight: '800', color: '#19231f' }}>{tenant.fullName}</Text>
                <StatusBadge label={invoice.derivedStatus} />
              </InlineGroup>
              <Text style={{ color: '#66756d' }}>
                Room {room.label} | {formatMonth(invoice.month)} | due {formatDate(invoice.dueDate)}
              </Text>
              <KeyValueRow label="Base rent" value={formatCurrency(invoice.baseRent)} />
              <KeyValueRow label="Electricity" value={formatCurrency(invoice.electricityCharge)} />
              <KeyValueRow label="Total" value={formatCurrency(invoice.totalAmount)} />
            </View>
          );
        })}
      </SectionCard>
    </>
  );

  const renderReminders = () => (
    <SectionCard title="Reminder delivery tracking" subtitle="Fixed WhatsApp and in-app cadence: three days before due, due day, and three days overdue.">
      {reminderQueue.length ? (
        reminderQueue.map((reminder) => {
          const invoice = state.invoices.find((record) => record.id === reminder.invoiceId);
          const tenant = getTenant(reminder.tenantId);
          return (
            <View key={reminder.id} style={{ gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#efe5d5' }}>
              <InlineGroup>
                <Text style={{ fontWeight: '800', color: '#19231f' }}>{tenant.fullName}</Text>
                <StatusBadge label={reminder.deliveryStatus} />
                <StatusBadge label={reminder.channel} />
              </InlineGroup>
              <Text style={{ color: '#66756d' }}>
                {reminder.title} | {formatDate(reminder.triggerDate)} | {formatCurrency(invoice.totalAmount)}
              </Text>
              <InlineGroup>
                <PrimaryButton label="Mark sent" tone="ghost" onPress={() => handleAction(() => actions.updateReminderStatus(reminder.id, 'SENT'), 'Reminder marked sent.')} />
                <PrimaryButton label="Mark failed" tone="danger" onPress={() => handleAction(() => actions.updateReminderStatus(reminder.id, 'FAILED'), 'Reminder marked failed.')} />
              </InlineGroup>
            </View>
          );
        })
      ) : (
        <EmptyState title="No reminders yet" description="Generate an invoice to create due-date reminders." />
      )}
    </SectionCard>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'setup':
        return renderSetup();
      case 'tenants':
        return renderTenants();
      case 'billing':
        return renderBilling();
      case 'reminders':
        return renderReminders();
      default:
        return renderOverview();
    }
  };

  return (
    <ScreenSurface>
      <PageHeader
        eyebrow="Owner portal"
        title="Run your PG from one control room"
        subtitle="Track rooms, contracts, meter snapshots, UPI collections, payment proof approvals, reminders, and move-outs without splitting the workflow across tools."
        actionLabel="Log out"
        onAction={onLogout}
      />
      {state.isSyncing ? <Banner tone="info" message="Syncing the owner portal with the backend..." /> : null}
      {!feedback && state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}
      {feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null}
      <TabStrip tabs={ownerTabs} activeTab={activeTab} onChange={setActiveTab} />
      {renderCurrentTab()}
    </ScreenSurface>
  );
}
