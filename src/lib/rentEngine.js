const {
  clampDueDay,
  compareIsoDates,
  getDaysInMonth,
  getTodayIso,
  pad,
  shiftIsoDate,
} = require('./dateUtils');

const ROOM_STATUS = {
  VACANT: 'VACANT',
  OCCUPIED: 'OCCUPIED',
  NOTICE: 'NOTICE',
};

const TENANCY_STATUS = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  MOVE_OUT_SCHEDULED: 'MOVE_OUT_SCHEDULED',
  CLOSED: 'CLOSED',
};

const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  DUE: 'DUE',
  OVERDUE: 'OVERDUE',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAID: 'PAID',
};

const PAYMENT_SUBMISSION_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

let idCounter = 0;

function makeId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function calculateElectricityCharge(openingReading, closingReading, tariff) {
  const opening = Number(openingReading);
  const closing = Number(closingReading);
  const rate = Number(tariff);

  if (!Number.isFinite(opening) || !Number.isFinite(closing) || !Number.isFinite(rate)) {
    throw new Error('Meter readings and tariff must be valid numbers.');
  }

  if (closing < opening) {
    throw new Error('Closing reading cannot be lower than opening reading.');
  }

  return Number(((closing - opening) * rate).toFixed(2));
}

function buildUpiLink({ upiId, payeeName, amount, note }) {
  const search = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: String(Number(amount).toFixed(2)),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${search.toString()}`;
}

function isTenantProfileComplete(tenant) {
  return Boolean(
    tenant?.fullName &&
      tenant?.email &&
      tenant?.emergencyContact &&
      tenant?.idDocument,
  );
}

function deriveInvoiceStatus(invoice, referenceDate = getTodayIso()) {
  if (invoice.status === INVOICE_STATUS.PAID || invoice.status === INVOICE_STATUS.PAYMENT_SUBMITTED) {
    return invoice.status;
  }

  return compareIsoDates(referenceDate, invoice.dueDate) > 0
    ? INVOICE_STATUS.OVERDUE
    : INVOICE_STATUS.DUE;
}

function buildReminderSchedule(invoice, referenceDate = getTodayIso()) {
  const cadence = [
    { offset: -3, label: 'Upcoming due', kind: 'UPCOMING' },
    { offset: 0, label: 'Due today', kind: 'DUE_TODAY' },
    { offset: 3, label: 'Overdue follow-up', kind: 'OVERDUE_FOLLOW_UP' },
  ];

  return cadence.flatMap((step) =>
    ['IN_APP', 'WHATSAPP'].map((channel) => {
      const triggerDate = shiftIsoDate(invoice.dueDate, step.offset);
      return {
        id: makeId('reminder'),
        propertyId: invoice.propertyId,
        invoiceId: invoice.id,
        tenantId: invoice.tenantId,
        channel,
        kind: step.kind,
        title: `${step.label} reminder`,
        triggerDate,
        deliveryStatus: compareIsoDates(referenceDate, triggerDate) >= 0 ? 'READY' : 'SCHEDULED',
        lastAttemptAt: null,
        note:
          channel === 'WHATSAPP'
            ? 'WhatsApp template queued for dispatch.'
            : 'In-app reminder will surface in the tenant portal.',
      };
    }),
  );
}

function createInvoiceForTenancy({
  tenancy,
  room,
  settlementAccount,
  month,
  openingReading,
  closingReading,
  tariff,
  referenceDate = getTodayIso(),
}) {
  if (
    !tenancy ||
    ![TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED].includes(tenancy.status)
  ) {
    throw new Error('Only active or moving-out tenancies can be billed.');
  }

  const charge = calculateElectricityCharge(openingReading, closingReading, tariff);
  const dueDay = clampDueDay(month, tenancy.dueDay);
  const billingPeriodEnd = `${month}-${pad(getDaysInMonth(month))}`;
  const dueDate = `${month}-${pad(dueDay)}`;
  const totalAmount = Number(tenancy.rentAmount) + charge;

  const invoice = {
    id: makeId('invoice'),
    propertyId: tenancy.propertyId,
    tenancyId: tenancy.id,
    tenantId: tenancy.tenantId,
    roomId: tenancy.roomId,
    month,
    billingPeriodStart: `${month}-01`,
    billingPeriodEnd,
    dueDate,
    status: INVOICE_STATUS.ISSUED,
    baseRent: Number(tenancy.rentAmount),
    electricityCharge: charge,
    totalAmount,
    lineItems: [
      {
        id: makeId('line'),
        type: 'BASE_RENT',
        label: `Room ${room.label} monthly rent`,
        amount: Number(tenancy.rentAmount),
      },
      {
        id: makeId('line'),
        type: 'ELECTRICITY',
        label: `Electricity ${closingReading - openingReading} units @ ${tariff}/unit`,
        amount: charge,
      },
    ],
    readingSnapshot: {
      openingReading: Number(openingReading),
      closingReading: Number(closingReading),
      tariff: Number(tariff),
    },
    settlementSnapshot: {
      upiId: settlementAccount.upiId,
      payeeName: settlementAccount.payeeName,
    },
    paymentLink: buildUpiLink({
      upiId: settlementAccount.upiId,
      payeeName: settlementAccount.payeeName,
      amount: totalAmount,
      note: `Rent ${room.label} ${month}`,
    }),
    generatedAt: referenceDate,
  };

  const meterReading = {
    id: makeId('reading'),
    propertyId: tenancy.propertyId,
    roomId: room.id,
    meterId: room.meterId,
    month,
    openingReading: Number(openingReading),
    closingReading: Number(closingReading),
    tariff: Number(tariff),
    capturedAt: referenceDate,
  };

  return {
    invoice,
    meterReading,
    reminders: buildReminderSchedule(invoice, referenceDate),
  };
}

function buildContractRecord({ tenancyId, contractInput }) {
  const requiredFields = [
    'fileName',
    'rentAmount',
    'depositAmount',
    'dueDay',
    'moveInDate',
    'contractStart',
    'contractEnd',
  ];

  const missingField = requiredFields.find((field) => !contractInput[field]);
  if (missingField) {
    throw new Error(`Missing contract field: ${missingField}`);
  }

  const contract = {
    id: makeId('contract'),
    tenancyId,
    fileName: contractInput.fileName,
    rentAmount: Number(contractInput.rentAmount),
    depositAmount: Number(contractInput.depositAmount),
    dueDay: Number(contractInput.dueDay),
    moveInDate: contractInput.moveInDate,
    contractStart: contractInput.contractStart,
    contractEnd: contractInput.contractEnd,
    createdAt: getTodayIso(),
  };

  return {
    contract,
    tenancyPatch: {
      status: TENANCY_STATUS.ACTIVE,
      contractId: contract.id,
      rentAmount: contract.rentAmount,
      depositAmount: contract.depositAmount,
      dueDay: contract.dueDay,
      moveInDate: contract.moveInDate,
      contractStart: contract.contractStart,
      contractEnd: contract.contractEnd,
      moveOutDate: null,
    },
  };
}

function createTenantInvite({ propertyId, roomId, fullName, phone }) {
  return {
    tenant: {
      id: makeId('tenant'),
      phone,
      fullName,
      email: '',
      emergencyContact: '',
      idDocument: '',
      notes: '',
      profileStatus: 'PENDING',
    },
    tenancy: {
      id: makeId('tenancy'),
      propertyId,
      roomId,
      tenantId: null,
      status: TENANCY_STATUS.INVITED,
      contractId: null,
      rentAmount: null,
      depositAmount: null,
      dueDay: null,
      moveInDate: null,
      contractStart: null,
      contractEnd: null,
      moveOutDate: null,
    },
  };
}

function cancelInvoiceReminders(reminders, invoiceId) {
  return reminders.map((reminder) =>
    reminder.invoiceId === invoiceId
      ? {
          ...reminder,
          deliveryStatus: 'CANCELED',
          lastAttemptAt: getTodayIso(),
        }
      : reminder,
  );
}

module.exports = {
  INVOICE_STATUS,
  PAYMENT_SUBMISSION_STATUS,
  ROOM_STATUS,
  TENANCY_STATUS,
  buildContractRecord,
  buildReminderSchedule,
  buildUpiLink,
  calculateElectricityCharge,
  cancelInvoiceReminders,
  createInvoiceForTenancy,
  createTenantInvite,
  deriveInvoiceStatus,
  isTenantProfileComplete,
  makeId,
};
