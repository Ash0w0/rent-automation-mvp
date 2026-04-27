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
        <Text style={styles.roomStatusEmpty}>No rooms yet.</Text>
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
        {action.description ? <Text style={styles.pipelineStepDescription}>{action.description}</Text> : null}
        {action.meta ? <Text style={styles.pipelineStepMeta}>{action.meta}</Text> : null}
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
        {item.description ? <Text style={styles.queueDescription}>{item.description}</Text> : null}
        {item.meta ? <Text style={styles.queueMeta}>{item.meta}</Text> : null}
      </View>
      <PrimaryButton label={item.actionLabel} tone="secondary" compact onPress={item.onPress} />
    </View>
  );
}

function OwnerOnboarding({ state, actions, onLogout }) {
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    name: '',
    address: '',
    managerName: state.owner?.name || '',
    managerPhone: state.owner?.phone || state.session?.phone || '',
    defaultTariff: '8.5',
    payeeName: state.owner?.name || '',
    upiId: '',
    instructions: 'Use room number and month in your UPI note.',
  });

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setFeedback(null), 3200);
    return () => clearTimeout(timeoutId);
  }, [feedback]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    try {
      setFeedback(null);
      await actions.createProperty({
        ...form,
        defaultTariff: Number(form.defaultTariff),
      });
    } catch (error) {
      setFeedback({ tone: 'danger', text: error.message });
    }
  };

  return (
    <View style={styles.screenWrap}>
      <ScreenSurface
        hero={
          <PageHeader
            eyebrow="Owner setup"
            title="Create property"
            subtitle="Start here. The tour will guide the rest."
          />
        }
      >
        {state.isSyncing ? <Banner tone="info" message="Saving..." /> : null}
        {!feedback && state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}
        {feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null}

        <SectionCard title="Property" tone="accent">
          <Field label="Property name" value={form.name} onChangeText={(value) => updateField('name', value)} placeholder="Lotus PG" />
          <Field label="Address" value={form.address} onChangeText={(value) => updateField('address', value)} multiline />
          <Field label="Manager name" value={form.managerName} onChangeText={(value) => updateField('managerName', value)} />
          <Field label="Manager phone" value={form.managerPhone} onChangeText={(value) => updateField('managerPhone', value)} keyboardType="phone-pad" />
          <Field label="Electricity rate" value={form.defaultTariff} onChangeText={(value) => updateField('defaultTariff', value)} keyboardType="decimal-pad" />
          <PrimaryButton label="Create property" onPress={submit} />
        </SectionCard>

        <SectionCard title="Next">
          <View style={styles.tourList}>
            {['Add rooms', 'Assign tenants', 'Complete move-ins', 'Track rent'].map((label, index) => (
              <View key={label} style={styles.tourRow}>
                <View style={styles.tourStepDot}>
                  <Text style={styles.tourStepDotText}>{index + 1}</Text>
                </View>
                <Text style={styles.tourStepTitle}>{label}</Text>
              </View>
            ))}
          </View>
          <PrimaryButton label="Log out" tone="danger" onPress={onLogout} />
        </SectionCard>
      </ScreenSurface>
    </View>
  );
}

