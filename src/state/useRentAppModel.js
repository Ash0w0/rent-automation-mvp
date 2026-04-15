import { useReducer } from 'react';

const { createSeedState } = require('../data/seed');
const { toMonthKey } = require('../lib/dateUtils');
const {
  INVOICE_STATUS,
  PAYMENT_SUBMISSION_STATUS,
  ROOM_STATUS,
  TENANCY_STATUS,
  buildContractRecord,
  cancelInvoiceReminders,
  createInvoiceForTenancy,
  createTenantInvite,
  deriveInvoiceStatus,
  isTenantProfileComplete,
  makeId,
} = require('../lib/rentEngine');

function updateById(items, nextItem) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        session: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        session: {
          role: null,
          phone: '',
          currentTenantId: null,
          currentOwnerId: null,
        },
      };
    case 'UPDATE_PROPERTY':
      return {
        ...state,
        property: {
          ...state.property,
          ...action.payload,
        },
      };
    case 'UPDATE_SETTLEMENT':
      return {
        ...state,
        settlementAccount: {
          ...state.settlementAccount,
          ...action.payload,
        },
      };
    case 'ADD_ROOM':
      return {
        ...state,
        rooms: [...state.rooms, action.payload.room],
        roomMeters: [...state.roomMeters, action.payload.meter],
      };
    case 'INVITE_TENANT':
      return {
        ...state,
        tenants: [...state.tenants, action.payload.tenant],
        tenancies: [
          ...state.tenancies,
          {
            ...action.payload.tenancy,
            tenantId: action.payload.tenant.id,
          },
        ],
        rooms: updateById(
          state.rooms,
          {
            ...state.rooms.find((room) => room.id === action.payload.tenancy.roomId),
            status: ROOM_STATUS.NOTICE,
          },
        ),
      };
    case 'COMPLETE_TENANT_PROFILE':
      return {
        ...state,
        tenants: updateById(state.tenants, action.payload),
      };
    case 'ACTIVATE_TENANCY':
      return {
        ...state,
        contracts: [...state.contracts, action.payload.contract],
        tenancies: updateById(state.tenancies, action.payload.tenancy),
        rooms: updateById(
          state.rooms,
          {
            ...state.rooms.find((room) => room.id === action.payload.tenancy.roomId),
            status: ROOM_STATUS.OCCUPIED,
          },
        ),
      };
    case 'GENERATE_INVOICE':
      return {
        ...state,
        invoices: [...state.invoices, action.payload.invoice],
        meterReadings: [...state.meterReadings, action.payload.meterReading],
        roomMeters: updateById(
          state.roomMeters,
          {
            ...state.roomMeters.find((meter) => meter.id === action.payload.meterReading.meterId),
            lastReading: action.payload.meterReading.closingReading,
          },
        ),
        reminders: [...state.reminders, ...action.payload.reminders],
      };
    case 'SUBMIT_PAYMENT':
      return {
        ...state,
        paymentSubmissions: [...state.paymentSubmissions, action.payload.submission],
        invoices: updateById(state.invoices, action.payload.invoice),
      };
    case 'REVIEW_PAYMENT':
      return {
        ...state,
        paymentSubmissions: updateById(state.paymentSubmissions, action.payload.submission),
        invoices: updateById(state.invoices, action.payload.invoice),
        reminders:
          action.payload.invoice.status === INVOICE_STATUS.PAID
            ? cancelInvoiceReminders(state.reminders, action.payload.invoice.id)
            : state.reminders,
      };
    case 'UPDATE_REMINDER_STATUS':
      return {
        ...state,
        reminders: updateById(state.reminders, action.payload),
      };
    case 'SCHEDULE_MOVE_OUT':
      return {
        ...state,
        tenancies: updateById(state.tenancies, action.payload.tenancy),
        rooms: updateById(
          state.rooms,
          {
            ...state.rooms.find((room) => room.id === action.payload.tenancy.roomId),
            status: ROOM_STATUS.NOTICE,
          },
        ),
      };
    case 'CLOSE_TENANCY':
      return {
        ...state,
        tenancies: updateById(state.tenancies, action.payload.tenancy),
        rooms: updateById(
          state.rooms,
          {
            ...state.rooms.find((room) => room.id === action.payload.tenancy.roomId),
            status: ROOM_STATUS.VACANT,
          },
        ),
      };
    default:
      return state;
  }
}

