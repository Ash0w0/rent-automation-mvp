const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INVOICE_STATUS,
  METER_READING_STATUS,
  TENANCY_STATUS,
  buildContractRecord,
  buildReminderSchedule,
  calculateElectricityCharge,
  createInvoiceForTenancy,
  createMeterReadingSubmission,
} = require('../src/lib/rentEngine');

test('calculateElectricityCharge computes usage and tariff', () => {
  assert.equal(calculateElectricityCharge(120, 155, 8.5), 297.5);
});

test('calculateElectricityCharge rejects reading rollbacks', () => {
  assert.throws(() => calculateElectricityCharge(200, 190, 8.5), /Closing reading cannot be lower/);
});

test('createInvoiceForTenancy snapshots rent, readings, and a payment link', () => {
  const tenancy = {
    id: 'tenancy-1',
    propertyId: 'property-1',
    roomId: 'room-101',
    tenantId: 'tenant-1',
    status: TENANCY_STATUS.ACTIVE,
    rentAmount: 15000,
    dueDay: 5,
  };
  const room = { id: 'room-101', label: '101', meterId: 'meter-101' };
  const settlementAccount = { upiId: 'lotusliving@oksbi', payeeName: 'Lotus Living Rentals' };

  const bundle = createInvoiceForTenancy({
    tenancy,
    room,
    settlementAccount,
    month: '2026-04',
    openingReading: 250,
    closingReading: 280,
    tariff: 8.5,
    referenceDate: '2026-04-01',
  });

  assert.equal(bundle.invoice.status, INVOICE_STATUS.ISSUED);
  assert.equal(bundle.invoice.totalAmount, 15255);
  assert.equal(bundle.invoice.readingSnapshot.closingReading, 280);
  assert.match(bundle.invoice.paymentLink, /^upi:\/\/pay\?/);
  assert.equal(bundle.reminders.length, 6);
  assert.equal(bundle.meterReading.status, METER_READING_STATUS.APPROVED);
  assert.equal(bundle.meterReading.invoiceId, bundle.invoice.id);
});

test('createMeterReadingSubmission creates a tenant approval record before billing', () => {
  const tenancy = {
    id: 'tenancy-1',
    propertyId: 'property-1',
    roomId: 'room-101',
    tenantId: 'tenant-1',
    status: TENANCY_STATUS.ACTIVE,
  };
  const room = { id: 'room-101', meterId: 'meter-101' };

  const reading = createMeterReadingSubmission({
    tenancy,
    room,
    month: '2026-04',
    openingReading: 280,
    closingReading: 296,
    tariff: 8.5,
    photoLabel: 'meter-april.jpg',
    referenceDate: '2026-04-30',
  });

  assert.equal(reading.status, METER_READING_STATUS.PENDING_REVIEW);
  assert.equal(reading.photoLabel, 'meter-april.jpg');
  assert.equal(reading.invoiceId, null);
  assert.equal(reading.capturedByRole, 'TENANT');
});

test('buildContractRecord enforces required fields', () => {
  assert.throws(
    () =>
      buildContractRecord({
        tenancyId: 'tenancy-1',
        contractInput: {
          imageLabels: [],
        },
      }),
    /Missing contract field/,
  );
});

test('buildReminderSchedule creates the fixed WhatsApp and in-app cadence', () => {
  const reminders = buildReminderSchedule(
    {
      id: 'invoice-1',
      propertyId: 'property-1',
      tenantId: 'tenant-1',
      dueDate: '2026-04-05',
    },
    '2026-04-06',
  );

  const channels = reminders.map((reminder) => reminder.channel);
  assert.equal(reminders.length, 6);
  assert.equal(channels.filter((channel) => channel === 'WHATSAPP').length, 3);
  assert.equal(channels.filter((channel) => channel === 'IN_APP').length, 3);
});
