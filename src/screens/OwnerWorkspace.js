import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionGrid,
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
  palette,
} from '../components/ui';

const { formatCurrency, formatDate, formatMonth, toMonthKey } = require('../lib/dateUtils');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const ownerTabs = [
  { label: 'Today', value: 'today', meta: 'See what needs action first.' },
  { label: 'Residents', value: 'residents', meta: 'Fill rooms, start move-ins, manage exits.' },
  { label: 'Collections', value: 'collections', meta: 'Create bills, review proofs, track reminders.' },
  { label: 'Property', value: 'property', meta: 'Update PG details, UPI setup, and room inventory.' },
];

function createOwnerFocus({ pendingSubmissions, overdueInvoices, invitedTenancies, unbilledTenancies, vacantRooms }) {
  if (pendingSubmissions.length) {
    return {
      eyebrow: 'Today’s priority',
      title: `Review ${pendingSubmissions.length} payment proof${pendingSubmissions.length > 1 ? 's' : ''}`,
      description: 'Tenants have already paid. Confirm these first so collections stay current.',
      tab: 'collections',
      actionLabel: 'Open collections',
      tone: 'accent',
    };
  }

  if (overdueInvoices.length) {
    return {
      eyebrow: 'Today’s priority',
      title: `Follow up on ${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`,
      description: 'Review reminders, check proof status, and keep overdue rent from slipping further.',
      tab: 'collections',
      actionLabel: 'View overdue bills',
      tone: 'forest',
    };
  }

  if (invitedTenancies.length) {
    return {
      eyebrow: 'Today’s priority',
      title: `Complete ${invitedTenancies.length} move-in${invitedTenancies.length > 1 ? 's' : ''}`,
      description: 'Finish the agreement setup so invited tenants become active residents.',
      tab: 'residents',
      actionLabel: 'Open residents',
      tone: 'accent',
    };
  }

  if (unbilledTenancies.length) {
    return {
      eyebrow: 'Today’s priority',
      title: `Create ${unbilledTenancies.length} rent bill${unbilledTenancies.length > 1 ? 's' : ''}`,
      description: 'Some active stays do not yet have a bill for this month.',
      tab: 'collections',
      actionLabel: 'Create bills',
      tone: 'forest',
    };
  }

  if (vacantRooms.length) {
    return {
      eyebrow: 'Today’s priority',
      title: `Fill ${vacantRooms.length} available room${vacantRooms.length > 1 ? 's' : ''}`,
      description: 'Invite the next resident and reserve the room in one step.',
      tab: 'residents',
      actionLabel: 'Invite resident',
      tone: 'soft',
    };
  }

  return {
    eyebrow: 'Operating smoothly',
    title: 'Your PG is under control',
    description: 'Rooms, billing, and reminders are up to date. Use the tabs below for any manual changes.',
    tab: 'property',
    actionLabel: 'Review property',
    tone: 'soft',
  };
}

