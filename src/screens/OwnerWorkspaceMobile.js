import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

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
  palette,
} from '../components/uiAirbnb';

const { formatCurrency, formatDate, formatMonth } = require('../lib/dateUtils');
const { resolveUploadUrl } = require('../lib/apiClient');
const { deriveInvoiceStatus } = require('../lib/rentEngine');

const ownerTabs = [
  { label: 'Home', value: 'home' },
  { label: 'Residents', value: 'residents' },
  { label: 'Rent', value: 'rent' },
  { label: 'Profile', value: 'profile' },
];

const residentModes = [
  { label: 'Rooms', value: 'rooms' },
  { label: 'Invite', value: 'invite' },
  { label: 'Move-in', value: 'activate' },
  { label: 'Move-out', value: 'moveout' },
];

const rentModes = [
  { label: 'Bills', value: 'ledger' },
  { label: 'Final approval', value: 'payment-review' },
];

const profileModes = [
  { label: 'Property', value: 'property' },
  { label: 'Payouts', value: 'collection' },
  { label: 'Add room', value: 'inventory' },
];

function buildFocus({ pendingSubmissions, invitedTenancies, overdueInvoices, vacantRooms }) {
  if (pendingSubmissions.length) {
    return {
      title: `Review ${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''}`,
      description: 'Each review includes the tenant meter photo, the calculated bill, and the payment proof together.',
      tab: 'rent',
      mode: 'payment-review',
      tone: 'accent',
    };
  }

  if (invitedTenancies.length) {
    return {
      title: `Finish ${invitedTenancies.length} move-in${invitedTenancies.length > 1 ? 's' : ''}`,
      description: 'Profiles are ready. Upload the agreement and start the stay.',
      tab: 'residents',
      mode: 'activate',
      tone: 'accent',
    };
  }

  if (overdueInvoices.length) {
    return {
      title: `${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`,
      description: 'Follow up now before the delay grows.',
      tab: 'rent',
      mode: 'ledger',
      tone: 'accent',
    };
  }

  if (vacantRooms.length) {
    return {
      title: `${vacantRooms.length} room${vacantRooms.length > 1 ? 's' : ''} open`,
      description: 'Invite the next tenant when you are ready to fill it.',
      tab: 'residents',
      mode: 'invite',
      tone: 'soft',
    };
  }

  return {
    title: 'Everything looks calm today',
    description: 'Use the tabs below when you want to update residents, rent, or profile details.',
    tab: 'home',
    mode: null,
    tone: 'soft',
  };
}

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

