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
  { label: 'Invite tenant', value: 'invite' },
  { label: 'Complete move-in', value: 'activate' },
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

const roomStatusThemes = {
  paid: {
    label: 'Paid',
    backgroundColor: '#EAF8EE',
    borderColor: '#BCE8C9',
    color: '#107A45',
  },
  due: {
    label: 'Due',
    backgroundColor: '#FFF4CF',
    borderColor: '#F0D375',
    color: '#9B6D00',
  },
  review: {
    label: 'Review',
    backgroundColor: '#FFF8DE',
    borderColor: '#F1D98B',
    color: '#8D6500',
  },
  overdue: {
    label: 'Overdue',
    backgroundColor: '#FFE8E4',
    borderColor: '#F2B8AE',
    color: '#B42318',
  },
  vacant: {
    label: 'Vacant',
    backgroundColor: '#F4F7F8',
    borderColor: '#DDE7E9',
    color: '#667085',
  },
};

const roomStatusLegend = [
  { key: 'paid', label: 'Paid' },
  { key: 'review', label: 'To review' },
  { key: 'overdue', label: 'Overdue' },
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

function RoomStatusBoard({ title, items }) {
  return (
    <View style={styles.roomStatusBoard}>
      <View style={styles.roomStatusHeader}>
        <Text style={styles.roomStatusTitle}>{title}</Text>
        <Text style={styles.roomStatusCount}>{items.length} rooms</Text>
      </View>
      <View style={styles.roomStatusLegend}>
        {roomStatusLegend.map((legendItem) => {
          const theme = roomStatusThemes[legendItem.key];

          return (
            <View key={legendItem.key} style={styles.roomStatusLegendItem}>
              <View style={[styles.roomStatusDot, { backgroundColor: theme.color }]} />
              <Text style={styles.roomStatusLegendText}>{legendItem.label}</Text>
            </View>
          );
        })}
      </View>
      {items.length ? (
        <View style={styles.roomTileGrid}>
          {items.map((item) => {
            const theme = roomStatusThemes[item.statusKind] || roomStatusThemes.vacant;

            return (
              <View
                key={item.roomId}
                style={[
                  styles.roomTile,
                  {
                    backgroundColor: theme.backgroundColor,
                    borderColor: theme.borderColor,
                  },
                ]}
              >
                <View style={styles.roomTileHeader}>
                  <Text style={styles.roomTileNumber}>{item.roomLabel}</Text>
                  <Text style={[styles.roomTileStatus, { color: theme.color }]}>{item.statusLabel}</Text>
                </View>
                <Text style={styles.roomTileTenant} numberOfLines={1}>{item.tenantName}</Text>
                {item.amountLabel ? <Text style={styles.roomTileAmount}>{item.amountLabel}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.roomStatusEmpty}>No rooms created yet.</Text>
      )}
    </View>
  );
}

function PipelineStepCard({ action, isActive, onPress }) {
  return (
    <View style={[styles.pipelineStep, isActive && styles.pipelineStepActive]}>
      <View style={styles.pipelineStepNumber}>
        <Text style={styles.pipelineStepNumberText}>{action.step}</Text>
      </View>
      <View style={styles.pipelineStepCopy}>
        <InlineGroup>
          <Text style={styles.pipelineStepTitle}>{action.title}</Text>
          {isActive ? <StatusBadge label="OPEN" /> : null}
        </InlineGroup>
        <Text style={styles.pipelineStepDescription}>{action.description}</Text>
        <Text style={styles.pipelineStepMeta}>{action.meta}</Text>
      </View>
      <PrimaryButton
        label={isActive ? 'Open' : 'Go'}
        tone={isActive ? 'primary' : 'secondary'}
        compact
        onPress={onPress}
      />
    </View>
  );
}

function QueueItemCard({ item }) {
  return (
    <View style={styles.queueItem}>
      <View style={styles.queueCopy}>
        <InlineGroup>
          <Text style={styles.queueTitle}>{item.title}</Text>
          {item.badge ? <StatusBadge label={item.badge} /> : null}
        </InlineGroup>
        <Text style={styles.queueDescription}>{item.description}</Text>
        {item.meta ? <Text style={styles.queueMeta}>{item.meta}</Text> : null}
      </View>
      <PrimaryButton label={item.actionLabel} tone="secondary" compact onPress={item.onPress} />
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

  const latestInvoiceByRoomId = new Map();
  invoices.forEach((invoice) => {
    if (!latestInvoiceByRoomId.has(invoice.roomId)) {
      latestInvoiceByRoomId.set(invoice.roomId, invoice);
    }
  });

  const latestSubmissionByInvoiceId = new Map();
  [...state.paymentSubmissions]
    .sort((left, right) => String(right.submittedAt || '').localeCompare(String(left.submittedAt || '')))
    .forEach((submission) => {
      if (!latestSubmissionByInvoiceId.has(submission.invoiceId)) {
        latestSubmissionByInvoiceId.set(submission.invoiceId, submission);
      }
    });

  const roomStatusItems = [...state.rooms]
    .sort((left, right) => String(left.label).localeCompare(String(right.label), undefined, { numeric: true }))
    .map((room) => {
      const tenancy = state.tenancies.find(
        (record) => record.roomId === room.id && ['ACTIVE', 'MOVE_OUT_SCHEDULED', 'INVITED'].includes(record.status),
      );
      const latestInvoice = latestInvoiceByRoomId.get(room.id) || null;
      const latestSubmission = latestInvoice ? latestSubmissionByInvoiceId.get(latestInvoice.id) : null;
      const tenant = tenancy ? getTenant(tenancy.tenantId) : latestInvoice ? getTenant(latestInvoice.tenantId) : null;
      let statusKind = room.status === 'VACANT' ? 'vacant' : 'paid';
      let statusLabel = room.status === 'VACANT' ? 'Vacant' : 'Current';

      if (latestSubmission?.status === 'REJECTED') {
        statusKind = 'overdue';
        statusLabel = 'Rejected';
      } else if (latestInvoice?.derivedStatus === 'OVERDUE') {
        statusKind = 'overdue';
        statusLabel = 'Overdue';
      } else if (latestSubmission?.status === 'PENDING_REVIEW' || latestInvoice?.derivedStatus === 'PAYMENT_SUBMITTED') {
        statusKind = 'review';
        statusLabel = 'Review';
      } else if (latestInvoice && ['DUE', 'ISSUED'].includes(latestInvoice.derivedStatus)) {
        statusKind = 'due';
        statusLabel = 'Due';
      } else if (latestInvoice?.derivedStatus === 'PAID') {
        statusKind = 'paid';
        statusLabel = 'Paid';
      } else if (tenancy?.status === 'INVITED') {
        statusKind = 'due';
        statusLabel = 'Move-in';
      }

      return {
        roomId: room.id,
        roomLabel: room.label,
        tenantName: tenant?.fullName || (room.status === 'VACANT' ? 'Open room' : 'Resident pending'),
        statusKind,
        statusLabel,
        amountLabel: latestInvoice ? formatCurrency(latestInvoice.totalAmount) : '',
      };
    });

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

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setFeedback(null);
    }, 3200);

    return () => clearTimeout(timeoutId);
  }, [feedback]);

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

  const heroCopy = {
    home: {
      eyebrow: 'Landlord',
      title: state.property.name,
      subtitle: '',
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
    invite: {
      title: 'Invite tenant',
      subtitle: 'Assign an open room first so the tenant enters the flow with the right room.',
    },
    activate: {
      title: 'Complete move-in',
      subtitle: 'Only invited tenants appear here so the agreement step stays clean and focused.',
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

  const moveInPipelineActions = [
    {
      key: 'inventory',
      step: '1',
      title: 'Add room',
      description: 'Create the physical room and attach its meter.',
      meta: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} created`,
      status: 'Setup',
      onPress: () => setResidentMode('inventory'),
    },
    {
      key: 'invite',
      step: '2',
      title: 'Invite tenant',
      description: 'Pick an open room and reserve it for the next tenant.',
      meta:
        vacantRooms.length
          ? `${vacantRooms.length} open room${vacantRooms.length === 1 ? '' : 's'}`
          : 'No room available',
      status: 'Occupancy',
      onPress: () => setResidentMode('invite'),
    },
    {
      key: 'activate',
      step: '3',
      title: 'Complete move-in',
      description: 'Upload agreement details and start the active stay.',
      meta:
        invitedTenancies.length
          ? `${invitedTenancies.length} waiting for agreement`
          : 'Nothing waiting',
      status: 'Move-in',
      onPress: () => setResidentMode('activate'),
    },
  ];

  const roomManagementActions = [
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

  const ownerQueue = [
    pendingSubmissions.length
      ? {
          title: `${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''}`,
          description: 'Payment proof is waiting for your final review.',
          meta: 'Includes bill, meter photo, UTR, and payment screenshot.',
          badge: 'PENDING_REVIEW',
          actionLabel: 'Review',
          onPress: () => openTask({ tab: 'rent', mode: 'payment-review' }),
        }
      : null,
    invitedTenancies.length
      ? {
          title: `${invitedTenancies.length} move-in${invitedTenancies.length > 1 ? 's' : ''} waiting`,
          description: 'Agreement details are the only thing left before the stay becomes active.',
          meta: 'Finish this after the tenant has been assigned to a room.',
          badge: 'INVITED',
          actionLabel: 'Complete',
          onPress: () => openTask({ tab: 'rooms', mode: 'activate' }),
        }
      : null,
    vacantRooms.length
      ? {
          title: `${vacantRooms.length} open room${vacantRooms.length > 1 ? 's' : ''}`,
          description: 'There is room to invite the next tenant.',
          meta: 'Assign room first, then complete move-in later.',
          badge: 'VACANT',
          actionLabel: 'Invite',
          onPress: () => openTask({ tab: 'rooms', mode: 'invite' }),
        }
      : null,
    overdueInvoices.length
      ? {
          title: `${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`,
          description: 'Collections need follow-up before the delay grows.',
          meta: 'Check due dates, reminders, and tenant status.',
          badge: 'OVERDUE',
          actionLabel: 'Track',
          onPress: () => openTask({ tab: 'rent', mode: 'ledger' }),
        }
      : null,
    moveOutTenancies.length
      ? {
          title: `${moveOutTenancies.length} planned move-out${moveOutTenancies.length > 1 ? 's' : ''}`,
          description: 'A room is scheduled to open soon.',
          meta: `Next: Room ${getRoom(moveOutTenancies[0].roomId)?.label || '-'}`,
          badge: 'MOVE_OUT_SCHEDULED',
          actionLabel: 'Manage',
          onPress: () => openTask({ tab: 'rooms', mode: 'moveout' }),
        }
      : null,
  ].filter(Boolean);

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
          <PrimaryButton label="Create room" onPress={() => handleAction(async () => {
            await actions.addRoom(roomForm);
            setRoomForm({ label: '', floor: '', serialNumber: '', openingReading: '0' });
            setResidentMode('invite');
          }, 'Room added. You can assign a tenant next.')} />
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

    if (residentMode === 'invite') {
      return vacantRooms.length ? (
        <View style={styles.inlineSection}>
          <Text style={styles.inlineSectionTitle}>Invite a tenant to a room</Text>
          <Text style={styles.inlineSectionSubtitle}>This step only reserves the room and starts tenant onboarding.</Text>
          <Field label="Tenant name" value={inviteForm.fullName} onChangeText={(value) => setInviteForm((current) => ({ ...current, fullName: value }))} />
          <Field label="Tenant mobile number" value={inviteForm.phone} onChangeText={(value) => setInviteForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
          <ChoiceChips value={inviteForm.roomId} onChange={(value) => setInviteForm((current) => ({ ...current, roomId: value }))} options={vacantRooms.map((room) => ({ value: room.id, label: `Room ${room.label}`, meta: `Floor ${room.floor}` }))} />
          <View style={styles.fullWidthAction}>
            <PrimaryButton label="Assign room" onPress={() => handleAction(async () => {
              await actions.inviteTenant(inviteForm);
              setInviteForm({ fullName: '', phone: '', roomId: '' });
              setResidentMode('activate');
            }, 'Tenant added to the room. Complete move-in next.')} />
          </View>
        </View>
      ) : (
        <EmptyState title="No open rooms" description="Add a room first or wait until a room becomes available." />
      );
    }

    if (residentMode === 'activate') {
      return (
        <View style={styles.stack}>
          {invitedTenancies.length ? (
            <View style={styles.inlineSection}>
              <Text style={styles.inlineSectionTitle}>Complete move-in</Text>
              <Text style={styles.inlineSectionSubtitle}>Upload the agreement and activate the stay for an already assigned tenant.</Text>
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
                setResidentMode('rooms');
              }, 'Move-in complete. The stay is now active.')} />
            </View>
          ) : null}

          {!invitedTenancies.length ? (
            <EmptyState title="No move-ins ready" description="Invite a tenant to a room first. Once that is done, the agreement step will appear here." />
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
      return (
        <View style={styles.stack}>
          <RoomStatusBoard title="Rooms overview" items={roomStatusItems} />
          {collectionWatch.length ? (
            <View style={styles.stack}>
              {collectionWatch.map((invoice) => (
                <View key={invoice.id} style={styles.listCard}>
                  <InlineGroup>
                    <Text style={styles.listTitle}>Room {invoice.roomLabel}</Text>
                    <StatusBadge label={invoice.derivedStatus} />
                  </InlineGroup>
                  <Text style={styles.listText}>{invoice.tenantName} | {formatMonth(invoice.month)} | {invoice.dueWindow}</Text>
                  <KeyValueRow label="Total" value={formatCurrency(invoice.totalAmount)} />
                  <KeyValueRow label="Electricity" value={formatCurrency(invoice.electricityCharge)} />
                  <KeyValueRow label="Reminder" value={invoice.reminderState} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState title="No dues waiting" description="The room map above is current. New due items will appear here when a bill needs attention." />
          )}
        </View>
      );
    }

    if (rentMode === 'payment-review') {
      return (
        <View style={styles.stack}>
          <RoomStatusBoard title="Approval map" items={roomStatusItems} />
          {pendingSubmissions.length ? (
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
                      <Text style={styles.listTitle}>Room {room?.label || '-'}</Text>
                      <StatusBadge label={submission.status} />
                    </InlineGroup>
                    <Text style={styles.listText}>
                      {tenant?.fullName || 'Tenant'} | {invoice ? formatMonth(invoice.month) : '-'} | due{' '}
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
              description="Yellow rooms appear here when tenants submit the meter photo and payment proof together."
            />
          )}
        </View>
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
    <View style={styles.screenWrap}>
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

      {activeTab === 'home' ? (
        <>
          <SectionCard title="Snapshot" subtitle="The essential picture of the property right now." tone="soft">
            <MetricRow items={[{ label: 'Living now', value: summary.livingNow }, { label: 'Empty rooms', value: summary.availableRooms }, { label: 'Leaving soon', value: summary.leavingSoon }, { label: 'Unpaid', value: summary.unpaidNow }]} />
          </SectionCard>
          <SectionCard title="Today's queue" subtitle="The next actions worth your attention.">
            {ownerQueue.length ? (
              <View style={styles.stack}>
                {ownerQueue.map((item) => (
                  <QueueItemCard key={item.title} item={item} />
                ))}
              </View>
            ) : (
              <EmptyState title="No urgent work" description="Rooms, move-ins, and rent are calm right now." />
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
          <SectionCard title="Move-in pipeline" subtitle="Do these in order. The active workspace opens below.">
            <View style={styles.pipelineWrap}>
              {moveInPipelineActions.map((action) => (
                <PipelineStepCard
                  key={action.key}
                  action={action}
                  isActive={residentMode === action.key}
                  onPress={action.onPress}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard
            title={residentSectionCopy[residentMode].title}
            subtitle={residentSectionCopy[residentMode].subtitle}
            tone={['inventory', 'invite', 'activate'].includes(residentMode) ? 'accent' : 'default'}
          >
            <View style={styles.residentPanelBody}>{renderResidentContent()}</View>
          </SectionCard>

          <SectionCard title="Manage stays" subtitle="Use these after rooms and move-ins are already running.">
            <View style={styles.managementGrid}>
              {roomManagementActions.map((action) => {
                const isActive = residentMode === action.key;

                return (
                  <View key={action.key} style={[styles.managementCard, isActive && styles.managementCardActive]}>
                    <View style={styles.managementCopy}>
                      <InlineGroup>
                        <Text style={styles.managementTitle}>{action.title}</Text>
                        {isActive ? <StatusBadge label="OPEN" /> : null}
                      </InlineGroup>
                      <Text style={styles.managementDescription}>{action.description}</Text>
                      <Text style={styles.managementMeta}>{action.meta}</Text>
                    </View>
                    <PrimaryButton
                      label={isActive ? 'Open' : 'Go'}
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
                    <View style={[styles.residentActionCopy, isActive && styles.residentActionCopyActive]}>
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
            <PrimaryButton label="Log out" tone="danger" onPress={onLogout} />
          </SectionCard>
          <SectionCard title="Property settings" subtitle="Change details only when something changes.">
            <ChoiceChips options={profileModes} value={profileMode} onChange={setProfileMode} />
            {renderProfileContent()}
          </SectionCard>
        </>
      ) : null}
    </ScreenSurface>
    {feedback ? (
      <View pointerEvents="none" style={styles.toastViewport}>
        <View style={[styles.toastCard, feedback.tone === 'danger' ? styles.toastCardDanger : styles.toastCardSuccess]}>
          <Text style={styles.toastTitle}>{feedback.tone === 'danger' ? 'Something went wrong' : 'Done'}</Text>
          <Text style={styles.toastText}>{feedback.text}</Text>
        </View>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
  },
  stack: {
    gap: 12,
    alignSelf: 'stretch',
    width: '100%',
  },
  listCard: {
    alignSelf: 'stretch',
    width: '100%',
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
  roomStatusBoard: {
    gap: 12,
    alignSelf: 'stretch',
    width: '100%',
  },
  roomStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  roomStatusTitle: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  roomStatusCount: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  roomStatusLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomStatusLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  roomStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roomStatusLegendText: {
    color: palette.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  roomTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
  roomTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 124,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  roomTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roomTileNumber: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  roomTileStatus: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  roomTileTenant: {
    color: palette.inkSoft,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  roomTileAmount: {
    color: palette.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  roomStatusEmpty: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  pipelineWrap: {
    gap: 10,
    alignSelf: 'stretch',
    width: '100%',
  },
  pipelineStep: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  pipelineStepActive: {
    backgroundColor: palette.surfaceTint,
    borderColor: '#AEEBDD',
  },
  pipelineStepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFFBF6',
  },
  pipelineStepNumberText: {
    color: palette.accentDeep,
    fontSize: 14,
    fontWeight: '900',
  },
  pipelineStepCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  pipelineStepTitle: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  pipelineStepDescription: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  pipelineStepMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  managementGrid: {
    gap: 10,
    alignSelf: 'stretch',
    width: '100%',
  },
  managementCard: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  managementCardActive: {
    backgroundColor: palette.surfaceTint,
    borderColor: '#AEEBDD',
  },
  managementCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  managementTitle: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  managementDescription: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  managementMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  queueItem: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  queueCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  queueTitle: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  queueDescription: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  queueMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  residentActionCard: {
    alignSelf: 'stretch',
    width: '100%',
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
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: palette.surfaceTint,
    borderColor: '#BFEADE',
  },
  residentActionCopy: {
    flex: 1,
    gap: 6,
  },
  residentActionCopyActive: {
    alignSelf: 'stretch',
    width: '100%',
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
    alignSelf: 'stretch',
    width: '100%',
    padding: 14,
    borderRadius: 18,
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
    alignSelf: 'stretch',
    width: '100%',
  },
  residentActionPanel: {
    alignSelf: 'stretch',
    width: '100%',
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
    alignSelf: 'stretch',
    width: '100%',
  },
  inlineSection: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 14,
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fullWidthAction: {
    alignSelf: 'stretch',
    width: '100%',
  },
  inlineSectionTitle: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  inlineSectionSubtitle: {
    color: palette.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  formPanel: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  previewCard: {
    alignSelf: 'stretch',
    width: '100%',
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
  toastViewport: {
    position: 'absolute',
    top: 12,
    right: 12,
    left: 72,
    zIndex: 50,
    alignItems: 'flex-end',
  },
  toastCard: {
    maxWidth: 280,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    shadowColor: '#1F3130',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  toastCardSuccess: {
    backgroundColor: palette.surfaceSuccess,
    borderColor: '#CAEAD8',
  },
  toastCardDanger: {
    backgroundColor: palette.surfaceDanger,
    borderColor: '#F2D7D3',
  },
  toastTitle: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  toastText: {
    color: palette.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
