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
import { pickImageUpload } from '../lib/imageUploads';

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
  { label: 'Fill a room', value: 'movein' },
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

function buildFocus({ pendingSubmissions, invitedTenancies, overdueInvoices, vacantRooms }) {
  if (!vacantRooms.length && !invitedTenancies.length) {
    return {
        title: 'Set up rooms first',
        description: 'Create the rooms before you start assigning tenants.',
        tab: 'rooms',
        mode: 'inventory',
        tone: 'accent',
      };
  }

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
        tab: 'rooms',
        mode: 'movein',
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
        tab: 'rooms',
        mode: 'movein',
        tone: 'soft',
      };
  }

  return {
    title: 'Everything looks calm today',
    description: 'Use the tabs below when you want to update rooms, rent, or property details.',
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

function getDayDelta(referenceDate, targetDate) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((parseIsoDate(targetDate).getTime() - parseIsoDate(referenceDate).getTime()) / msPerDay);
}

function formatDueWindow(referenceDate, dueDate) {
  const delta = getDayDelta(referenceDate, dueDate);

  if (delta === 0) {
    return 'Due today';
  }

  if (delta > 0) {
    return `Due in ${delta} day${delta === 1 ? '' : 's'}`;
  }

  const overdueDays = Math.abs(delta);
  return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
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
    contractUploads: [],
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
    livingNow: activeTenancies.length,
    leavingSoon: moveOutTenancies.length,
    unpaidNow: collectionWatch.length,
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
      subtitle: 'Stay ahead of occupancy, collections, and property setup in one simple flow.',
      highlights: [
        `${summary.availableRooms} open rooms`,
        `${summary.finalApprovals} final approvals`,
        `${summary.overdueInvoices} overdue`,
      ],
    },
    rooms: {
      eyebrow: 'Rooms',
      title: 'Run occupancy room by room',
      subtitle: 'Each room shows whether it is open, waiting, active, or getting ready for move-out.',
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

  const openTask = (task) => {
    setActiveTab(task.tab);
    if (task.tab === 'rent') {
      setRentMode(task.mode);
    }
    if (task.tab === 'rooms') {
      setResidentMode(task.mode);
    }
  };

  const residentSectionCopy = {
    inventory: {
      title: 'Add a room',
      subtitle: 'Create the room and meter first so every move-in starts from a real room.',
    },
    rooms: {
      title: 'Room list',
      subtitle: 'See which rooms are open, waiting, active, or ready for the next tenant.',
    },
    movein: {
      title: 'Fill a room',
      subtitle: 'Choose an open room, invite the tenant, and complete the agreement in one flow.',
    },
    moveout: {
      title: 'Move out',
      subtitle: 'Schedule the leaving date or close the stay once the room is fully clear.',
    },
  };

  const rentSectionCopy = {
    ledger: {
      title: 'Track dues',
      subtitle: 'See who has paid, who is due soon, and who needs follow-up now.',
    },
    'payment-review': {
      title: 'Final approvals',
      subtitle: 'Approve the tenant payment and supporting proof in one last step.',
    },
  };

  const residentActions = [
    {
      key: 'inventory',
      title: 'Add room',
      description: 'Create a room first so every tenant can be assigned cleanly.',
      meta: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} created`,
      status: 'Setup',
      onPress: () => setResidentMode('inventory'),
    },
    {
      key: 'movein',
      title: 'Fill a room',
      description: 'Start from an open room and complete the tenant move-in in one guided flow.',
      meta:
        invitedTenancies.length
          ? `${invitedTenancies.length} waiting for agreement`
          : vacantRooms.length
            ? `${vacantRooms.length} open room${vacantRooms.length === 1 ? '' : 's'}`
            : 'No room available',
      status: 'Occupancy',
      onPress: () => setResidentMode('movein'),
    },
    {
      key: 'rooms',
      title: 'Room list',
      description: 'See every room with its current occupancy state and next likely action.',
      meta: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'}`,
      status: 'Rooms',
      onPress: () => setResidentMode('rooms'),
    },
    {
      key: 'moveout',
      title: 'Move out',
      description: 'Schedule move-out or close a stay after the tenant leaves.',
      meta: activeTenancies.length ? `${activeTenancies.length} active stay${activeTenancies.length === 1 ? '' : 's'}` : 'No active stays',
      status: 'Move-out',
      onPress: () => setResidentMode('moveout'),
    },
  ];

  const residentFocus =
    !state.rooms.length
      ? {
          title: 'Create your first room',
          description: 'Rooms come first. Add the room and meter before onboarding tenants.',
          actionLabel: 'Add room',
          onPress: () => setResidentMode('inventory'),
        }
      : vacantRooms.length
        ? {
          title: 'Assign each tenant to a room',
          description: 'Pick an open room before you move the tenant further in the flow.',
          actionLabel: 'Fill a room',
          onPress: () => setResidentMode('movein'),
        }
      : invitedTenancies.length
      ? {
          title: `${invitedTenancies.length} move-in${invitedTenancies.length > 1 ? 's are' : ' is'} waiting`,
          description: 'The next useful action is to upload the agreement and start the stay.',
          actionLabel: 'Fill a room',
          onPress: () => setResidentMode('movein'),
        }
        : {
            title: 'Rooms are under control',
            description: 'Use the actions below when you want to add rooms, fill open ones, or manage active stays.',
            actionLabel: 'Room list',
            onPress: () => setResidentMode('rooms'),
          };

  const rentFocus =
    pendingSubmissions.length
      ? {
          title: `${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''} waiting`,
          description: 'The next useful rent task is to review submitted payment proof and close the bill.',
          actionLabel: 'Review approvals',
          onPress: () => setRentMode('payment-review'),
        }
      : overdueInvoices.length
        ? {
            title: `${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`,
            description: 'Focus on overdue tenants first so you stay ahead of collections.',
            actionLabel: 'Track dues',
            onPress: () => setRentMode('ledger'),
          }
        : dueInvoices.length
          ? {
              title: `${dueInvoices.length} bill${dueInvoices.length > 1 ? 's are' : ' is'} due soon`,
              description: 'Check who is due next and whether reminders were sent.',
              actionLabel: 'Track dues',
              onPress: () => setRentMode('ledger'),
            }
          : {
            title: 'Collections look calm',
            description: 'Use the actions below to monitor dues and close final approvals when they arrive.',
            actionLabel: 'Track dues',
            onPress: () => setRentMode('ledger'),
          };

  const rentActions = [
    {
      key: 'ledger',
      title: 'Track dues',
      description: 'Monitor due, overdue, and paid bills across all tenants.',
      meta:
        overdueInvoices.length
          ? `${overdueInvoices.length} overdue`
          : dueInvoices.length
            ? `${dueInvoices.length} due`
            : 'All current',
      status: 'Collections',
      onPress: () => setRentMode('ledger'),
    },
    {
      key: 'payment-review',
      title: 'Final approvals',
      description: 'Review payment proof and close the tenant bill in one step.',
      meta: pendingSubmissions.length ? `${pendingSubmissions.length} waiting` : 'Nothing waiting',
      status: 'Approvals',
      onPress: () => setRentMode('payment-review'),
    },
  ];

  const handleAction = async (callback, successMessage) => {
    try {
      setFeedback(null);
      await callback();
      setFeedback({ tone: 'success', text: successMessage });
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  const chooseContractImage = async () => {
    try {
      setFeedback(null);
      const upload = await pickImageUpload();
      if (!upload) {
        return;
      }

      setContractForm((current) => ({
        ...current,
        contractUploads: [...current.contractUploads, upload].slice(0, 3),
      }));
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
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
          <Field label="Room number" value={roomForm.label} onChangeText={(value) => setRoomForm((current) => ({ ...current, label: value }))} placeholder="303" />
          <Field label="Floor" value={roomForm.floor} onChangeText={(value) => setRoomForm((current) => ({ ...current, floor: value }))} placeholder="3" />
          <Field label="Meter serial number" value={roomForm.serialNumber} onChangeText={(value) => setRoomForm((current) => ({ ...current, serialNumber: value }))} placeholder="LT-303-C" />
          <Field label="Meter opening reading" value={roomForm.openingReading} onChangeText={(value) => setRoomForm((current) => ({ ...current, openingReading: value }))} keyboardType="numeric" />
          <PrimaryButton label="Create room" onPress={() => handleAction(async () => { await actions.addRoom(roomForm); setRoomForm({ label: '', floor: '', serialNumber: '', openingReading: '0' }); }, 'Room and meter added.')} />
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
      ) : <EmptyState title="No rooms yet" description="Add your first room here to start occupancy." />;
    }

    if (residentMode === 'movein') {
      return (
        <View style={styles.stack}>
          {vacantRooms.length ? (
            <View style={styles.inlineSection}>
              <Text style={styles.inlineSectionTitle}>1. Assign room</Text>
              <Text style={styles.inlineSectionSubtitle}>Pick an open room and reserve it for the tenant.</Text>
              <Field label="Tenant name" value={inviteForm.fullName} onChangeText={(value) => setInviteForm((current) => ({ ...current, fullName: value }))} />
              <Field label="Tenant mobile number" value={inviteForm.phone} onChangeText={(value) => setInviteForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
              <ChoiceChips value={inviteForm.roomId} onChange={(value) => setInviteForm((current) => ({ ...current, roomId: value }))} options={vacantRooms.map((room) => ({ value: room.id, label: `Room ${room.label}`, meta: `Floor ${room.floor}` }))} />
              <PrimaryButton label="Assign room" onPress={() => handleAction(async () => { await actions.inviteTenant(inviteForm); setInviteForm({ fullName: '', phone: '', roomId: '' }); }, 'Tenant assigned to the room and onboarding started.')} />
            </View>
          ) : null}

          {invitedTenancies.length ? (
            <View style={styles.inlineSection}>
              <Text style={styles.inlineSectionTitle}>2. Finish move-in</Text>
              <Text style={styles.inlineSectionSubtitle}>Upload the agreement and activate the stay.</Text>
              <ChoiceChips value={contractForm.tenancyId} onChange={(value) => setContractForm((current) => ({ ...current, tenancyId: value }))} options={invitedTenancies.map((tenancy) => ({ value: tenancy.id, label: getTenant(tenancy.tenantId)?.fullName || 'Tenant', meta: `Room ${getRoom(tenancy.roomId)?.label}` }))} />
              <View style={styles.contractUploadBlock}>
                <Text style={styles.contractUploadTitle}>Agreement images</Text>
                <Text style={styles.contractUploadSubtitle}>Upload 2 or 3 clear images of the signed agreement.</Text>
                <PrimaryButton
                  label={contractForm.contractUploads.length ? 'Add another image' : 'Upload agreement image'}
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
              <Field label="Monthly rent" value={contractForm.rentAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, rentAmount: value }))} keyboardType="numeric" />
              <Field label="Deposit amount" value={contractForm.depositAmount} onChangeText={(value) => setContractForm((current) => ({ ...current, depositAmount: value }))} keyboardType="numeric" />
              <Field label="Due day" value={contractForm.dueDay} onChangeText={(value) => setContractForm((current) => ({ ...current, dueDay: value }))} keyboardType="numeric" />
              <Field label="Move-in date" value={contractForm.moveInDate} onChangeText={(value) => setContractForm((current) => ({ ...current, moveInDate: value }))} placeholder="YYYY-MM-DD" />
              <Field label="Agreement start" value={contractForm.contractStart} onChangeText={(value) => setContractForm((current) => ({ ...current, contractStart: value }))} placeholder="YYYY-MM-DD" />
              <Field label="Agreement end" value={contractForm.contractEnd} onChangeText={(value) => setContractForm((current) => ({ ...current, contractEnd: value }))} placeholder="YYYY-MM-DD" />
              <PrimaryButton label="Start stay" onPress={() => handleAction(async () => {
                await actions.activateTenancy(contractForm);
                setContractForm((current) => ({
                  ...current,
                  contractUploads: [],
                }));
              }, 'Agreement images saved and stay is now active.')} />
            </View>
          ) : null}

          {!vacantRooms.length && !invitedTenancies.length ? (
            <EmptyState title="No move-ins ready" description="Add a room first, then assign a tenant to begin the move-in flow." />
          ) : null}
        </View>
      );
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
    ) : <EmptyState title="No active stays" description="Move-out controls appear here once there are active stays." />;
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
      <EmptyState
        title="Room setup lives in Rooms"
        description="Use the Rooms tab when you want to add a room or fill an open one."
      />
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
      <FocusCard eyebrow="Do now" title={focus.title} description={focus.description} tone={focus.tone} actionLabel={focus.mode ? 'Open next task' : null} onAction={focus.mode ? () => openTask({ tab: focus.tab, mode: focus.mode }) : undefined} />
          <SectionCard title="Snapshot" subtitle="The essential picture of the property right now." tone="soft">
            <MetricRow items={[{ label: 'Living now', value: summary.livingNow }, { label: 'Empty rooms', value: summary.availableRooms }, { label: 'Leaving soon', value: summary.leavingSoon }, { label: 'Unpaid', value: summary.unpaidNow }]} />
          </SectionCard>
          <SectionCard title="Room changes coming up" subtitle="Know who is leaving and when the next room will open.">
            {moveOutTenancies.length ? (
              <View style={styles.stack}>
                {moveOutTenancies.map((tenancy) => {
                  const tenant = getTenant(tenancy.tenantId);
                  const room = getRoom(tenancy.roomId);

                  return (
                    <View key={tenancy.id} style={styles.listCard}>
                      <InlineGroup>
                        <Text style={styles.listTitle}>{tenant?.fullName || 'Tenant'}</Text>
                        <StatusBadge label={tenancy.status} />
                      </InlineGroup>
                      <Text style={styles.listText}>
                        Room {room?.label || '-'} | leaving on {formatDate(tenancy.moveOutDate)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyState title="No planned move-outs" description="No resident is marked as leaving right now." />
            )}
          </SectionCard>
          <SectionCard title="Rent to follow up" subtitle="See who has not paid, when rent is due, and whether reminders have gone out.">
            {collectionWatch.length ? (
              <View style={styles.stack}>
                {collectionWatch.map((invoice) => (
                  <View key={invoice.id} style={styles.listCard}>
                    <InlineGroup>
                      <Text style={styles.listTitle}>{invoice.tenantName}</Text>
                      <StatusBadge label={invoice.derivedStatus} />
                    </InlineGroup>
                    <Text style={styles.listText}>
                      Room {invoice.roomLabel} | {formatCurrency(invoice.totalAmount)} | {invoice.dueWindow}
                    </Text>
                    <KeyValueRow label="Due date" value={formatDate(invoice.dueDate)} />
                    <KeyValueRow label="Reminder" value={invoice.reminderState} />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="All dues are clear" description="No tenant is currently waiting on rent follow-up." />
            )}
          </SectionCard>
          <SectionCard title="Property snapshot" subtitle="Reference details that help you stay ahead without digging.">
            <KeyValueRow label="Payout UPI" value={state.settlementAccount.upiId} />
            <KeyValueRow label="Electricity rate" value={`${state.property.defaultTariff}/unit`} />
            <KeyValueRow label="Final approvals waiting" value={String(summary.finalApprovals)} />
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'rooms' ? (
        <>
          <FocusCard
            eyebrow="Rooms"
            title={residentFocus.title}
            description={residentFocus.description}
            tone="soft"
            actionLabel={residentFocus.actionLabel}
            onAction={residentFocus.onPress}
          />
          <SectionCard title="Room actions" subtitle="Choose the room job you want to do now.">
            <View style={styles.stack}>
              {residentActions.map((action) => {
                const isActive = residentMode === action.key;

                return (
                  <View key={action.key} style={[styles.residentActionCard, isActive && styles.residentActionCardActive]}>
                    <View style={styles.residentActionCopy}>
                      <InlineGroup>
                        <Text style={styles.residentActionTitle}>{action.title}</Text>
                        {isActive ? <StatusBadge label="OPEN" /> : null}
                      </InlineGroup>
                      <Text style={styles.residentActionDescription}>{action.description}</Text>
                      <InlineGroup>
                        <Text style={styles.residentActionMeta}>{action.status}</Text>
                        <Text style={styles.residentActionDivider}>|</Text>
                        <Text style={styles.residentActionMeta}>{action.meta}</Text>
                      </InlineGroup>
                      {isActive ? (
                        <View style={styles.residentActionPanel}>
                          <Text style={styles.residentPanelTitle}>{residentSectionCopy[residentMode].title}</Text>
                          <Text style={styles.residentPanelSubtitle}>{residentSectionCopy[residentMode].subtitle}</Text>
                          <View style={styles.residentPanelBody}>{renderResidentContent()}</View>
                        </View>
                      ) : null}
                    </View>
                    <PrimaryButton
                      label={isActive ? 'Open now' : 'Choose'}
                      tone={isActive ? 'primary' : 'secondary'}
                      compact
                      onPress={action.onPress}
                    />
                  </View>
                );
              })}
            </View>
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'rent' ? (
        <>
          <FocusCard
            eyebrow="Rent"
            title={rentFocus.title}
            description={rentFocus.description}
            tone="soft"
            actionLabel={rentFocus.actionLabel}
            onAction={rentFocus.onPress}
          />
          <SectionCard title="Rent actions" subtitle="Choose the rent job you want to do now.">
            <View style={styles.stack}>
              {rentActions.map((action) => {
                const isActive = rentMode === action.key;

                return (
                  <View key={action.key} style={[styles.residentActionCard, isActive && styles.residentActionCardActive]}>
                    <View style={styles.residentActionCopy}>
                      <InlineGroup>
                        <Text style={styles.residentActionTitle}>{action.title}</Text>
                        {isActive ? <StatusBadge label="OPEN" /> : null}
                      </InlineGroup>
                      <Text style={styles.residentActionDescription}>{action.description}</Text>
                      <InlineGroup>
                        <Text style={styles.residentActionMeta}>{action.status}</Text>
                        <Text style={styles.residentActionDivider}>|</Text>
                        <Text style={styles.residentActionMeta}>{action.meta}</Text>
                      </InlineGroup>
                      {isActive ? (
                        <View style={styles.residentActionPanel}>
                          <Text style={styles.residentPanelTitle}>{rentSectionCopy[rentMode].title}</Text>
                          <Text style={styles.residentPanelSubtitle}>{rentSectionCopy[rentMode].subtitle}</Text>
                          <View style={styles.residentPanelBody}>{renderRentContent()}</View>
                        </View>
                      ) : null}
                    </View>
                    <PrimaryButton
                      label={isActive ? 'Open now' : 'Choose'}
                      tone={isActive ? 'primary' : 'secondary'}
                      compact
                      onPress={action.onPress}
                    />
                  </View>
                );
              })}
            </View>
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
          <SectionCard title="Property settings" subtitle="Change details only when something changes.">
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
  residentActionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  residentActionCardActive: {
    backgroundColor: palette.surfaceTint,
    borderColor: '#BFEADE',
  },
  residentActionCopy: {
    flex: 1,
    gap: 6,
  },
  residentActionTitle: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
  residentActionDescription: {
    color: palette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  residentActionMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  residentActionDivider: {
    color: palette.mutedSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  contractUploadBlock: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
  },
  contractUploadTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  contractUploadSubtitle: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  contractUploadCard: {
    gap: 8,
  },
  residentActionPanel: {
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: 10,
  },
  residentPanelTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  residentPanelSubtitle: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  residentPanelBody: {
    gap: 12,
  },
  inlineSection: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inlineSectionTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  inlineSectionSubtitle: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 20,
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
