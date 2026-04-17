import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  SearchCluster,
  ScreenSurface,
  SectionCard,
  StatusBadge,
  TabStrip,
  palette,
} from '../components/uiAirbnb';

const { formatCurrency, formatDate, formatMonth, toMonthKey } = require('../lib/dateUtils');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const ownerTabs = [
  { label: 'Overview', value: 'home' },
  { label: 'Residents', value: 'rooms' },
  { label: 'Collections', value: 'rent' },
  { label: 'Profile', value: 'setup' },
];

const roomModes = [
  { label: 'Room list', value: 'overview' },
  { label: 'Invite', value: 'invite' },
  { label: 'Start stay', value: 'activate' },
  { label: 'End stay', value: 'moveout' },
];

const rentModes = [
  { label: 'This month', value: 'ledger' },
  { label: 'Raise bill', value: 'create' },
  { label: 'Review', value: 'review' },
  { label: 'Reminders', value: 'reminders' },
];

const setupModes = [
  { label: 'Profile', value: 'property' },
  { label: 'Payouts', value: 'collection' },
  { label: 'Add room', value: 'inventory' },
];

function buildFocus({ pendingSubmissions, invitedTenancies, unbilledTenancies, overdueInvoices, vacantRooms }) {
  if (pendingSubmissions.length) {
    return { title: `Review ${pendingSubmissions.length} payment proof${pendingSubmissions.length > 1 ? 's' : ''}`, description: 'These tenants have already paid. You only need to confirm the proof.', tab: 'rent', mode: 'review', tone: 'accent' };
  }

  if (invitedTenancies.length) {
    return { title: `Finish ${invitedTenancies.length} move-in${invitedTenancies.length > 1 ? 's' : ''}`, description: 'Profiles are ready. Upload the agreement and start the stay.', tab: 'rooms', mode: 'activate', tone: 'accent' };
  }

  if (unbilledTenancies.length) {
    return { title: `Raise ${unbilledTenancies.length} rent bill${unbilledTenancies.length > 1 ? 's' : ''}`, description: "Some active rooms still need this month's bill.", tab: 'rent', mode: 'create', tone: 'forest' };
  }

  if (overdueInvoices.length) {
    return { title: `${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`, description: 'Follow up now before the delay grows.', tab: 'rent', mode: 'ledger', tone: 'accent' };
  }

  if (vacantRooms.length) {
    return { title: `${vacantRooms.length} room${vacantRooms.length > 1 ? 's' : ''} open`, description: 'Invite the next tenant when you are ready to fill it.', tab: 'rooms', mode: 'invite', tone: 'soft' };
  }

  return { title: 'Today is under control', description: 'Residents, collections, and profile settings are split clearly below.', tab: 'home', mode: null, tone: 'soft' };
}

const LANDLORD_OVERVIEW_IMAGE =
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80';
const LANDLORD_RESIDENTS_IMAGE =
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80';
const LANDLORD_COLLECTIONS_IMAGE =
  'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1400&q=80';