function SetupTourCard({ steps, onOpen }) {
  const completedCount = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done);

  return (
    <SectionCard title="Setup tour" subtitle={`${completedCount}/${steps.length} done`} tone="accent">
      <View style={styles.tourList}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.tourRow}>
            <View style={[styles.tourStepDot, step.done && styles.tourStepDotDone]}>
              <Text style={[styles.tourStepDotText, step.done && styles.tourStepDotTextDone]}>
                {step.done ? 'OK' : index + 1}
              </Text>
            </View>
            <View style={styles.tourStepCopy}>
              <Text style={styles.tourStepTitle}>{step.title}</Text>
              {step.caption ? <Text style={styles.tourStepCaption}>{step.caption}</Text> : null}
            </View>
          </View>
        ))}
      </View>
      {nextStep ? (
        <PrimaryButton label={`Next: ${nextStep.title}`} onPress={() => onOpen(nextStep)} />
      ) : (
        <PrimaryButton label="Open rent" tone="secondary" onPress={() => onOpen({ tab: 'rent', mode: 'ledger' })} />
      )}
    </SectionCard>
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
  const property = state.property || {};
  const settlementAccount = state.settlementAccount || {};
  const propertyName = property.name || 'Property';
  const propertyAddress = property.address || '';
  const managerName = property.managerName || '';
  const managerPhone = property.managerPhone || '';
  const defaultTariff = property.defaultTariff ?? 0;
  const payeeName = settlementAccount.payeeName || '';
  const upiId = settlementAccount.upiId || 'UPI not set';
  const payoutInstructions = settlementAccount.instructions || '';
  const [propertyForm, setPropertyForm] = useState({
    name: propertyName,
    address: propertyAddress,
    managerName,
    managerPhone,
    defaultTariff: String(defaultTariff),
  });
  const [settlementForm, setSettlementForm] = useState({
    payeeName,
    upiId: settlementAccount.upiId || '',
    instructions: payoutInstructions,
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
      let statusLabel = room.status === 'VACANT' ? 'Vacant' : 'Up to date';

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
      name: propertyName,
      address: propertyAddress,
      managerName,
      managerPhone,
      defaultTariff: String(defaultTariff),
    });
  }, [defaultTariff, managerName, managerPhone, propertyAddress, propertyName]);

  useEffect(() => {
    setSettlementForm({
      payeeName,
      upiId: settlementAccount.upiId || '',
      instructions: payoutInstructions,
    });
  }, [payeeName, payoutInstructions, settlementAccount.upiId]);

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
      title: propertyName,
      subtitle: '',
      highlights: [
        `${summary.availableRooms} open rooms`,
        `${summary.finalApprovals} final approvals`,
        `${summary.overdueInvoices} overdue`,
      ],
    },
    rooms: {
      eyebrow: 'Rooms',
      title: 'Rooms',
      subtitle: '',
      highlights: [`${activeTenancies.length} active`, `${invitedTenancies.length} waiting`, `${vacantRooms.length} open`],
    },
    rent: {
      eyebrow: 'Rent',
      title: 'Rent',
      subtitle: '',
      highlights: [
        `${pendingSubmissions.length} final approvals`,
        `${dueInvoices.length} due`,
        `${overdueInvoices.length} overdue`,
      ],
    },
    profile: {
      eyebrow: 'Profile',
      title: 'Profile',
      subtitle: '',
      highlights: [upiId, `${state.rooms.length} rooms`, `${defaultTariff}/unit`],
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
    if (task.tab === 'profile') {
      setProfileMode(task.mode);
    }
  };

  const setupTourSteps = [
    {
      key: 'property',
      title: 'Property',
      caption: propertyName,
      done: Boolean(state.property?.id),
      tab: 'profile',
      mode: 'property',
    },
    {
      key: 'payout',
      title: 'Payouts',
      caption: settlementAccount.upiId || 'UPI missing',
      done: Boolean(settlementAccount.upiId),
      tab: 'profile',
      mode: 'collection',
    },
    {
      key: 'rooms',
      title: 'Add room',
      caption: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'}`,
      done: state.rooms.length > 0,
      tab: 'rooms',
      mode: 'inventory',
    },
    {
      key: 'invite',
      title: 'Assign tenant',
      caption: `${state.tenancies.length} assigned`,
      done: state.tenancies.length > 0,
      tab: 'rooms',
      mode: vacantRooms.length ? 'invite' : 'inventory',
    },
    {
      key: 'movein',
      title: 'Start stay',
      caption: `${activeTenancies.length} active`,
      done: activeTenancies.length > 0,
      tab: 'rooms',
      mode: invitedTenancies.length ? 'activate' : 'invite',
    },
    {
      key: 'rent',
      title: 'Track rent',
      caption: `${invoices.length} bill${invoices.length === 1 ? '' : 's'}`,
      done: invoices.length > 0,
      tab: 'rent',
      mode: 'ledger',
    },
  ];
  const isSetupTourComplete = setupTourSteps.every((step) => step.done);
  const openTourStep = (step) => openTask(step);

  const residentSectionCopy = {
    inventory: {
      title: 'Add a room',
      subtitle: '',
    },
    rooms: {
      title: 'Room list',
      subtitle: '',
    },
    invite: {
      title: 'Invite room',
      subtitle: '',
    },
    activate: {
      title: 'Move-in',
      subtitle: '',
    },
    moveout: {
      title: 'Move out',
      subtitle: '',
    },
  };

  const moveInPipelineActions = [
    {
      key: 'inventory',
      step: '1',
      title: 'Add room',
      description: '',
      meta: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'} created`,
      status: 'Setup',
      onPress: () => setResidentMode('inventory'),
    },
    {
      key: 'invite',
      step: '2',
      title: 'Invite tenant',
      description: '',
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
      title: 'Move-in',
      description: '',
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
      description: '',
      meta: `${state.rooms.length} room${state.rooms.length === 1 ? '' : 's'}`,
      status: 'Rooms',
      onPress: () => setResidentMode('rooms'),
    },
    {
      key: 'moveout',
      title: 'Move out',
      description: '',
      meta: activeTenancies.length ? `${activeTenancies.length} active stay${activeTenancies.length === 1 ? '' : 's'}` : 'No active stays',
      status: 'Move-out',
      onPress: () => setResidentMode('moveout'),
    },
  ];

  const rentFocus =
    pendingSubmissions.length
      ? {
          title: `${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''} waiting`,
          description: 'Review and close.',
          actionLabel: 'Open',
          onPress: () => setRentMode('payment-review'),
        }
      : overdueInvoices.length
        ? {
            title: `${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`,
            description: 'Needs follow-up.',
            actionLabel: 'Open',
            onPress: () => setRentMode('ledger'),
          }
        : dueInvoices.length
          ? {
              title: `${dueInvoices.length} bill${dueInvoices.length > 1 ? 's are' : ' is'} due soon`,
              description: 'Check upcoming dues.',
              actionLabel: 'Open',
              onPress: () => setRentMode('ledger'),
            }
          : {
            title: 'All clear',
            description: '',
            actionLabel: 'Open',
            onPress: () => setRentMode('ledger'),
          };

  const rentActions = [
    {
      key: 'ledger',
      title: 'Track dues',
      description: '',
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
      description: '',
      meta: pendingSubmissions.length ? `${pendingSubmissions.length} waiting` : 'Nothing waiting',
      status: 'Approvals',
      onPress: () => setRentMode('payment-review'),
    },
  ];

  const ownerQueue = [
    pendingSubmissions.length
      ? {
          title: `${pendingSubmissions.length} final approval${pendingSubmissions.length > 1 ? 's' : ''}`,
          description: '',
          meta: 'Ready to review',
          badge: 'PENDING_REVIEW',
          actionLabel: 'Review',
          onPress: () => openTask({ tab: 'rent', mode: 'payment-review' }),
        }
      : null,
    invitedTenancies.length
      ? {
          title: `${invitedTenancies.length} move-in${invitedTenancies.length > 1 ? 's' : ''} waiting`,
          description: '',
          meta: 'Agreement pending',
          badge: 'INVITED',
          actionLabel: 'Complete',
          onPress: () => openTask({ tab: 'rooms', mode: 'activate' }),
        }
      : null,
    vacantRooms.length
      ? {
          title: `${vacantRooms.length} open room${vacantRooms.length > 1 ? 's' : ''}`,
          description: '',
          meta: 'Ready to fill',
          badge: 'VACANT',
          actionLabel: 'Invite',
          onPress: () => openTask({ tab: 'rooms', mode: 'invite' }),
        }
      : null,
    overdueInvoices.length
      ? {
          title: `${overdueInvoices.length} overdue bill${overdueInvoices.length > 1 ? 's' : ''}`,
          description: '',
          meta: 'Needs follow-up',
          badge: 'OVERDUE',
          actionLabel: 'Track',
          onPress: () => openTask({ tab: 'rent', mode: 'ledger' }),
        }
      : null,
    moveOutTenancies.length
      ? {
          title: `${moveOutTenancies.length} planned move-out${moveOutTenancies.length > 1 ? 's' : ''}`,
          description: '',
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
          }, 'Room added.')} />
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
      ) : <EmptyState title="No rooms yet" description="Add a room." />;
    }

    if (residentMode === 'invite') {
      return vacantRooms.length ? (
        <View style={styles.inlineSection}>
          <Field label="Tenant name" value={inviteForm.fullName} onChangeText={(value) => setInviteForm((current) => ({ ...current, fullName: value }))} />
          <Field label="Tenant mobile number" value={inviteForm.phone} onChangeText={(value) => setInviteForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
          <ChoiceChips value={inviteForm.roomId} onChange={(value) => setInviteForm((current) => ({ ...current, roomId: value }))} options={vacantRooms.map((room) => ({ value: room.id, label: `Room ${room.label}`, meta: `Floor ${room.floor}` }))} />
          <View style={styles.fullWidthAction}>
            <PrimaryButton label="Assign room" onPress={() => handleAction(async () => {
              await actions.inviteTenant(inviteForm);
              setInviteForm({ fullName: '', phone: '', roomId: '' });
              setResidentMode('activate');
            }, 'Room assigned.')} />
          </View>
        </View>
      ) : (
        <EmptyState title="No open rooms" description="Add a room first." />
      );
    }

    if (residentMode === 'activate') {
      return (
        <View style={styles.stack}>
          {invitedTenancies.length ? (
            <View style={styles.inlineSection}>
              <ChoiceChips value={contractForm.tenancyId} onChange={(value) => setContractForm((current) => ({ ...current, tenancyId: value }))} options={invitedTenancies.map((tenancy) => ({ value: tenancy.id, label: getTenant(tenancy.tenantId)?.fullName || 'Tenant', meta: `Room ${getRoom(tenancy.roomId)?.label}` }))} />
              <View style={styles.contractUploadBlock}>
                <Text style={styles.contractUploadTitle}>Agreement images</Text>
                <Text style={styles.contractUploadSubtitle}>Upload 2-3 signed pages.</Text>
                <PrimaryButton
                  label={contractForm.contractUploads.length ? 'Add image' : 'Upload images'}
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
              }, 'Stay started.')} />
            </View>
          ) : null}

          {!invitedTenancies.length ? (
            <EmptyState title="No move-ins ready" description="Assign a room first." />
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
          <PrimaryButton label="Mark complete" tone="secondary" onPress={() => handleAction(() => actions.closeTenancy(moveOutForm.tenancyId), 'Stay closed.')} />
        </InlineGroup>
      </>
    ) : <EmptyState title="No active stays" description="Nothing active." />;
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
            <EmptyState title="No dues" description="All clear for now." />
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
                            'Approved.',
                          )
                        }
                      />
                      <PrimaryButton
                        label="Reject"
                        tone="danger"
                        onPress={() =>
                          handleAction(
                            () => actions.reviewPayment({ submissionId: submission.id, decision: 'REJECT' }),
                            'Rejected.',
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
              title="No approvals"
              description="Nothing pending."
            />
          )}
        </View>
      );
    }

    return (
      <EmptyState
        title="No rent activity"
        description="Nothing here yet."
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
          <PrimaryButton label="Save property" onPress={() => handleAction(() => actions.updateProperty({ ...propertyForm, defaultTariff: Number(propertyForm.defaultTariff) }), 'Property saved.')} />
        </>
      );
    }

    if (profileMode === 'collection') {
      return (
        <>
          <Field label="Payee name" value={settlementForm.payeeName} onChangeText={(value) => setSettlementForm((current) => ({ ...current, payeeName: value }))} />
          <Field label="UPI ID" value={settlementForm.upiId} onChangeText={(value) => setSettlementForm((current) => ({ ...current, upiId: value }))} />
          <Field label="Note for tenants" value={settlementForm.instructions} onChangeText={(value) => setSettlementForm((current) => ({ ...current, instructions: value }))} multiline />
          <PrimaryButton label="Save payout account" onPress={() => handleAction(() => actions.updateSettlement(settlementForm), 'Payout saved.')} />
        </>
      );
    }

    return (
      <EmptyState
        title="Room setup is in Rooms"
        description="Use the Rooms tab."
      />
    );
  };

  if (!state.property) {
    return <OwnerOnboarding state={state} actions={actions} onLogout={onLogout} />;
  }

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
      {state.isSyncing ? <Banner tone="info" message="Updating..." /> : null}
      {!feedback && state.backendError ? <Banner tone="danger" message={state.backendError} /> : null}

      {activeTab === 'home' ? (
        <>
          {!isSetupTourComplete ? (
            <SetupTourCard steps={setupTourSteps} onOpen={openTourStep} />
          ) : null}
          <SectionCard title="Snapshot" tone="soft">
            <MetricRow items={[{ label: 'Living now', value: summary.livingNow }, { label: 'Empty rooms', value: summary.availableRooms }, { label: 'Leaving soon', value: summary.leavingSoon }, { label: 'Unpaid', value: summary.unpaidNow }]} />
          </SectionCard>
          <SectionCard title="Queue">
            {ownerQueue.length ? (
              <View style={styles.stack}>
                {ownerQueue.map((item) => (
                  <QueueItemCard key={item.title} item={item} />
                ))}
              </View>
            ) : (
              <EmptyState title="No urgent work" description="All quiet." />
            )}
          </SectionCard>
          <SectionCard title="Property">
            <KeyValueRow label="Payout UPI" value={upiId} />
            <KeyValueRow label="Electricity rate" value={`${defaultTariff}/unit`} />
            <KeyValueRow label="Final approvals waiting" value={String(summary.finalApprovals)} />
          </SectionCard>
        </>
      ) : null}

      {activeTab === 'rooms' ? (
        <>
          <SectionCard title="Move-in pipeline">
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

          <SectionCard title="Manage stays">
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
                      {action.description ? <Text style={styles.managementDescription}>{action.description}</Text> : null}
                      {action.meta ? <Text style={styles.managementMeta}>{action.meta}</Text> : null}
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
          <SectionCard title="Rent">
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
                      {action.description ? <Text style={styles.residentActionDescription}>{action.description}</Text> : null}
                      {(action.status || action.meta) ? (
                        <InlineGroup>
                          {action.status ? <Text style={styles.residentActionMeta}>{action.status}</Text> : null}
                          {action.status && action.meta ? <Text style={styles.residentActionDivider}>|</Text> : null}
                          {action.meta ? <Text style={styles.residentActionMeta}>{action.meta}</Text> : null}
                        </InlineGroup>
                      ) : null}
                      {isActive ? (
                        <View style={styles.residentActionPanel}>
                          <View style={styles.residentPanelBody}>{renderRentContent()}</View>
                        </View>
                      ) : null}
                    </View>
                    <PrimaryButton
                      label={isActive ? 'Open' : 'Choose'}
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
          <SectionCard title="Profile">
            <KeyValueRow label="Property" value={propertyName} />
            <KeyValueRow label="Manager" value={managerName || '-'} />
            <KeyValueRow label="Phone" value={managerPhone || '-'} />
            <PrimaryButton label="Log out" tone="danger" onPress={onLogout} />
          </SectionCard>
          <SectionCard title="Settings">
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
  tourList: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 10,
  },
  tourRow: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  tourStepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  tourStepDotDone: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  tourStepDotText: {
    color: palette.accentDeep,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
  },
  tourStepDotTextDone: {
    color: palette.white,
    fontSize: 9,
  },
  tourStepCopy: {
    flex: 1,
    minWidth: 0,
  },
  tourStepTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  tourStepCaption: {
    color: palette.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
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
