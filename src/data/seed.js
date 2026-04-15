const { getTodayIso } = require('../lib/dateUtils');
const {
  INVOICE_STATUS,
  PAYMENT_SUBMISSION_STATUS,
  ROOM_STATUS,
  TENANCY_STATUS,
  buildReminderSchedule,
  createInvoiceForTenancy,
} = require('../lib/rentEngine');

function createSeedState() {
  const today = getTodayIso();

  const owner = {
    id: 'owner-1',
    name: 'Lotus Living',
    phone: '9000000000',
  };

  const property = {
    id: 'property-1',
    ownerId: owner.id,
    name: 'Lotus Ladies PG',
    address: 'Koramangala 5th Block, Bengaluru',
    defaultTariff: 8.5,
    managerName: 'Asha Rao',
    managerPhone: '9000000000',
  };

  const settlementAccount = {
    id: 'settlement-1',
    propertyId: property.id,
    payeeName: 'Lotus Living Rentals',
    upiId: 'lotusliving@oksbi',
    instructions: 'Use room number and month in your UPI note.',
  };

  const roomMeters = [
    {
      id: 'meter-101',
      propertyId: property.id,
      roomId: 'room-101',
      serialNumber: 'LT-101-A',
      lastReading: 320,
    },
    {
      id: 'meter-202',
      propertyId: property.id,
      roomId: 'room-202',
      serialNumber: 'LT-202-B',
      lastReading: 487,
    },
    {
      id: 'meter-303',
      propertyId: property.id,
      roomId: 'room-303',
      serialNumber: 'LT-303-C',
      lastReading: 144,
    },
  ];

  const rooms = [
    {
      id: 'room-101',
      propertyId: property.id,
      label: '101',
      floor: '1',
      meterId: 'meter-101',
      status: ROOM_STATUS.NOTICE,
    },
    {
      id: 'room-202',
      propertyId: property.id,
      label: '202',
      floor: '2',
      meterId: 'meter-202',
      status: ROOM_STATUS.OCCUPIED,
    },
    {
      id: 'room-303',
      propertyId: property.id,
      label: '303',
      floor: '3',
      meterId: 'meter-303',
      status: ROOM_STATUS.VACANT,
    },
  ];

  const tenants = [
    {
      id: 'tenant-1',
      phone: '9000000001',
      fullName: 'Arjun Mehta',
      email: 'arjun@example.com',
      emergencyContact: '9012345678',
      idDocument: 'DL-ARJUN-009',
      notes: 'Works night shifts. Prefers WhatsApp reminders.',
      profileStatus: 'COMPLETE',
    },
    {
      id: 'tenant-2',
      phone: '9000000002',
      fullName: 'Priya Nair',
      email: '',
      emergencyContact: '',
      idDocument: '',
      notes: '',
      profileStatus: 'PENDING',
    },
  ];

  const contracts = [
    {
      id: 'contract-1',
      tenancyId: 'tenancy-1',
      fileName: 'arjun-mehta-lease.pdf',
      rentAmount: 15000,
      depositAmount: 30000,
      dueDay: 5,
      moveInDate: '2026-03-01',
      contractStart: '2026-03-01',
      contractEnd: '2027-02-28',
      createdAt: '2026-03-01',
    },
  ];

  const tenancies = [
    {
      id: 'tenancy-1',
      propertyId: property.id,
      roomId: 'room-202',
      tenantId: 'tenant-1',
      status: TENANCY_STATUS.ACTIVE,
      contractId: 'contract-1',
      rentAmount: 15000,
      depositAmount: 30000,
      dueDay: 5,
      moveInDate: '2026-03-01',
      contractStart: '2026-03-01',
      contractEnd: '2027-02-28',
      moveOutDate: null,
    },
    {
      id: 'tenancy-2',
      propertyId: property.id,
      roomId: 'room-101',
      tenantId: 'tenant-2',
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
  ];

  const occupiedRoom = rooms.find((room) => room.id === 'room-202');
  const activeTenancy = tenancies.find((tenancy) => tenancy.id === 'tenancy-1');

  const marchBundle = createInvoiceForTenancy({
    tenancy: activeTenancy,
    room: occupiedRoom,
    settlementAccount,
    month: '2026-03',
    openingReading: 420,
    closingReading: 449,
    tariff: 8.5,
    referenceDate: '2026-03-01',
  });

  marchBundle.invoice.status = INVOICE_STATUS.PAID;
  marchBundle.invoice.paidAt = '2026-03-04';
  marchBundle.invoice.paymentSubmissionId = 'submission-1';

  const aprilBundle = createInvoiceForTenancy({
    tenancy: activeTenancy,
    room: occupiedRoom,
    settlementAccount,
    month: '2026-04',
    openingReading: 450,
    closingReading: 487,
    tariff: 8.5,
    referenceDate: '2026-04-01',
  });

  const paymentSubmissions = [
    {
      id: 'submission-1',
      invoiceId: marchBundle.invoice.id,
      tenantId: 'tenant-1',
      status: PAYMENT_SUBMISSION_STATUS.APPROVED,
      utr: 'UTR-20260304-009',
      screenshotLabel: 'march-payment-proof.jpg',
      note: 'Paid from HDFC UPI.',
      submittedAt: '2026-03-04',
      reviewedAt: '2026-03-04',
    },
  ];

  const reminders = buildReminderSchedule(aprilBundle.invoice, today);

  return {
    referenceDate: today,
    session: {
      role: null,
      phone: '',
      currentTenantId: null,
      currentOwnerId: null,
    },
    owner,
    property,
    settlementAccount,
    rooms,
    roomMeters,
    tenants,
    tenancies,
    contracts,
    invoices: [marchBundle.invoice, aprilBundle.invoice],
    meterReadings: [marchBundle.meterReading, aprilBundle.meterReading],
    paymentSubmissions,
    reminders,
    auditTrail: [
      {
        id: 'audit-1',
        title: 'April invoice generated',
        detail: 'Room 202 invoice issued with electricity snapshot.',
      },
      {
        id: 'audit-2',
        title: 'Priya invited',
        detail: 'Pending profile completion before contract activation.',
      },
    ],
  };
}

module.exports = { createSeedState };