export function OwnerWorkspaceV2({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [roomMode, setRoomMode] = useState('overview');
  const [rentMode, setRentMode] = useState('ledger');
  const [setupMode, setSetupMode] = useState('property');
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
  const [roomForm, setRoomForm] = useState({ label: '', floor: '', serialNumber: '', openingReading: '0' });
  const [inviteForm, setInviteForm] = useState({ fullName: '', phone: '', roomId: '' });
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
  const [moveOutForm, setMoveOutForm] = useState({ tenancyId: '', moveOutDate: state.referenceDate });

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
  const reminders = [...state.reminders].sort((left, right) => left.triggerDate.localeCompare(right.triggerDate));
  const dueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'DUE');
  const overdueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'OVERDUE');
  const currentMonth = toMonthKey(state.referenceDate);
  const unbilledTenancies = activeTenancies.filter(
    (tenancy) => !state.invoices.some((invoice) => invoice.tenancyId === tenancy.id && invoice.month === currentMonth),
  );

  useEffect(() => {
    setPropertyForm({
      name: state.property.name,
      address: state.property.address,
      managerName: state.property.managerName,
      managerPhone: state.property.managerPhone,
      defaultTariff: String(state.property.defaultTariff),
    });
    setBillingForm((current) => ({ ...current, tariff: String(state.property.defaultTariff) }));
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
    if (!moveOutForm.tenancyId && activeTenancies[0]) {
      setMoveOutForm((current) => ({ ...current, tenancyId: activeTenancies[0].id }));
    }
  }, [moveOutForm.tenancyId, activeTenancies]);

  useEffect(() => {
    if (!billingForm.tenancyId && activeTenancies[0]) {
      setBillingForm((current) => ({ ...current, tenancyId: activeTenancies[0].id }));
    }
  }, [billingForm.tenancyId, activeTenancies]);

  useEffect(() => {
    if (!billingForm.tenancyId) {
      return;
    }

    const selectedTenancy = activeTenancies.find((tenancy) => tenancy.id === billingForm.tenancyId);
    const room = selectedTenancy ? getRoom(selectedTenancy.roomId) : null;
    const meter = room ? getMeter(room.meterId) : null;

    if (meter) {
      setBillingForm((current) => ({ ...current, openingReading: String(meter.lastReading) }));
    }
  }, [billingForm.tenancyId, activeTenancies]);

  const summary = {
    occupiedRooms: state.rooms.filter((room) => room.status === 'OCCUPIED').length,
    availableRooms: vacantRooms.length,
    dueInvoices: dueInvoices.length,
    overdueInvoices: overdueInvoices.length,
    pendingApprovals: pendingSubmissions.length,
  };
  const overviewHighlights = [
    `${summary.availableRooms} open rooms`,
    `${summary.pendingApprovals} to review`,
    `${summary.overdueInvoices} overdue`,
  ];

  const focus = buildFocus({
    pendingSubmissions,
    invitedTenancies,
    unbilledTenancies,
    overdueInvoices,
    vacantRooms,
  });

  const tasks = [
    pendingSubmissions.length
      ? { key: 'proofs', title: `${pendingSubmissions.length} payment proofs to review`, tab: 'rent', mode: 'review' }
      : null,
    invitedTenancies.length
      ? { key: 'moveins', title: `${invitedTenancies.length} move-ins waiting`, tab: 'rooms', mode: 'activate' }
      : null,
    unbilledTenancies.length
      ? { key: 'bills', title: `${unbilledTenancies.length} rooms need a bill`, tab: 'rent', mode: 'create' }
      : null,
    overdueInvoices.length
      ? { key: 'overdue', title: `${overdueInvoices.length} overdue bills`, tab: 'rent', mode: 'ledger' }
      : null,
  ].filter(Boolean);

  const openTask = (task) => {
    setActiveTab(task.tab);
    if (task.tab === 'rooms') {
      setRoomMode(task.mode);
    }
    if (task.tab === 'rent') {
      setRentMode(task.mode);
    }
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

  const renderRoomList = () => (
    state.rooms.length ? (
      <View style={styles.stack}>
        {state.rooms.map((room) => {
          const tenancy = state.tenancies.find(
            (record) =>
              record.roomId === room.id &&
              ['ACTIVE', 'MOVE_OUT_SCHEDULED', 'INVITED'].includes(record.status),
          );
          const tenant = tenancy ? getTenant(tenancy.tenantId) : null;
          const meter = getMeter(room.meterId);

          return (
            <View key={room.id} style={styles.listCard}>
              <InlineGroup>
                <Text style={styles.titleText}>Room {room.label}</Text>
                <StatusBadge label={room.status} />
              </InlineGroup>
              <KeyValueRow label="Resident" value={tenant ? tenant.fullName : 'Available'} />
              <KeyValueRow label="Floor" value={room.floor} />
              <KeyValueRow label="Meter" value={`${meter?.serialNumber || '-'} | ${meter?.lastReading ?? '-'}`} />
            </View>
          );
        })}
      </View>
    ) : (
      <EmptyState title="No rooms yet" description="Add your first room in Setup." />
    )
  );

  const renderHome = () => (
    <>
      <PageHeader
        eyebrow="Landlord"
        title={state.property.name}
        subtitle="Everything important about your PG, arranged like a calm operating dashboard instead of a control panel."
      />

      <SearchCluster
        items={[
          { label: 'Open rooms', value: String(summary.availableRooms) },
          { label: 'To review', value: String(summary.pendingApprovals) },
          { label: 'Overdue', value: String(summary.overdueInvoices) },
          { label: 'Payouts', value: state.settlementAccount.upiId },
        ]}
        actionLabel={focus.mode ? 'Open next task' : null}
        onAction={focus.mode ? () => openTask({ tab: focus.tab, mode: focus.mode }) : undefined}
      />

      <FeatureCard
        imageUri={LANDLORD_OVERVIEW_IMAGE}
        eyebrow="Landlord workspace"
        title="Run the property without chasing the next task"
        description="Overview keeps today visible first. Residents handles move-ins and move-outs. Collections keeps billing and approvals together. Profile stays out of the daily way."
        badges={overviewHighlights}
        actionLabel={focus.mode ? 'Open next task' : null}
        onAction={focus.mode ? () => openTask({ tab: focus.tab, mode: focus.mode }) : undefined}
      />

      <FocusCard
        eyebrow="Today"
        title={focus.title}
        description={focus.description}
        tone={focus.tone}
        actionLabel={focus.mode ? 'Open task' : null}
        onAction={focus.mode ? () => openTask({ tab: focus.tab, mode: focus.mode }) : undefined}
      />

      <SectionCard title="Needs attention" subtitle="Only the items that need landlord action right now.">
        {tasks.length ? (
          <View style={styles.stack}>
            {tasks.map((task) => (
              <View key={task.key} style={styles.taskRow}>
                <Text style={styles.titleText}>{task.title}</Text>
                <PrimaryButton label="Open" tone="ghost" onPress={() => openTask(task)} />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState title="Nothing urgent right now" description="Use Residents, Collections, or Profile whenever you need to make a change." />
        )}
      </SectionCard>

      <SectionCard title="Snapshot" subtitle="A quick read of occupancy and collections right now." tone="soft">
        <MetricRow
          items={[
            { label: 'Occupied', value: summary.occupiedRooms },
            { label: 'Open rooms', value: summary.availableRooms },
            { label: 'Due now', value: summary.dueInvoices },
            { label: 'Need review', value: summary.pendingApprovals },
          ]}
        />
        <KeyValueRow label="Property" value={state.property.name} />
        <KeyValueRow label="Payout UPI" value={state.settlementAccount.upiId} />
      </SectionCard>
    </>
  );

  const renderRooms = () => (
    <>
      <FeatureCard
        imageUri={LANDLORD_RESIDENTS_IMAGE}
        eyebrow="Residents"
        title="Keep every room and resident in one clear flow"
        description="Room status, new invites, move-ins, and move-outs stay together here so you do not have to think in backend steps."
        tone="soft"
      />
      <ChoiceChips options={roomModes} value={roomMode} onChange={setRoomMode} />

      {roomMode === 'overview' ? (
        <SectionCard title="Room list" subtitle="See every room and who is currently attached to it.">
          {renderRoomList()}
        </SectionCard>
      ) : null}

      {roomMode === 'invite' ? (
        <SectionCard title="Invite a tenant" subtitle="Reserve an open room and send the tenant into onboarding.">
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
                label="Send invite"
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
            <EmptyState title="No room is available" description="A room needs to be vacant before you can invite the next tenant." />
          )}
        </SectionCard>
      ) : null}

      {roomMode === 'activate' ? (
        <SectionCard title="Start a stay" subtitle="Confirm the agreement and move the resident into the room.">
          {invitedTenancies.length ? (
            <>
              <ChoiceChips
                value={contractForm.tenancyId}
                onChange={(value) => setContractForm((current) => ({ ...current, tenancyId: value }))}
                options={invitedTenancies.map((tenancy) => ({
                  value: tenancy.id,
                  label: getTenant(tenancy.tenantId)?.fullName || 'Tenant',
                  meta: `Room ${getRoom(tenancy.roomId)?.label}`,
                }))}
              />
              <Field label="Agreement file name" value={contractForm.fileName} onChangeText={(value) => setContractForm((current) => ({ ...current, fileName: value }))} placeholder="lease.pdf" />
              <Field label="Monthly rent" value={contractForm.rentAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, rentAmount: value }))} keyboardType="numeric" />
              <Field label="Deposit amount" value={contractForm.depositAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, depositAmount: value }))} keyboardType="numeric" />
              <Field label="Due day" value={contractForm.dueDay} onChangeText={(value) => setContractForm((current) => ({ ...current, dueDay: value }))} keyboardType="numeric" />
              <Field label="Move-in date" value={contractForm.moveInDate} onChangeText={(value) => setContractForm((current) => ({ ...current, moveInDate: value }))} placeholder="YYYY-MM-DD" />
              <Field label="Agreement start" value={contractForm.contractStart} onChangeText={(value) => setContractForm((current) => ({ ...current, contractStart: value }))} placeholder="YYYY-MM-DD" />
              <Field label="Agreement end" value={contractForm.contractEnd} onChangeText={(value) => setContractForm((current) => ({ ...current, contractEnd: value }))} placeholder="YYYY-MM-DD" />
              <PrimaryButton label="Start stay" onPress={() => handleAction(() => actions.activateTenancy(contractForm), 'Agreement saved and stay is now active.')} />
            </>
          ) : (
            <EmptyState title="No move-ins waiting" description="Invited tenants will appear here when they are ready for activation." />
          )}
        </SectionCard>
      ) : null}

      {roomMode === 'moveout' ? (
        <SectionCard title="End a stay" subtitle="Put a room on notice or mark the move-out complete.">
          {activeTenancies.length ? (
            <>
              <ChoiceChips
                value={moveOutForm.tenancyId}
                onChange={(value) => setMoveOutForm((current) => ({ ...current, tenancyId: value }))}
                options={activeTenancies.map((tenancy) => ({
                  value: tenancy.id,
                  label: getTenant(tenancy.tenantId)?.fullName || 'Tenant',
                  meta: `Room ${getRoom(tenancy.roomId)?.label}`,
                }))}
              />
              <Field label="Move-out date" value={moveOutForm.moveOutDate} onChangeText={(value) => setMoveOutForm((current) => ({ ...current, moveOutDate: value }))} placeholder="YYYY-MM-DD" />
              <InlineGroup>
                <PrimaryButton label="Schedule move-out" onPress={() => handleAction(() => actions.scheduleMoveOut(moveOutForm), 'Move-out scheduled. The room is now on notice.')} />
                <PrimaryButton label="Mark complete" tone="ghost" onPress={() => handleAction(() => actions.closeTenancy(moveOutForm.tenancyId), 'Stay closed. The room is available again.')} />
              </InlineGroup>
            </>
          ) : (
            <EmptyState title="No active tenancies" description="Move-out controls appear here once there are active residents." />
          )}
        </SectionCard>
      ) : null}
    </>
  );

  const renderRent = () => (
    <>
      <FeatureCard
        imageUri={LANDLORD_COLLECTIONS_IMAGE}
        eyebrow="Collections"
        title="Keep the rent cycle simple"
        description="Track this month's bills, raise rent, review payment proofs, and follow reminders in one place."
        tone="accent"
      />
      <ChoiceChips options={rentModes} value={rentMode} onChange={setRentMode} />

      {rentMode === 'ledger' ? (
        <SectionCard title="This month" subtitle="Review due, overdue, and paid rent in one clear list.">
          {invoices.length ? (
            <View style={styles.stack}>
              {invoices.map((invoice) => {
                const tenant = getTenant(invoice.tenantId);
                const room = getRoom(invoice.roomId);

                return (
                  <View key={invoice.id} style={styles.listCard}>
                    <InlineGroup>
                      <Text style={styles.titleText}>{tenant?.fullName || 'Tenant'}</Text>
                      <StatusBadge label={invoice.derivedStatus} />
                    </InlineGroup>
                    <Text style={styles.subtleText}>Room {room?.label || '-'} | {formatMonth(invoice.month)} | due {formatDate(invoice.dueDate)}</Text>
                    <KeyValueRow label="Base rent" value={formatCurrency(invoice.baseRent)} />
                    <KeyValueRow label="Electricity" value={formatCurrency(invoice.electricityCharge)} />
                    <KeyValueRow label="Total" value={formatCurrency(invoice.totalAmount)} />
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState title="No bills yet" description="Bills will appear here after a tenancy becomes active." />
          )}
        </SectionCard>
      ) : null}

      {rentMode === 'create' ? (
        <SectionCard title="Raise a bill" subtitle="Create this month's rent for one active resident.">
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
              <Field label="Electricity rate per unit" value={billingForm.tariff} onChangeText={(value) => setBillingForm((current) => ({ ...current, tariff: value }))} keyboardType="decimal-pad" />
              <PrimaryButton
                label="Raise bill"
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
            <EmptyState title="No active tenancy to bill" description="Finish a move-in first, then billing appears here." />
          )}
        </SectionCard>
      ) : null}

      {rentMode === 'review' ? (
        <SectionCard title="Review payment proof" subtitle="Approve proof to mark the bill collected.">
          {pendingSubmissions.length ? (
            <View style={styles.stack}>
              {pendingSubmissions.map((submission) => {
                const invoice = state.invoices.find((record) => record.id === submission.invoiceId);
                const tenant = getTenant(submission.tenantId);
                const room = invoice ? getRoom(invoice.roomId) : null;

                return (
                  <View key={submission.id} style={styles.listCard}>
                    <InlineGroup>
                      <Text style={styles.titleText}>{tenant?.fullName || 'Tenant'}</Text>
                      <StatusBadge label={submission.status} />
                    </InlineGroup>
                    <Text style={styles.subtleText}>Room {room?.label || '-'} | {invoice ? formatCurrency(invoice.totalAmount) : '-'}</Text>
                    <KeyValueRow label="UTR" value={submission.utr} />
                    <KeyValueRow label="Proof" value={submission.screenshotLabel} />
                    <InlineGroup>
                      <PrimaryButton label="Approve" onPress={() => handleAction(() => actions.reviewPayment({ submissionId: submission.id, decision: 'APPROVE' }), 'Payment approved and marked as collected.')} />
                      <PrimaryButton label="Reject" tone="danger" onPress={() => handleAction(() => actions.reviewPayment({ submissionId: submission.id, decision: 'REJECT' }), 'Proof rejected and the bill moved back to due.')} />
                    </InlineGroup>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState title="Nothing to review" description="Payment proofs will appear here after tenants submit them." />
          )}
        </SectionCard>
      ) : null}

      {rentMode === 'reminders' ? (
        <SectionCard title="Reminders" subtitle="Track reminder status for each open bill.">
          {reminders.length ? (
            <View style={styles.stack}>
              {reminders.map((reminder) => {
                const invoice = state.invoices.find((record) => record.id === reminder.invoiceId);
                const tenant = getTenant(reminder.tenantId);

                return (
                  <View key={reminder.id} style={styles.listCard}>
                    <InlineGroup>
                      <Text style={styles.titleText}>{tenant?.fullName || 'Tenant'}</Text>
                      <StatusBadge label={reminder.deliveryStatus} />
                      <StatusBadge label={reminder.channel} />
                    </InlineGroup>
                    <Text style={styles.subtleText}>{reminder.title} | {formatDate(reminder.triggerDate)} | {invoice ? formatCurrency(invoice.totalAmount) : '-'}</Text>
                    <InlineGroup>
                      <PrimaryButton label="Mark sent" tone="ghost" onPress={() => handleAction(() => actions.updateReminderStatus(reminder.id, 'SENT'), 'Reminder marked as sent.')} />
                      <PrimaryButton label="Mark failed" tone="danger" onPress={() => handleAction(() => actions.updateReminderStatus(reminder.id, 'FAILED'), 'Reminder marked as failed.')} />
                    </InlineGroup>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState title="No reminders yet" description="Reminder items appear after a bill is created." />
          )}
        </SectionCard>
      ) : null}
    </>
  );

  const renderSetup = () => (
    <>
      <FocusCard
        eyebrow="Profile"
        title="Keep account and property setup out of the daily flow"
        description="Profile is for payout setup, property details, and room creation when you need it."
        tone="soft"
      />
      <ChoiceChips options={setupModes} value={setupMode} onChange={setSetupMode} />

      {setupMode === 'property' ? (
        <>
          <SectionCard title="Landlord profile" subtitle="Your account details and workspace actions live here.">
            <KeyValueRow label="Role" value="Landlord" />
            <KeyValueRow label="Property" value={state.property.name} />
            <KeyValueRow label="Manager" value={state.property.managerName} />
            <KeyValueRow label="Phone" value={state.property.managerPhone} />
            <PrimaryButton label="Log out" tone="ghost" onPress={onLogout} />
          </SectionCard>

          <SectionCard title="Property basics" subtitle="Core PG details used across the app.">
          <Field label="Property name" value={propertyForm.name} onChangeText={(value) => setPropertyForm((current) => ({ ...current, name: value }))} />
          <Field label="Address" value={propertyForm.address} onChangeText={(value) => setPropertyForm((current) => ({ ...current, address: value }))} multiline />
          <Field label="Manager name" value={propertyForm.managerName} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerName: value }))} />
          <Field label="Manager phone" value={propertyForm.managerPhone} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerPhone: value }))} keyboardType="phone-pad" />
          <Field label="Default electricity rate" value={propertyForm.defaultTariff} onChangeText={(value) => setPropertyForm((current) => ({ ...current, defaultTariff: value }))} keyboardType="decimal-pad" />
          <PrimaryButton label="Save property" onPress={() => handleAction(() => actions.updateProperty({ ...propertyForm, defaultTariff: Number(propertyForm.defaultTariff) }), 'Property details saved.')} />
          </SectionCard>
        </>
      ) : null}

      {setupMode === 'collection' ? (
        <SectionCard title="Payout account" subtitle="These details appear on the tenant UPI payment flow.">
          <Field label="Payee name" value={settlementForm.payeeName} onChangeText={(value) => setSettlementForm((current) => ({ ...current, payeeName: value }))} />
          <Field label="UPI ID" value={settlementForm.upiId} onChangeText={(value) => setSettlementForm((current) => ({ ...current, upiId: value }))} />
          <Field label="Note for tenants" value={settlementForm.instructions} onChangeText={(value) => setSettlementForm((current) => ({ ...current, instructions: value }))} multiline />
          <PrimaryButton label="Save payout account" onPress={() => handleAction(() => actions.updateSettlement(settlementForm), 'Payout details saved.')} />
        </SectionCard>
      ) : null}

      {setupMode === 'inventory' ? (
        <SectionCard title="Add room and meter" subtitle="Use this only when you are creating a new rentable room.">
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
      ) : null}
    </>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'rooms':
        return renderRooms();
      case 'rent':
        return renderRent();
      case 'setup':
        return renderSetup();
      default:
        return renderHome();
    }
  };

  return (
    <ScreenSurface bottomBar={<TabStrip tabs={ownerTabs} activeTab={activeTab} onChange={setActiveTab} />}>
      {state.isSyncing ? <Banner tone="info" message="Updating the landlord workspace..." /> : null}
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
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  titleText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink,
  },
  subtleText: {
    color: palette.muted,
    lineHeight: 22,
  },
});
