const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { INVOICE_STATUS, ROOM_STATUS, TENANCY_STATUS } = require('../src/lib/rentEngine');
const { createRentBackend } = require('../server/service');

function createTempDbPath() {
  return path.join(
    os.tmpdir(),
    `rent-automation-backend-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`,
  );
}

function cleanupDatabaseFiles(filename) {
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${filename}${suffix}`, { force: true });
  }
}

test('backend bootstrap returns the seeded owner dashboard state', () => {
  const filename = createTempDbPath();
  const backend = createRentBackend({ filename });

  try {
    const state = backend.bootstrap({ role: 'owner', phone: '9000000000' });

    assert.equal(state.session.role, 'owner');
    assert.equal(state.property.name, 'Lotus Ladies PG');
    assert.ok(state.rooms.length >= 3);
    assert.ok(state.invoices.length >= 2);
  } finally {
    backend.close();
    cleanupDatabaseFiles(filename);
  }
});

test('backend persists invite, activation, invoice generation, and payment approval', () => {
  const filename = createTempDbPath();
  let backend = createRentBackend({ filename });

  try {
    let state = backend.inviteTenant({
      fullName: 'Neha Singh',
      phone: '9000000003',
      roomId: 'room-303',
    });

    const invitedTenant = state.tenants.find((tenant) => tenant.phone === '9000000003');
    const invitedTenancy = state.tenancies.find((tenancy) => tenancy.tenantId === invitedTenant.id);
    assert.equal(state.rooms.find((room) => room.id === 'room-303').status, ROOM_STATUS.NOTICE);
    assert.equal(invitedTenancy.status, TENANCY_STATUS.INVITED);

    state = backend.completeTenantProfile(invitedTenant.id, {
      fullName: 'Neha Singh',
      email: 'neha@example.com',
      emergencyContact: '9111111111',
      idDocument: 'AADHAR-0099',
      notes: 'Prefers auto reminders.',
    });

    state = backend.activateTenancy(invitedTenancy.id, {
      fileName: 'neha-singh-contract.pdf',
      rentAmount: 13000,
      depositAmount: 26000,
      dueDay: 10,
      moveInDate: '2026-04-10',
      contractStart: '2026-04-10',
      contractEnd: '2027-04-09',
    });

    assert.equal(
      state.tenancies.find((tenancy) => tenancy.id === invitedTenancy.id).status,
      TENANCY_STATUS.ACTIVE,
    );
    assert.equal(state.rooms.find((room) => room.id === 'room-303').status, ROOM_STATUS.OCCUPIED);

    state = backend.generateInvoice({
      tenancyId: invitedTenancy.id,
      month: '2026-04',
      openingReading: 144,
      closingReading: 158,
      tariff: 8.5,
    });

    const generatedInvoice = state.invoices.find((invoice) => invoice.tenancyId === invitedTenancy.id);
    assert.ok(generatedInvoice);
    assert.equal(generatedInvoice.totalAmount, 13119);

    state = backend.submitPayment({
      invoiceId: generatedInvoice.id,
      utr: 'UTR-APRIL-999',
      screenshotLabel: 'proof-april.png',
      note: 'Paid from ICICI.',
    });

    const submission = state.paymentSubmissions.find(
      (paymentSubmission) => paymentSubmission.invoiceId === generatedInvoice.id,
    );
    assert.ok(submission);

    state = backend.reviewPayment({
      submissionId: submission.id,
      decision: 'APPROVE',
      reviewerNote: 'Received successfully.',
    });

    assert.equal(
      state.invoices.find((invoice) => invoice.id === generatedInvoice.id).status,
      INVOICE_STATUS.PAID,
    );
    assert.ok(
      state.reminders
        .filter((reminder) => reminder.invoiceId === generatedInvoice.id)
        .every((reminder) => reminder.deliveryStatus === 'CANCELED'),
    );

    backend.close();
    backend = createRentBackend({ filename });
    state = backend.getState();

    assert.equal(
      state.roomMeters.find((meter) => meter.roomId === 'room-303').lastReading,
      158,
    );
    assert.equal(
      state.invoices.find((invoice) => invoice.id === generatedInvoice.id).status,
      INVOICE_STATUS.PAID,
    );
  } finally {
    backend.close();
    cleanupDatabaseFiles(filename);
  }
});