export function useRentAppModel() {
  const [state, dispatch] = useReducer(appReducer, undefined, createSeedState);

  const actions = {
    login(role, phone) {
      const normalizedPhone = phone.trim();

      if (role === 'owner') {
        if (normalizedPhone !== state.owner.phone) {
          throw new Error('Use owner demo login 9000000000 for the admin portal.');
        }

        dispatch({
          type: 'LOGIN',
          payload: {
            role: 'owner',
            phone: normalizedPhone,
            currentTenantId: null,
            currentOwnerId: state.owner.id,
          },
        });

        return;
      }

      const tenant = state.tenants.find((record) => record.phone === normalizedPhone);
      if (!tenant) {
        throw new Error('This tenant phone number is not invited yet.');
      }

      dispatch({
        type: 'LOGIN',
        payload: {
          role: 'tenant',
          phone: normalizedPhone,
          currentTenantId: tenant.id,
          currentOwnerId: null,
        },
      });
    },

    logout() {
      dispatch({ type: 'LOGOUT' });
    },

    updateProperty(payload) {
      dispatch({ type: 'UPDATE_PROPERTY', payload });
    },

    updateSettlement(payload) {
      dispatch({ type: 'UPDATE_SETTLEMENT', payload });
    },

    addRoom(input) {
      if (!input.label || !input.floor || !input.serialNumber) {
        throw new Error('Room label, floor, and meter serial number are required.');
      }

      if (state.rooms.some((room) => room.label === input.label)) {
        throw new Error('A room with this label already exists.');
      }

      const roomId = makeId('room');
      const meterId = makeId('meter');

      dispatch({
        type: 'ADD_ROOM',
        payload: {
          room: {
            id: roomId,
            propertyId: state.property.id,
            label: input.label,
            floor: input.floor,
            meterId,
            status: ROOM_STATUS.VACANT,
          },
          meter: {
            id: meterId,
            propertyId: state.property.id,
            roomId,
            serialNumber: input.serialNumber,
            lastReading: Number(input.openingReading || 0),
          },
        },
      });
    },

    inviteTenant(input) {
      if (!input.fullName || !input.phone || !input.roomId) {
        throw new Error('Tenant name, phone, and room selection are required.');
      }

      const room = state.rooms.find((item) => item.id === input.roomId);
      if (!room || room.status !== ROOM_STATUS.VACANT) {
        throw new Error('Only vacant rooms can be assigned to a new tenant invite.');
      }

      if (state.tenants.some((tenant) => tenant.phone === input.phone)) {
        throw new Error('That phone number is already associated with another tenant.');
      }

      const { tenant, tenancy } = createTenantInvite({
        propertyId: state.property.id,
        roomId: input.roomId,
        fullName: input.fullName,
        phone: input.phone,
      });

      dispatch({
        type: 'INVITE_TENANT',
        payload: { tenant, tenancy },
      });
    },

    completeTenantProfile(input) {
      const tenant = state.tenants.find((record) => record.id === input.tenantId);
      if (!tenant) {
        throw new Error('Unable to find the tenant profile.');
      }

      const nextTenant = {
        ...tenant,
        ...input,
      };

      nextTenant.profileStatus = isTenantProfileComplete(nextTenant) ? 'COMPLETE' : 'PENDING';

      dispatch({
        type: 'COMPLETE_TENANT_PROFILE',
        payload: nextTenant,
      });
    },

    activateTenancy(input) {
      const tenancy = state.tenancies.find((record) => record.id === input.tenancyId);
      if (!tenancy || tenancy.status !== TENANCY_STATUS.INVITED) {
        throw new Error('Only invited tenancies can be activated.');
      }

      const tenant = state.tenants.find((record) => record.id === tenancy.tenantId);
      if (!isTenantProfileComplete(tenant)) {
        throw new Error('The tenant must complete the profile before contract activation.');
      }

      const conflictingTenancy = state.tenancies.find(
        (record) =>
          record.roomId === tenancy.roomId &&
          record.id !== tenancy.id &&
          [TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED].includes(record.status),
      );

      if (conflictingTenancy) {
        throw new Error('This room already has another active tenancy.');
      }

      const { contract, tenancyPatch } = buildContractRecord({
        tenancyId: tenancy.id,
        contractInput: input,
      });

      dispatch({
        type: 'ACTIVATE_TENANCY',
        payload: {
          contract,
          tenancy: {
            ...tenancy,
            ...tenancyPatch,
          },
        },
      });
    },

    generateInvoice(input) {
      const tenancy = state.tenancies.find((record) => record.id === input.tenancyId);
      if (!tenancy) {
        throw new Error('Select an active tenancy before generating an invoice.');
      }

      if (![TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED].includes(tenancy.status)) {
        throw new Error('Only active or moving-out tenancies can be billed.');
      }

      if (state.invoices.some((invoice) => invoice.tenancyId === tenancy.id && invoice.month === input.month)) {
        throw new Error('An invoice for that tenancy and month already exists.');
      }

      const room = state.rooms.find((record) => record.id === tenancy.roomId);
      const bundle = createInvoiceForTenancy({
        tenancy,
        room,
        settlementAccount: state.settlementAccount,
        month: input.month || toMonthKey(state.referenceDate),
        openingReading: input.openingReading,
        closingReading: input.closingReading,
        tariff: input.tariff || state.property.defaultTariff,
        referenceDate: state.referenceDate,
      });

      dispatch({
        type: 'GENERATE_INVOICE',
        payload: bundle,
      });
    },

    submitPayment(input) {
      const invoice = state.invoices.find((record) => record.id === input.invoiceId);
      if (!invoice) {
        throw new Error('Choose an invoice before submitting a payment proof.');
      }

      if (!input.utr || !input.screenshotLabel) {
        throw new Error('UTR/reference and proof label are required.');
      }

      const submission = {
        id: makeId('submission'),
        invoiceId: invoice.id,
        tenantId: invoice.tenantId,
        status: PAYMENT_SUBMISSION_STATUS.PENDING_REVIEW,
        utr: input.utr,
        screenshotLabel: input.screenshotLabel,
        note: input.note || '',
        submittedAt: state.referenceDate,
        reviewedAt: null,
      };

      dispatch({
        type: 'SUBMIT_PAYMENT',
        payload: {
          submission,
          invoice: {
            ...invoice,
            status: INVOICE_STATUS.PAYMENT_SUBMITTED,
            paymentSubmissionId: submission.id,
          },
        },
      });
    },

    reviewPayment(input) {
      const submission = state.paymentSubmissions.find((record) => record.id === input.submissionId);
      if (!submission || submission.status !== PAYMENT_SUBMISSION_STATUS.PENDING_REVIEW) {
        throw new Error('Pick a payment submission that is still waiting for review.');
      }

      const invoice = state.invoices.find((record) => record.id === submission.invoiceId);
      const approved = input.decision === 'APPROVE';

      dispatch({
        type: 'REVIEW_PAYMENT',
        payload: {
          submission: {
            ...submission,
            status: approved
              ? PAYMENT_SUBMISSION_STATUS.APPROVED
              : PAYMENT_SUBMISSION_STATUS.REJECTED,
            reviewerNote: input.reviewerNote || '',
            reviewedAt: state.referenceDate,
          },
          invoice: {
            ...invoice,
            status: approved
              ? INVOICE_STATUS.PAID
              : deriveInvoiceStatus({ ...invoice, status: INVOICE_STATUS.ISSUED }, state.referenceDate),
            paidAt: approved ? state.referenceDate : null,
          },
        },
      });
    },

    updateReminderStatus(reminderId, deliveryStatus) {
      const reminder = state.reminders.find((record) => record.id === reminderId);
      if (!reminder) {
        throw new Error('Reminder not found.');
      }

      dispatch({
        type: 'UPDATE_REMINDER_STATUS',
        payload: {
          ...reminder,
          deliveryStatus,
          lastAttemptAt: state.referenceDate,
        },
      });
    },

    scheduleMoveOut({ tenancyId, moveOutDate }) {
      const tenancy = state.tenancies.find((record) => record.id === tenancyId);
      if (!tenancy || tenancy.status !== TENANCY_STATUS.ACTIVE) {
        throw new Error('Only active tenancies can be moved out.');
      }

      dispatch({
        type: 'SCHEDULE_MOVE_OUT',
        payload: {
          tenancy: {
            ...tenancy,
            status: TENANCY_STATUS.MOVE_OUT_SCHEDULED,
            moveOutDate,
          },
        },
      });
    },

    closeTenancy(tenancyId) {
      const tenancy = state.tenancies.find((record) => record.id === tenancyId);
      if (!tenancy || tenancy.status !== TENANCY_STATUS.MOVE_OUT_SCHEDULED) {
        throw new Error('Schedule a move-out before closing the tenancy.');
      }

      const hasOpenInvoice = state.invoices.some(
        (invoice) =>
          invoice.tenancyId === tenancy.id &&
          deriveInvoiceStatus(invoice, state.referenceDate) !== INVOICE_STATUS.PAID,
      );

      if (hasOpenInvoice) {
        throw new Error('Collect or review the latest invoice before closing this tenancy.');
      }

      dispatch({
        type: 'CLOSE_TENANCY',
        payload: {
          tenancy: {
            ...tenancy,
            status: TENANCY_STATUS.CLOSED,
          },
        },
      });
    },
  };

  return { state, actions };
}