export function OwnerWorkspace({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('today');
  const [feedback, setFeedback] = useState(null);

  const [propertyForm, setPropertyForm] = useState({
    name: state?.property?.name,
    address: state?.property?.address,
    managerName: state?.property?.managerName,
    managerPhone: state?.property?.managerPhone,
    defaultTariff: String(state?.property?.defaultTariff),
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
    tariff: String(state?.property?.defaultTariff),
  });
  const [moveOutForm, setMoveOutForm] = useState({
    tenancyId: '',
    moveOutDate: state.referenceDate,
  });

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

  const invitedTenancies = state.tenancies.filter((tenancy) => tenancy.status === 'INVITED');
  const activeTenancies = state.tenancies.filter((tenancy) =>
    ['ACTIVE', 'MOVE_OUT_SCHEDULED'].includes(tenancy.status),
  );
  const pendingSubmissions = state.paymentSubmissions.filter((submission) => submission.status === 'PENDING_REVIEW');
  const reminderQueue = [...state.reminders].sort((left, right) => left.triggerDate.localeCompare(right.triggerDate));
  const vacantRooms = state.rooms.filter((room) => room.status === 'VACANT');
  const dueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'DUE');
  const overdueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'OVERDUE');
  const failedReminders = reminderQueue.filter((reminder) => reminder.deliveryStatus === 'FAILED');
  const currentMonth = toMonthKey(state.referenceDate);
  const unbilledTenancies = activeTenancies.filter(
    (tenancy) => !state.invoices.some((invoice) => invoice.tenancyId === tenancy.id && invoice.month === currentMonth),
  );

  useEffect(() => {
    setPropertyForm({
      name: state?.property?.name,
      address: state?.property?.address,
      managerName: state?.property??.managerName,
      managerPhone: state?.property?.managerPhone,
      defaultTariff: String(state?.property?.defaultTariff),
    });
    setBillingForm((current) => ({
      ...current,
      tariff: String(state?.property?.defaultTariff),
    }));
  }, [state?.property?]);

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

  useEffect(() => {
    if (!billingForm.tenancyId) {
      return;
    }

    const selectedTenancy = activeTenancies.find((tenancy) => tenancy.id === billingForm.tenancyId);
    const room = selectedTenancy ? getRoom(selectedTenancy.roomId) : null;
    const meter = room ? getMeter(room.meterId) : null;

    if (meter) {
      setBillingForm((current) => ({
        ...current,
        openingReading: String(meter.lastReading),
      }));
    }
  }, [billingForm.tenancyId, activeTenancies, state.roomMeters]);

  const summary = {
    occupiedRooms: state.rooms.filter((room) => room.status === 'OCCUPIED').length,
    availableRooms: vacantRooms.length,
    dueInvoices: dueInvoices.length,
    overdueInvoices: overdueInvoices.length,
    pendingApprovals: pendingSubmissions.length,
  };

  const ownerFocus = createOwnerFocus({
    pendingSubmissions,
    overdueInvoices,
    invitedTenancies,
    unbilledTenancies,
    vacantRooms,
  });

  const handleAction = async (callback, successMessage) => {
    try {
      setFeedback(null);
      await callback();
      setFeedback({ tone: 'success', text: successMessage });
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  const renderRoomSnapshot = () => (
    <View style={styles.grid}>
      {state.rooms.map((room) => {
        const tenancy = state.tenancies.find(
          (record) =>
            record.roomId === room.id &&
            ['ACTIVE', 'MOVE_OUT_SCHEDULED', 'INVITED'].includes(record.status),
        );
        const tenant = tenancy ? getTenant(tenancy.tenantId) : null;
        const meter = getMeter(room.meterId);

        return (
          <View key={room.id} style={styles.infoTile}>
            <InlineGroup>
              <Text style={styles.tileTitle}>Room {room.label}</Text>
              <StatusBadge label={room.status} />
            </InlineGroup>
            <KeyValueRow label="Occupant" value={tenant ? tenant.fullName : 'Available'} />
            <KeyValueRow label="Floor" value={room.floor} />
            <KeyValueRow label="Meter" value={`${meter?.serialNumber || '-'} | ${meter?.lastReading ?? '-'}`} />
          </View>
        );
      })}
    </View>
  );

  const renderToday = () => (
    <>
      <FocusCard
        eyebrow={ownerFocus.eyebrow}
        title={ownerFocus.title}
        description={ownerFocus.description}
        tone={ownerFocus.tone}
        actionLabel={ownerFocus.actionLabel}
        onAction={() => setActiveTab(ownerFocus.tab)}
      />

      <SectionCard title="Operating snapshot" subtitle="The numbers below tell you what deserves attention right now." tone="soft">
        <MetricRow
          items={[
            { label: 'Occupied rooms', value: summary.occupiedRooms },
            { label: 'Available rooms', value: summary.availableRooms },
            { label: 'Due now', value: summary.dueInvoices },
            { label: 'Proofs to review', value: summary.pendingApprovals },
          ]}
        />
        <KeyValueRow label="Property" value={state?.property?.name} />
        <KeyValueRow label="Manager" value={`${state?.property?.managerName} | ${state?.property?.managerPhone}`} />
        <KeyValueRow label="Collection UPI" value={state.settlementAccount.upiId} />
      </SectionCard>

      <SectionCard title="Go where the work is" subtitle="These are the landlord journeys in the app.">
        <ActionGrid
          items={[
            {
              eyebrow: `${vacantRooms.length} available`,
              title: 'Fill rooms',
              description: 'Invite a tenant, reserve a room, and start onboarding.',
              label: 'Open residents',
              onPress: () => setActiveTab('residents'),
            },
            {
              eyebrow: `${invitedTenancies.length} waiting`,
              title: 'Complete move-ins',
              description: 'Activate tenancies after profile and agreement details are ready.',
              label: 'Start tenancies',
              onPress: () => setActiveTab('residents'),
              tone: 'accent',
            },
            {
              eyebrow: `${unbilledTenancies.length} unbilled`,
              title: 'Issue bills',
              description: 'Create this month’s rent bills with the correct meter snapshot.',
              label: 'Open collections',
              onPress: () => setActiveTab('collections'),
              tone: 'forest',
            },
            {
              eyebrow: `${pendingSubmissions.length} pending`,
              title: 'Review proof',
              description: 'Approve or reject payment proof so rent status stays accurate.',
              label: 'Check submissions',
              onPress: () => setActiveTab('collections'),
            },
          ]}
        />
      </SectionCard>

      <SectionCard title="What could slip next" subtitle="Use this to catch bottlenecks before they become follow-up work." tone="accent">
        <View style={styles.stack}>
          <View style={styles.calloutRow}>
            <Text style={styles.calloutTitle}>Overdue bills</Text>
            <Text style={styles.calloutValue}>{overdueInvoices.length}</Text>
          </View>
          <View style={styles.calloutRow}>
            <Text style={styles.calloutTitle}>Failed reminders</Text>
            <Text style={styles.calloutValue}>{failedReminders.length}</Text>
          </View>
          <View style={styles.calloutRow}>
            <Text style={styles.calloutTitle}>Move-outs in progress</Text>
            <Text style={styles.calloutValue}>
              {activeTenancies.filter((tenancy) => tenancy.status === 'MOVE_OUT_SCHEDULED').length}
            </Text>
          </View>
        </View>
      </SectionCard>
    </>
  );

  const renderSetup = () => (
    <>
      <FocusCard
        eyebrow="Property setup"
        title="Keep setup data separate from daily operations"
        description="This tab is for PG details, collection settings, and room inventory. Daily resident and billing work happens in the other flows."
        tone="soft"
      />

      <SectionCard title="Property basics" subtitle="Update the PG details used across the app." tone="soft">
        <Field label="Property name" value={propertyForm.name} onChangeText={(value) => setPropertyForm((current) => ({ ...current, name: value }))} />
        <Field label="Address" value={propertyForm.address} onChangeText={(value) => setPropertyForm((current) => ({ ...current, address: value }))} multiline />
        <Field label="Manager name" value={propertyForm.managerName} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerName: value }))} />
        <Field label="Manager phone" value={propertyForm.managerPhone} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerPhone: value }))} keyboardType="phone-pad" />
        <Field label="Default electricity rate" value={propertyForm.defaultTariff} onChangeText={(value) => setPropertyForm((current) => ({ ...current, defaultTariff: value }))} keyboardType="decimal-pad" />
        <PrimaryButton
          label="Save property"
          onPress={() =>
            handleAction(
              () => actions.updateProperty({ ...propertyForm, defaultTariff: Number(propertyForm.defaultTariff) }),
              'Property details saved.',
            )
          }
        />
      </SectionCard>

      <SectionCard title="Rent collection account" subtitle="These details power every tenant UPI link and QR code." tone="accent">
        <Field label="Payee name" value={settlementForm.payeeName} onChangeText={(value) => setSettlementForm((current) => ({ ...current, payeeName: value }))} />
        <Field label="UPI ID" value={settlementForm.upiId} onChangeText={(value) => setSettlementForm((current) => ({ ...current, upiId: value }))} />
        <Field label="Note for tenants" value={settlementForm.instructions} onChangeText={(value) => setSettlementForm((current) => ({ ...current, instructions: value }))} multiline />
        <PrimaryButton
          label="Save collection account"
          onPress={() => handleAction(() => actions.updateSettlement(settlementForm), 'Collection details saved.')}
        />
      </SectionCard>

      <SectionCard title="Room inventory" subtitle="See the current rooms and meters before adding a new one." tone="forest">
        {renderRoomSnapshot()}
      </SectionCard>

      <SectionCard title="Add room and meter" subtitle="Use this when you want to expand the inventory." tone="soft">
        <Field label="Room number" value={roomForm.label} onChangeText={(value) => setRoomForm((current) => ({ ...current, label: value }))} placeholder="303" />
        <Field label="Floor" value={roomForm.floor} onChangeText={(value) => setRoomForm((current) => ({ ...current, floor: value }))} placeholder="3" />
        <Field label="Meter serial number" value={roomForm.serialNumber} onChangeText={(value) => setRoomForm((current) => ({ ...current, serialNumber: value }))} placeholder="LT-303-C" />
        <Field label="Meter opening reading" value={roomForm.openingReading} onChangeText={(value) => setRoomForm((current) => ({ ...current, openingReading: value }))} keyboardType="numeric" />
        <PrimaryButton
          label="Add room"
          onPress={() =>
            handleAction(
              async () => {
                await actions.addRoom(roomForm);
                setRoomForm({ label: '', floor: '', serialNumber: '', openingReading: '0' });
              },
              'Room and meter added.',
            )
          }
        />
      </SectionCard>
    </>
  );

  const renderTenants = () => (
    <>
      <FocusCard
        eyebrow="Resident journey"
        title="Fill rooms, start stays, and handle exits without jumping around"
        description="Everything related to the resident lifecycle lives here: invite, activate move-in, track current rooms, and close move-outs."
        tone="forest"
      />

      <SectionCard title="Step 1: Invite a resident" subtitle="Reserve an available room and send the tenant into onboarding." tone="soft">
        {vacantRooms.length ? (
          <>
            <Field label="Tenant name" value={inviteForm.fullName} onChangeText={(value) => setInviteForm((current) => ({ ...current, fullName: value }))} />
            <Field label="Tenant mobile number" value={inviteForm.phone} onChangeText={(value) => setInviteForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
            <ChoiceChips
              value={inviteForm.roomId}
              onChange={(value) => setInviteForm((current) => ({ ...current, roomId: value }))}
              options={vacantRooms.map((room) => ({ value: room.id, label: `Room ${room.label}`, meta: `Floor ${room.floor}` }))}
            />
            <PrimaryButton
              label="Invite tenant"
              onPress={() =>
                handleAction(
                  async () => {
                    await actions.inviteTenant(inviteForm);
                    setInviteForm({ fullName: '', phone: '', roomId: '' });
                  },
                  'Tenant invited. The room is now reserved for onboarding.',
                )
              }
            />
          </>
        ) : (
          <EmptyState title="No room is available right now" description="Once a room opens up, you can invite the next resident from here." />
        )}
      </SectionCard>

      <SectionCard title="Step 2: Activate the move-in" subtitle="Turn an invited resident into an active tenancy after the agreement is ready." tone="accent">
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
            <Field label="Agreement file name" value={contractForm.fileName} onChangeText={(value) => setContractForm((current) => ({ ...current, fileName: value }))} placeholder="lease-priya-nair.pdf" />
            <Field label="Monthly rent" value={contractForm.rentAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, rentAmount: value }))} keyboardType="numeric" />
            <Field label="Deposit amount" value={contractForm.depositAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, depositAmount: value }))} keyboardType="numeric" />
            <Field label="Due day" value={contractForm.dueDay} onChangeText={(value) => setContractForm((current) => ({ ...current, dueDay: value }))} keyboardType="numeric" />
            <Field label="Move-in date" value={contractForm.moveInDate} onChangeText={(value) => setContractForm((current) => ({ ...current, moveInDate: value }))} placeholder="YYYY-MM-DD" />
            <Field label="Contract start" value={contractForm.contractStart} onChangeText={(value) => setContractForm((current) => ({ ...current, contractStart: value }))} placeholder="YYYY-MM-DD" />
            <Field label="Contract end" value={contractForm.contractEnd} onChangeText={(value) => setContractForm((current) => ({ ...current, contractEnd: value }))} placeholder="YYYY-MM-DD" />
            <PrimaryButton
              label="Start tenancy"
              onPress={() => handleAction(() => actions.activateTenancy(contractForm), 'Agreement saved and tenancy is now active.')}
            />
          </>
        ) : (
          <EmptyState title="No move-ins are waiting" description="Invited residents will show up here after they have been assigned to a room." />
        )}
      </SectionCard>

      <SectionCard title="Current residents and room status" subtitle="Use this view when you need a fast picture of who is where." tone="forest">
        {renderRoomSnapshot()}
      </SectionCard>

      <SectionCard title="Move-out and turnover" subtitle="Put a room on notice, then complete the move-out when the stay is closed.">
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
              <PrimaryButton label="Schedule move-out" onPress={() => handleAction(() => actions.scheduleMoveOut(moveOutForm), 'Move-out scheduled. The room is now on notice.')} />
              <PrimaryButton label="Complete move-out" tone="ghost" onPress={() => handleAction(() => actions.closeTenancy(moveOutForm.tenancyId), 'Tenancy closed. The room is available again.')} />
            </InlineGroup>
          </>
        ) : (
          <EmptyState title="No active stays yet" description="Once you activate a move-in, resident exits can also be managed here." />
        )}
      </SectionCard>
    </>
  );

  const renderBilling = () => (
    <>
      <FocusCard
        eyebrow="Collections flow"
        title="Issue bills, confirm payments, and keep reminders moving"
        description="This is the landlord’s money workflow: create monthly bills, approve submitted proof, and track reminder delivery."
        tone="accent"
      />

      <SectionCard title="Step 1: Create a monthly rent bill" subtitle="Create the bill with the exact meter snapshot for that month." tone="soft">
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
            <Field label="Billing month (YYYY-MM)" value={billingForm.month} onChangeText={(value) => setBillingForm((current) => ({ ...current, month: value }))} placeholder="YYYY-MM" />
            <Field label="Opening reading" value={billingForm.openingReading} onChangeText={(value) => setBillingForm((current) => ({ ...current, openingReading: value }))} keyboardType="numeric" />
            <Field label="Closing reading" value={billingForm.closingReading} onChangeText={(value) => setBillingForm((current) => ({ ...current, closingReading: value }))} keyboardType="numeric" />
            <Field label="Electricity rate per unit" value={billingForm.tariff} onChangeText={(value) => setBillingForm((current) => ({ ...current, tariff: value }))} keyboardType="decimal-pad" />
            <PrimaryButton
              label="Create invoice"
              onPress={() =>
                handleAction(
                  () =>
                    actions.generateInvoice({
                      ...billingForm,
                      openingReading: Number(billingForm.openingReading),
                      closingReading: Number(billingForm.closingReading),
                      tariff: Number(billingForm.tariff),
                    }),
                  'Rent bill created and reminders scheduled.',
                )
              }
            />
          </>
        ) : (
          <EmptyState title="No active tenancy to bill yet" description="Finish a move-in first, then monthly billing will happen here." />
        )}
      </SectionCard>

      <SectionCard title="Step 2: Review payment proofs" subtitle="Approve proof to mark the bill collected, or reject it to reopen the due bill." tone="accent">
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
                  <PrimaryButton label="Approve payment" onPress={() => handleAction(() => actions.reviewPayment({ submissionId: submission.id, decision: 'APPROVE' }), 'Payment approved and marked as collected.')} />
                  <PrimaryButton label="Reject proof" tone="danger" onPress={() => handleAction(() => actions.reviewPayment({ submissionId: submission.id, decision: 'REJECT' }), 'Proof rejected and the bill moved back to due.')} />
                </InlineGroup>
              </View>
            );
          })
        ) : (
          <EmptyState title="No proof is waiting for review" description="New tenant payment submissions will appear here." />
        )}
      </SectionCard>

      <SectionCard title="Bills and follow-ups" subtitle="Use this list to keep track of due, overdue, and paid rent in one place.">
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

      <SectionCard title="Reminder tracker" subtitle="Track the fixed WhatsApp and in-app follow-up schedule tied to each bill." tone="forest">
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
                  <PrimaryButton label="Mark sent" tone="ghost" onPress={() => handleAction(() => actions.updateReminderStatus(reminder.id, 'SENT'), 'Reminder marked as sent.')} />
                  <PrimaryButton label="Mark failed" tone="danger" onPress={() => handleAction(() => actions.updateReminderStatus(reminder.id, 'FAILED'), 'Reminder marked as failed.')} />
                </InlineGroup>
              </View>
            );
          })
        ) : (
          <EmptyState title="No reminders yet" description="Create a rent bill to schedule the reminder flow." />
        )}
      </SectionCard>
    </>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'property':
        return renderSetup();
      case 'residents':
        return renderTenants();
      case 'collections':
        return renderBilling();
      default:
        return renderToday();
    }
  };

  return (
    <ScreenSurface>
      <PageHeader
        eyebrow="Landlord workspace"
        title="Run the PG by task, not by spreadsheet"
        subtitle="Move through the landlord flow in a natural order: today’s priorities, residents, collections, and finally setup."
        highlights={[
          `${summary.availableRooms} available room${summary.availableRooms === 1 ? '' : 's'}`,
          `${summary.pendingApprovals} proof${summary.pendingApprovals === 1 ? '' : 's'} to review`,
          `${summary.overdueInvoices} overdue bill${summary.overdueInvoices === 1 ? '' : 's'}`,
        ]}
        actionLabel="Log out"
        onAction={onLogout}
      />
      {state.isSyncing ? <Banner tone="info" message="Updating the landlord workspace..." /> : null}
      {!feedback && state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}
      {feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null}
      <TabStrip tabs={ownerTabs} activeTab={activeTab} onChange={setActiveTab} />
      {renderCurrentTab()}
    </ScreenSurface>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoTile: {
    width: '48%',
    minWidth: 150,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
  },
  calloutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.ink,
  },
  calloutValue: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.accent,
  },
});