export function OwnerWorkspaceMobile({ state, actions, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [residentMode, setResidentMode] = useState('rooms');
  const [rentMode, setRentMode] = useState('ledger');
  const [profileMode, setProfileMode] = useState('property');
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
  const dueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'DUE');
  const overdueInvoices = invoices.filter((invoice) => invoice.derivedStatus === 'OVERDUE');

  useEffect(() => {
    setPropertyForm({
      name: state.property.name,
      address: state.property.address,
      managerName: state.property.managerName,
      managerPhone: state.property.managerPhone,
      defaultTariff: String(state.property.defaultTariff),
    });
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

  const summary = {
    occupiedRooms: state.rooms.filter((room) => room.status === 'OCCUPIED').length,
    availableRooms: vacantRooms.length,
    dueInvoices: dueInvoices.length,
    overdueInvoices: overdueInvoices.length,
    finalApprovals: pendingSubmissions.length,
  };

  const focus = buildFocus({
    pendingSubmissions,
    invitedTenancies,
    overdueInvoices,
    vacantRooms,
  });

  const heroCopy = {
    home: {
      eyebrow: 'Landlord',
      title: state.property.name,
      subtitle: 'Keep residents, collections, and setup in one simple mobile flow.',
      highlights: [
        `${summary.availableRooms} open rooms`,
        `${summary.finalApprovals} final approvals`,
        `${summary.overdueInvoices} overdue`,
      ],
    },
    residents: {
      eyebrow: 'Residents',
      title: 'Manage rooms and move-ins',
      subtitle: 'Room status, invites, agreements, and move-outs all stay in one place.',
      highlights: [`${activeTenancies.length} active`, `${invitedTenancies.length} waiting`, `${vacantRooms.length} open`],
    },
    rent: {
      eyebrow: 'Rent',
      title: 'Keep collection simple',
      subtitle: 'Tenants create the bill themselves. You only do one final approval at the end.',
      highlights: [
        `${pendingSubmissions.length} final approvals`,
        `${dueInvoices.length} due`,
        `${overdueInvoices.length} overdue`,
      ],
    },
    profile: {
      eyebrow: 'Profile',
      title: 'Property and payout setup',
      subtitle: 'Use this only when details change, not during the daily rent flow.',
      highlights: [state.settlementAccount.upiId, `${state.rooms.length} rooms`, `${state.property.defaultTariff}/unit`],
    },
  }[activeTab];

  const tasks = [
    pendingSubmissions.length
      ? {
          key: 'review',
          title: `${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''} waiting`,
          tab: 'rent',
          mode: 'payment-review',
        }
      : null,
    invitedTenancies.length
      ? {
          key: 'activate',
          title: `${invitedTenancies.length} agreement${invitedTenancies.length > 1 ? 's' : ''} waiting for move-in`,
          tab: 'residents',
          mode: 'activate',
        }
      : null,
  ].filter(Boolean);

  const openTask = (task) => {
    setActiveTab(task.tab);
    if (task.tab === 'residents') {
      setResidentMode(task.mode);
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

  const renderResidentContent = () => {
    if (residentMode === 'rooms') {
      return state.rooms.length ? (
        <View style={styles.stack}>
          {state.rooms.map((room) => {
            const tenancy = state.tenancies.find((record) => record.roomId === room.id && ['ACTIVE', 'MOVE_OUT_SCHEDULED', 'INVITED'].includes(record.status));
            const tenant = tenancy ? getTenant(tenancy.tenantId) : null;
            const meter = getMeter(room.meterId);

            return (
              <View key={room.id} style={styles.listCard}>
                <InlineGroup>
                  <Text style={styles.listTitle}>Room {room.label}</Text>
                  <StatusBadge label={room.status} />
                </InlineGroup>
                <KeyValueRow label="Resident" value={tenant ? tenant.fullName : 'Available'} />
                <KeyValueRow label="Floor" value={room.floor} />
                <KeyValueRow label="Meter" value={`${meter?.serialNumber || '-'} | ${meter?.lastReading ?? '-'}`} />
              </View>
            );
          })}
        </View>
      ) : <EmptyState title="No rooms yet" description="Add your first room from Profile." />;
    }

    if (residentMode === 'invite') {
      return vacantRooms.length ? (
        <>
          <Field label="Tenant name" value={inviteForm.fullName} onChangeText={(value) => setInviteForm((current) => ({ ...current, fullName: value }))} />
          <Field label="Tenant mobile number" value={inviteForm.phone} onChangeText={(value) => setInviteForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
          <ChoiceChips value={inviteForm.roomId} onChange={(value) => setInviteForm((current) => ({ ...current, roomId: value }))} options={vacantRooms.map((room) => ({ value: room.id, label: `Room ${room.label}`, meta: `Floor ${room.floor}` }))} />
          <PrimaryButton label="Send invite" onPress={() => handleAction(async () => { await actions.inviteTenant(inviteForm); setInviteForm({ fullName: '', phone: '', roomId: '' }); }, 'Tenant invited. The room is now reserved.')} />
        </>
      ) : <EmptyState title="No room is available" description="A room needs to be vacant before you can invite the next tenant." />;
    }

    if (residentMode === 'activate') {
      return invitedTenancies.length ? (
        <>
          <ChoiceChips value={contractForm.tenancyId} onChange={(value) => setContractForm((current) => ({ ...current, tenancyId: value }))} options={invitedTenancies.map((tenancy) => ({ value: tenancy.id, label: getTenant(tenancy.tenantId)?.fullName || 'Tenant', meta: `Room ${getRoom(tenancy.roomId)?.label}` }))} />
          <Field label="Agreement file name" value={contractForm.fileName} onChangeText={(value) => setContractForm((current) => ({ ...current, fileName: value }))} placeholder="lease.pdf" />
          <Field label="Monthly rent" value={contractForm.rentAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, rentAmount: value }))} keyboardType="numeric" />
          <Field label="Deposit amount" value={contractForm.depositAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, depositAmount: value }))} keyboardType="numeric" />
          <Field label="Due day" value={contractForm.dueDay} onChangeText={(value) => setContractForm((current) => ({ ...current, dueDay: value }))} keyboardType="numeric" />
          <Field label="Move-in date" value={contractForm.moveInDate} onChangeText={(value) => setContractForm((current) => ({ ...current, moveInDate: value }))} placeholder="YYYY-MM-DD" />
          <Field label="Agreement start" value={contractForm.contractStart} onChangeText={(value) => setContractForm((current) => ({ ...current, contractStart: value }))} placeholder="YYYY-MM-DD" />
          <Field label="Agreement end" value={contractForm.contractEnd} onChangeText={(value) => setContractForm((current) => ({ ...current, contractEnd: value }))} placeholder="YYYY-MM-DD" />
          <PrimaryButton label="Start stay" onPress={() => handleAction(() => actions.activateTenancy(contractForm), 'Agreement saved and stay is now active.')} />
        </>
      ) : <EmptyState title="No move-ins waiting" description="Invited tenants appear here when they are ready for activation." />;
    }

    return activeTenancies.length ? (
      <>
        <ChoiceChips value={moveOutForm.tenancyId} onChange={(value) => setMoveOutForm((current) => ({ ...current, tenancyId: value }))} options={activeTenancies.map((tenancy) => ({ value: tenancy.id, label: getTenant(tenancy.tenantId)?.fullName || 'Tenant', meta: `Room ${getRoom(tenancy.roomId)?.label}` }))} />
        <Field label="Move-out date" value={moveOutForm.moveOutDate} onChangeText={(value) => setMoveOutForm((current) => ({ ...current, moveOutDate: value }))} placeholder="YYYY-MM-DD" />
        <InlineGroup>
          <PrimaryButton label="Schedule move-out" onPress={() => handleAction(() => actions.scheduleMoveOut(moveOutForm), 'Move-out scheduled.')} />
          <PrimaryButton label="Mark complete" tone="secondary" onPress={() => handleAction(() => actions.closeTenancy(moveOutForm.tenancyId), 'Stay closed. The room is available again.')} />
        </InlineGroup>
      </>
    ) : <EmptyState title="No active residents" description="Move-out controls appear here once there are active residents." />;
  };

  const renderRentContent = () => {
    if (rentMode === 'ledger') {
      return invoices.length ? (
        <View style={styles.stack}>
          {invoices.map((invoice) => {
            const tenant = getTenant(invoice.tenantId);
            const room = getRoom(invoice.roomId);

            return (
              <View key={invoice.id} style={styles.listCard}>
                <InlineGroup>
                  <Text style={styles.listTitle}>{tenant?.fullName || 'Tenant'}</Text>
                  <StatusBadge label={invoice.derivedStatus} />
                </InlineGroup>
                <Text style={styles.listText}>Room {room?.label || '-'} | {formatMonth(invoice.month)} | due {formatDate(invoice.dueDate)}</Text>
                <KeyValueRow label="Total" value={formatCurrency(invoice.totalAmount)} />
                <KeyValueRow label="Electricity" value={formatCurrency(invoice.electricityCharge)} />
              </View>
            );
          })}
        </View>
      ) : <EmptyState title="No bills yet" description="Bills will appear here after a tenancy becomes active." />;
    }

    if (rentMode === 'payment-review') {
      return pendingSubmissions.length ? (
        <View style={styles.stack}>
          {pendingSubmissions.map((submission) => {
            const invoice = invoices.find((record) => record.id === submission.invoiceId);
            const tenant = getTenant(submission.tenantId);
            const room = invoice ? getRoom(invoice.roomId) : null;
            const meterReading =
              state.meterReadings.find((reading) => reading.invoiceId === submission.invoiceId) || null;

            return (
              <View key={submission.id} style={styles.listCard}>
                <InlineGroup>
                  <Text style={styles.listTitle}>{tenant?.fullName || 'Tenant'}</Text>
                  <StatusBadge label={submission.status} />
                </InlineGroup>
                <Text style={styles.listText}>
                  Room {room?.label || '-'} | {invoice ? formatMonth(invoice.month) : '-'} | due{' '}
                  {invoice ? formatDate(invoice.dueDate) : '-'}
                </Text>
                <MetricRow
                  items={[
                    { label: 'Total', value: invoice ? formatCurrency(invoice.totalAmount) : '-' },
                    { label: 'Rent', value: invoice ? formatCurrency(invoice.baseRent) : '-' },
                    {
                      label: 'Electricity',
                      value: invoice ? formatCurrency(invoice.electricityCharge) : '-',
                    },
                  ]}
                />
                {meterReading ? (
                  <>
                    <KeyValueRow
                      label="Meter reading"
                      value={`${meterReading.openingReading} to ${meterReading.closingReading}`}
                    />
                    <KeyValueRow
                      label="Units used"
                      value={String(meterReading.closingReading - meterReading.openingReading)}
                    />
                  </>
                ) : null}
                <KeyValueRow label="UTR" value={submission.utr} />
                <UploadPreview
                  title="Meter photo"
                  subtitle={meterReading?.photoLabel || 'Uploaded meter proof'}
                  uri={resolveUploadUrl(meterReading?.photoLabel)}
                />
                <UploadPreview
                  title="Payment proof"
                  subtitle={submission.screenshotLabel}
                  uri={resolveUploadUrl(submission.screenshotLabel)}
                />
                <InlineGroup>
                  <PrimaryButton
                    label="Approve"
                    onPress={() =>
                      handleAction(
                        () => actions.reviewPayment({ submissionId: submission.id, decision: 'APPROVE' }),
                        'The bill, payment, and meter reading were approved together.',
                      )
                    }
                  />
                  <PrimaryButton
                    label="Reject"
                    tone="danger"
                    onPress={() =>
                      handleAction(
                        () => actions.reviewPayment({ submissionId: submission.id, decision: 'REJECT' }),
                        'The final approval was rejected and the bill moved back to due.',
                      )
                    }
                  />
                </InlineGroup>
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          title="No final approvals waiting"
          description="Tenants will appear here only after they submit the meter photo and payment proof together."
        />
      );
    }

    return (
      <EmptyState
        title="Nothing to review"
        description="Open bills will appear here once tenants start their monthly flow."
      />
    );
  };

  const renderProfileContent = () => {
    if (profileMode === 'property') {
      return (
        <>
          <Field label="Property name" value={propertyForm.name} onChangeText={(value) => setPropertyForm((current) => ({ ...current, name: value }))} />
          <Field label="Address" value={propertyForm.address} onChangeText={(value) => setPropertyForm((current) => ({ ...current, address: value }))} multiline />
          <Field label="Manager name" value={propertyForm.managerName} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerName: value }))} />
          <Field label="Manager phone" value={propertyForm.managerPhone} onChangeText={(value) => setPropertyForm((current) => ({ ...current, managerPhone: value }))} keyboardType="phone-pad" />
          <Field label="Default electricity rate" value={propertyForm.defaultTariff} onChangeText={(value) => setPropertyForm((current) => ({ ...current, defaultTariff: value }))} keyboardType="decimal-pad" />
          <PrimaryButton label="Save property" onPress={() => handleAction(() => actions.updateProperty({ ...propertyForm, defaultTariff: Number(propertyForm.defaultTariff) }), 'Property details saved.')} />
        </>
      );
    }

    if (profileMode === 'collection') {
      return (
        <>
          <Field label="Payee name" value={settlementForm.payeeName} onChangeText={(value) => setSettlementForm((current) => ({ ...current, payeeName: value }))} />
          <Field label="UPI ID" value={settlementForm.upiId} onChangeText={(value) => setSettlementForm((current) => ({ ...current, upiId: value }))} />
          <Field label="Note for tenants" value={settlementForm.instructions} onChangeText={(value) => setSettlementForm((current) => ({ ...current, instructions: value }))} multiline />
          <PrimaryButton label="Save payout account" onPress={() => handleAction(() => actions.updateSettlement(settlementForm), 'Payout details saved.')} />
        </>
      );
    }

    return (
      <>
        <Field label="Room number" value={roomForm.label} onChangeText={(value) => setRoomForm((current) => ({ ...current, label: value }))} placeholder="303" />
        <Field label="Floor" value={roomForm.floor} onChangeText={(value) => setRoomForm((current) => ({ ...current, floor: value }))} placeholder="3" />
        <Field label="Meter serial number" value={roomForm.serialNumber} onChangeText={(value) => setRoomForm((current) => ({ ...current, serialNumber: value }))} placeholder="LT-303-C" />
        <Field label="Meter opening reading" value={roomForm.openingReading} onChangeText={(value) => setRoomForm((current) => ({ ...current, openingReading: value }))} keyboardType="numeric" />
        <PrimaryButton label="Add room" onPress={() => handleAction(async () => { await actions.addRoom(roomForm); setRoomForm({ label: '', floor: '', serialNumber: '', openingReading: '0' }); }, 'Room and meter added.')} />
      </>
    );
  };

  return (
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
    >
      {state.isSyncing ? <Banner tone="info" message="Updating the landlord workspace..." /> : null}
      {!feedback && state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}
      {feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null}

      {activeTab === 'home' ? (
        <>
          <FocusCard eyebrow="Today" title={focus.title} description={focus.description} tone={focus.tone} actionLabel={focus.mode ? 'Open next task' : null} onAction={focus.mode ? () => openTask({ tab: focus.tab, mode: focus.mode }) : undefined} />
          <SectionCard title="Overview" subtitle="Only the numbers that matter today." tone="soft">
            <MetricRow items={[{ label: 'Occupied', value: summary.occupiedRooms }, { label: 'Open', value: summary.availableRooms }, { label: 'Due', value: summary.dueInvoices }, { label: 'Final review', value: summary.finalApprovals }]} />
            <KeyValueRow label="Payout UPI" value={state.settlementAccount.upiId} />
            <KeyValueRow label="Electricity rate" value={`${state.property.defaultTariff}/unit`} />
          </SectionCard>
          <SectionCard title="What needs you" subtitle="One tap takes you to the right place.">
            {tasks.length ? (
              <View style={styles.stack}>
                {tasks.map((task) => (
                  <View key={task.key} style={styles.actionRow}>
                    <Text style={styles.listTitle}>{task.title}</Text>
                    <PrimaryButton label="Open" tone="secondary" compact onPress={() => openTask(task)} />
                  </View>
                ))}
              </View>
            ) : <EmptyState title="Nothing urgent right now" description="Residents and rent are under control." />}
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'residents' ? (
        <>
          <SectionCard title="Residents" subtitle="Pick the one task you want to finish.">
            <MetricRow items={[{ label: 'Active', value: activeTenancies.length }, { label: 'Waiting', value: invitedTenancies.length }, { label: 'Open', value: vacantRooms.length }]} />
            <ChoiceChips options={residentModes} value={residentMode} onChange={setResidentMode} />
          </SectionCard>
          <SectionCard title={residentModes.find((mode) => mode.value === residentMode)?.label} subtitle="The resident flow lives here.">
            {renderResidentContent()}
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'rent' ? (
        <>
          <SectionCard title="Rent" subtitle="Bills and final approvals stay together.">
            <MetricRow items={[{ label: 'Due', value: dueInvoices.length }, { label: 'Overdue', value: overdueInvoices.length }, { label: 'Final review', value: pendingSubmissions.length }]} />
            <ChoiceChips options={rentModes} value={rentMode} onChange={setRentMode} />
          </SectionCard>
          <SectionCard title={rentModes.find((mode) => mode.value === rentMode)?.label} subtitle="Finish one rent task at a time.">
            {renderRentContent()}
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'profile' ? (
        <>
          <SectionCard title="Landlord profile" subtitle="Account, property, and payout details.">
            <KeyValueRow label="Property" value={state.property.name} />
            <KeyValueRow label="Manager" value={state.property.managerName} />
            <KeyValueRow label="Phone" value={state.property.managerPhone} />
            <PrimaryButton label="Log out" tone="secondary" onPress={onLogout} />
          </SectionCard>
          <SectionCard title="Setup" subtitle="Change details only when you need to.">
            <ChoiceChips options={profileModes} value={profileMode} onChange={setProfileMode} />
            {renderProfileContent()}
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
  listCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 10,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewCard: {
    gap: 10,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.surfaceMuted,
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
    backgroundColor: palette.surface,
  },
});
