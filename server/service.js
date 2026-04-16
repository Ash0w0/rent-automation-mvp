const { getTodayIso } = require('../src/lib/dateUtils');
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
} = require('../src/lib/rentEngine');
const { createDatabase, withTransaction } = require('./db');

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value);
}

function toSession(role, phone, state) {
  if (role === 'owner') {
    return {
      role: 'owner',
      phone,
      currentTenantId: null,
      currentOwnerId: state.owner.id,
    };
  }

  const tenant = state.tenants.find((record) => record.phone === phone);
  return {
    role: 'tenant',
    phone,
    currentTenantId: tenant.id,
    currentOwnerId: null,
  };
}

function listRows(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

function getRow(db, sql, params = []) {
  return db.prepare(sql).get(...params);
}

function requireRow(db, sql, params, message) {
  const row = getRow(db, sql, params);
  if (!row) {
    throw new Error(message);
  }

  return row;
}

function updateInvoiceStatuses(db, referenceDate) {
  const rows = listRows(
    db,
    'SELECT id, dueDate, status FROM invoices ORDER BY generatedAt DESC, id DESC',
  );
  const updateStatement = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');

  for (const row of rows) {
    const nextStatus = deriveInvoiceStatus(row, referenceDate);
    if (nextStatus !== row.status) {
      updateStatement.run(nextStatus, row.id);
    }
  }
}

function recordAudit(db, title, detail, referenceDate = getTodayIso()) {
  db.prepare(
    'INSERT INTO audit_trail (id, title, detail, createdAt) VALUES (?, ?, ?, ?)',
  ).run(makeId('audit'), title, detail, referenceDate);
}

function getState(db, session = null) {
  const referenceDate = getTodayIso();
  updateInvoiceStatuses(db, referenceDate);

  return {
    referenceDate,
    session: session || {
      role: null,
      phone: '',
      currentTenantId: null,
      currentOwnerId: null,
    },
    owner: getRow(db, 'SELECT * FROM owners LIMIT 1'),
    property: getRow(db, 'SELECT * FROM properties LIMIT 1'),
    settlementAccount: getRow(db, 'SELECT * FROM settlement_accounts LIMIT 1'),
    rooms: listRows(db, 'SELECT * FROM rooms ORDER BY label ASC'),
    roomMeters: listRows(db, 'SELECT * FROM room_meters ORDER BY roomId ASC'),
    tenants: listRows(db, 'SELECT * FROM tenants ORDER BY fullName ASC'),
    tenancies: listRows(db, 'SELECT * FROM tenancies ORDER BY id ASC'),
    contracts: listRows(db, 'SELECT * FROM contracts ORDER BY createdAt ASC'),
    invoices: listRows(
      db,
      'SELECT * FROM invoices ORDER BY month DESC, generatedAt DESC, id DESC',
    ).map((row) => ({
      ...row,
      lineItems: parseJson(row.lineItems, []),
      readingSnapshot: parseJson(row.readingSnapshot, {}),
      settlementSnapshot: parseJson(row.settlementSnapshot, {}),
    })),
    meterReadings: listRows(
      db,
      'SELECT * FROM meter_readings ORDER BY month DESC, capturedAt DESC, id DESC',
    ),
    paymentSubmissions: listRows(
      db,
      'SELECT * FROM payment_submissions ORDER BY submittedAt DESC, id DESC',
    ),
    reminders: listRows(
      db,
      'SELECT * FROM reminders ORDER BY triggerDate ASC, channel ASC, id ASC',
    ),
    auditTrail: listRows(
      db,
      'SELECT id, title, detail FROM audit_trail ORDER BY createdAt DESC, id DESC',
    ),
  };
}

function createRentBackend(options = {}) {
  const db = createDatabase(options);

  return {
    db,

    close() {
      db.close();
    },

    getState(session = null) {
      return getState(db, session);
    },

    bootstrap({ role, phone }) {
      const normalizedPhone = String(phone || '').trim();
      const state = getState(db);

      if (role === 'owner') {
        if (normalizedPhone !== state.owner.phone) {
          throw new Error('Use owner demo login 9000000000 for the admin portal.');
        }

        return getState(db, toSession('owner', normalizedPhone, state));
      }

      const tenant = state.tenants.find((record) => record.phone === normalizedPhone);
      if (!tenant) {
        throw new Error('This tenant phone number is not invited yet.');
      }

      return getState(db, toSession('tenant', normalizedPhone, state));
    },

    updateProperty(payload) {
      const property = requireRow(db, 'SELECT * FROM properties LIMIT 1', [], 'Property not found.');
      const nextProperty = { ...property, ...payload };

      db.prepare(
        `
          UPDATE properties
          SET name = ?, address = ?, defaultTariff = ?, managerName = ?, managerPhone = ?
          WHERE id = ?
        `,
      ).run(
        nextProperty.name,
        nextProperty.address,
        Number(nextProperty.defaultTariff),
        nextProperty.managerName,
        nextProperty.managerPhone,
        property.id,
      );

      recordAudit(db, 'Property updated', `Updated property details for ${nextProperty.name}.`);
      return getState(db);
    },

    updateSettlement(payload) {
      const settlement = requireRow(
        db,
        'SELECT * FROM settlement_accounts LIMIT 1',
        [],
        'Settlement account not found.',
      );
      const nextSettlement = { ...settlement, ...payload };

      db.prepare(
        `
          UPDATE settlement_accounts
          SET payeeName = ?, upiId = ?, instructions = ?
          WHERE id = ?
        `,
      ).run(
        nextSettlement.payeeName,
        nextSettlement.upiId,
        nextSettlement.instructions,
        settlement.id,
      );

      recordAudit(db, 'Settlement updated', 'Updated owner UPI settlement details.');
      return getState(db);
    },

    addRoom(input) {
      const property = requireRow(db, 'SELECT * FROM properties LIMIT 1', [], 'Property not found.');

      if (!input.label || !input.floor || !input.serialNumber) {
        throw new Error('Room label, floor, and meter serial number are required.');
      }

      if (getRow(db, 'SELECT id FROM rooms WHERE label = ?', [input.label])) {
        throw new Error('A room with this label already exists.');
      }

      return withTransaction(db, () => {
        const roomId = makeId('room');
        const meterId = makeId('meter');

        db.prepare(
          'INSERT INTO rooms (id, propertyId, label, floor, meterId, status) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(roomId, property.id, input.label, input.floor, meterId, ROOM_STATUS.VACANT);

        db.prepare(
          'INSERT INTO room_meters (id, propertyId, roomId, serialNumber, lastReading) VALUES (?, ?, ?, ?, ?)',
        ).run(meterId, property.id, roomId, input.serialNumber, Number(input.openingReading || 0));

        recordAudit(db, 'Room added', `Room ${input.label} was added to the inventory.`);
        return getState(db);
      });
    },

    inviteTenant(input) {
      if (!input.fullName || !input.phone || !input.roomId) {
        throw new Error('Tenant name, phone, and room selection are required.');
      }

      const room = requireRow(db, 'SELECT * FROM rooms WHERE id = ?', [input.roomId], 'Room not found.');
      if (room.status !== ROOM_STATUS.VACANT) {
        throw new Error('Only vacant rooms can be assigned to a new tenant invite.');
      }

      if (getRow(db, 'SELECT id FROM tenants WHERE phone = ?', [input.phone])) {
        throw new Error('That phone number is already associated with another tenant.');
      }

      return withTransaction(db, () => {
        const property = requireRow(db, 'SELECT * FROM properties LIMIT 1', [], 'Property not found.');
        const { tenant, tenancy } = createTenantInvite({
          propertyId: property.id,
          roomId: input.roomId,
          fullName: input.fullName,
          phone: input.phone,
        });

        db.prepare(
          `
            INSERT INTO tenants
            (id, phone, fullName, email, emergencyContact, idDocument, notes, profileStatus)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          tenant.id,
          tenant.phone,
          tenant.fullName,
          tenant.email,
          tenant.emergencyContact,
          tenant.idDocument,
          tenant.notes,
          tenant.profileStatus,
        );

        db.prepare(
          `
            INSERT INTO tenancies
            (id, propertyId, roomId, tenantId, status, contractId, rentAmount, depositAmount, dueDay, moveInDate, contractStart, contractEnd, moveOutDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          tenancy.id,
          tenancy.propertyId,
          tenancy.roomId,
          tenant.id,
          tenancy.status,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        );

        db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(ROOM_STATUS.NOTICE, room.id);
        recordAudit(db, 'Tenant invited', `${input.fullName} was invited to room ${room.label}.`);
        return getState(db);
      });
    },

    completeTenantProfile(tenantId, input) {
      const tenant = requireRow(db, 'SELECT * FROM tenants WHERE id = ?', [tenantId], 'Unable to find the tenant profile.');
      const nextTenant = { ...tenant, ...input };
      nextTenant.profileStatus = isTenantProfileComplete(nextTenant) ? 'COMPLETE' : 'PENDING';

      db.prepare(
        `
          UPDATE tenants
          SET fullName = ?, email = ?, emergencyContact = ?, idDocument = ?, notes = ?, profileStatus = ?
          WHERE id = ?
        `,
      ).run(
        nextTenant.fullName,
        nextTenant.email,
        nextTenant.emergencyContact,
        nextTenant.idDocument,
        nextTenant.notes,
        nextTenant.profileStatus,
        tenantId,
      );

      recordAudit(db, 'Tenant profile updated', `Profile details were saved for ${nextTenant.fullName}.`);
      return getState(db);
    },

    activateTenancy(tenancyId, contractInput) {
      const tenancy = requireRow(db, 'SELECT * FROM tenancies WHERE id = ?', [tenancyId], 'Tenancy not found.');
      if (tenancy.status !== TENANCY_STATUS.INVITED) {
        throw new Error('Only invited tenancies can be activated.');
      }

      const tenant = requireRow(db, 'SELECT * FROM tenants WHERE id = ?', [tenancy.tenantId], 'Unable to find the tenant profile.');
      if (!isTenantProfileComplete(tenant)) {
        throw new Error('The tenant must complete the profile before contract activation.');
      }

      const conflict = getRow(
        db,
        `
          SELECT id
          FROM tenancies
          WHERE roomId = ?
            AND id <> ?
            AND status IN (?, ?)
          LIMIT 1
        `,
        [tenancy.roomId, tenancy.id, TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED],
      );

      if (conflict) {
        throw new Error('This room already has another active tenancy.');
      }

      return withTransaction(db, () => {
        const { contract, tenancyPatch } = buildContractRecord({
          tenancyId,
          contractInput,
        });

        db.prepare(
          `
            INSERT INTO contracts
            (id, tenancyId, fileName, rentAmount, depositAmount, dueDay, moveInDate, contractStart, contractEnd, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          contract.id,
          contract.tenancyId,
          contract.fileName,
          contract.rentAmount,
          contract.depositAmount,
          contract.dueDay,
          contract.moveInDate,
          contract.contractStart,
          contract.contractEnd,
          contract.createdAt,
        );

        db.prepare(
          `
            UPDATE tenancies
            SET status = ?, contractId = ?, rentAmount = ?, depositAmount = ?, dueDay = ?, moveInDate = ?, contractStart = ?, contractEnd = ?, moveOutDate = ?
            WHERE id = ?
          `,
        ).run(
          tenancyPatch.status,
          contract.id,
          tenancyPatch.rentAmount,
          tenancyPatch.depositAmount,
          tenancyPatch.dueDay,
          tenancyPatch.moveInDate,
          tenancyPatch.contractStart,
          tenancyPatch.contractEnd,
          null,
          tenancyId,
        );

        db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(ROOM_STATUS.OCCUPIED, tenancy.roomId);
        recordAudit(db, 'Tenancy activated', `Contract ${contract.fileName} was attached and activated.`);
        return getState(db);
      });
    },

    generateInvoice(input) {
      const tenancy = requireRow(
        db,
        'SELECT * FROM tenancies WHERE id = ?',
        [input.tenancyId],
        'Select an active tenancy before generating an invoice.',
      );

      if (![TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED].includes(tenancy.status)) {
        throw new Error('Only active or moving-out tenancies can be billed.');
      }

      if (!input.month) {
        throw new Error('Billing month is required.');
      }

      if (getRow(db, 'SELECT id FROM invoices WHERE tenancyId = ? AND month = ?', [tenancy.id, input.month])) {
        throw new Error('An invoice for that tenancy and month already exists.');
      }

      return withTransaction(db, () => {
        const property = requireRow(db, 'SELECT * FROM properties LIMIT 1', [], 'Property not found.');
        const room = requireRow(db, 'SELECT * FROM rooms WHERE id = ?', [tenancy.roomId], 'Room not found.');
        const settlementAccount = requireRow(
          db,
          'SELECT * FROM settlement_accounts LIMIT 1',
          [],
          'Settlement account not found.',
        );
        const meter = requireRow(
          db,
          'SELECT * FROM room_meters WHERE roomId = ?',
          [room.id],
          'Room meter not found.',
        );

        const bundle = createInvoiceForTenancy({
          tenancy,
          room,
          settlementAccount,
          month: input.month,
          openingReading: input.openingReading,
          closingReading: input.closingReading,
          tariff: input.tariff || property.defaultTariff,
          referenceDate: getTodayIso(),
        });

        db.prepare(
          `
            INSERT INTO invoices
            (id, propertyId, tenancyId, tenantId, roomId, month, billingPeriodStart, billingPeriodEnd, dueDate, status, baseRent, electricityCharge, totalAmount, lineItems, readingSnapshot, settlementSnapshot, paymentLink, generatedAt, paymentSubmissionId, paidAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          bundle.invoice.id,
          bundle.invoice.propertyId,
          bundle.invoice.tenancyId,
          bundle.invoice.tenantId,
          bundle.invoice.roomId,
          bundle.invoice.month,
          bundle.invoice.billingPeriodStart,
          bundle.invoice.billingPeriodEnd,
          bundle.invoice.dueDate,
          bundle.invoice.status,
          bundle.invoice.baseRent,
          bundle.invoice.electricityCharge,
          bundle.invoice.totalAmount,
          JSON.stringify(bundle.invoice.lineItems),
          JSON.stringify(bundle.invoice.readingSnapshot),
          JSON.stringify(bundle.invoice.settlementSnapshot),
          bundle.invoice.paymentLink,
          bundle.invoice.generatedAt,
          null,
          null,
        );

        db.prepare(
          `
            INSERT INTO meter_readings
            (id, propertyId, roomId, meterId, month, openingReading, closingReading, tariff, capturedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          bundle.meterReading.id,
          bundle.meterReading.propertyId,
          bundle.meterReading.roomId,
          bundle.meterReading.meterId,
          bundle.meterReading.month,
          bundle.meterReading.openingReading,
          bundle.meterReading.closingReading,
          bundle.meterReading.tariff,
          bundle.meterReading.capturedAt,
        );

        const reminderStatement = db.prepare(
          `
            INSERT INTO reminders
            (id, propertyId, invoiceId, tenantId, channel, kind, title, triggerDate, deliveryStatus, lastAttemptAt, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        );

        for (const reminder of bundle.reminders) {
          reminderStatement.run(
            reminder.id,
            reminder.propertyId,
            reminder.invoiceId,
            reminder.tenantId,
            reminder.channel,
            reminder.kind,
            reminder.title,
            reminder.triggerDate,
            reminder.deliveryStatus,
            reminder.lastAttemptAt || null,
            reminder.note,
          );
        }

        db.prepare('UPDATE room_meters SET lastReading = ? WHERE id = ?').run(
          bundle.meterReading.closingReading,
          meter.id,
        );

        recordAudit(db, 'Invoice generated', `Invoice ${bundle.invoice.month} was generated for room ${room.label}.`);
        return getState(db);
      });
    },

    submitPayment(input) {
      const invoice = requireRow(
        db,
        'SELECT * FROM invoices WHERE id = ?',
        [input.invoiceId],
        'Choose an invoice before submitting a payment proof.',
      );

      if (!input.utr || !input.screenshotLabel) {
        throw new Error('UTR/reference and proof label are required.');
      }

      return withTransaction(db, () => {
        const submissionId = makeId('submission');
        db.prepare(
          `
            INSERT INTO payment_submissions
            (id, invoiceId, tenantId, status, utr, screenshotLabel, note, submittedAt, reviewedAt, reviewerNote)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          submissionId,
          invoice.id,
          invoice.tenantId,
          PAYMENT_SUBMISSION_STATUS.PENDING_REVIEW,
          input.utr,
          input.screenshotLabel,
          input.note || '',
          getTodayIso(),
          null,
          '',
        );

        db.prepare(
          'UPDATE invoices SET status = ?, paymentSubmissionId = ?, paidAt = NULL WHERE id = ?',
        ).run(INVOICE_STATUS.PAYMENT_SUBMITTED, submissionId, invoice.id);

        recordAudit(db, 'Payment submitted', `Payment proof was submitted for invoice ${invoice.month}.`);
        return getState(db);
      });
    },

    reviewPayment(input) {
      const submission = requireRow(
        db,
        'SELECT * FROM payment_submissions WHERE id = ?',
        [input.submissionId],
        'Pick a payment submission that is still waiting for review.',
      );

      if (submission.status !== PAYMENT_SUBMISSION_STATUS.PENDING_REVIEW) {
        throw new Error('Pick a payment submission that is still waiting for review.');
      }

      const invoice = requireRow(db, 'SELECT * FROM invoices WHERE id = ?', [submission.invoiceId], 'Invoice not found.');
      const approved = input.decision === 'APPROVE';

      return withTransaction(db, () => {
        const reviewedAt = getTodayIso();
        db.prepare(
          `
            UPDATE payment_submissions
            SET status = ?, reviewedAt = ?, reviewerNote = ?
            WHERE id = ?
          `,
        ).run(
          approved ? PAYMENT_SUBMISSION_STATUS.APPROVED : PAYMENT_SUBMISSION_STATUS.REJECTED,
          reviewedAt,
          input.reviewerNote || '',
          submission.id,
        );

        const nextStatus = approved
          ? INVOICE_STATUS.PAID
          : deriveInvoiceStatus({ ...invoice, status: INVOICE_STATUS.ISSUED }, reviewedAt);

        db.prepare('UPDATE invoices SET status = ?, paidAt = ? WHERE id = ?').run(
          nextStatus,
          approved ? reviewedAt : null,
          invoice.id,
        );

        if (approved) {
          const canceledReminders = cancelInvoiceReminders(
            listRows(db, 'SELECT * FROM reminders WHERE invoiceId = ?', [invoice.id]),
            invoice.id,
          );
          const reminderStatement = db.prepare(
            'UPDATE reminders SET deliveryStatus = ?, lastAttemptAt = ? WHERE id = ?',
          );

          for (const reminder of canceledReminders) {
            reminderStatement.run(reminder.deliveryStatus, reminder.lastAttemptAt, reminder.id);
          }
        }

        recordAudit(
          db,
          approved ? 'Payment approved' : 'Payment rejected',
          `Submission ${submission.id} for invoice ${invoice.month} was ${approved ? 'approved' : 'rejected'}.`,
        );
        return getState(db);
      });
    },

    updateReminderStatus(reminderId, deliveryStatus) {
      const reminder = requireRow(db, 'SELECT * FROM reminders WHERE id = ?', [reminderId], 'Reminder not found.');
      db.prepare('UPDATE reminders SET deliveryStatus = ?, lastAttemptAt = ? WHERE id = ?').run(
        deliveryStatus,
        getTodayIso(),
        reminder.id,
      );
      return getState(db);
    },

    scheduleMoveOut(tenancyId, moveOutDate) {
      const tenancy = requireRow(db, 'SELECT * FROM tenancies WHERE id = ?', [tenancyId], 'Tenancy not found.');
      if (tenancy.status !== TENANCY_STATUS.ACTIVE) {
        throw new Error('Only active tenancies can be moved out.');
      }

      return withTransaction(db, () => {
        db.prepare('UPDATE tenancies SET status = ?, moveOutDate = ? WHERE id = ?').run(
          TENANCY_STATUS.MOVE_OUT_SCHEDULED,
          moveOutDate,
          tenancy.id,
        );
        db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(ROOM_STATUS.NOTICE, tenancy.roomId);
        recordAudit(db, 'Move-out scheduled', `Tenancy ${tenancy.id} is scheduled to move out on ${moveOutDate}.`);
        return getState(db);
      });
    },

    closeTenancy(tenancyId) {
      const tenancy = requireRow(db, 'SELECT * FROM tenancies WHERE id = ?', [tenancyId], 'Tenancy not found.');
      if (tenancy.status !== TENANCY_STATUS.MOVE_OUT_SCHEDULED) {
        throw new Error('Schedule a move-out before closing the tenancy.');
      }

      const hasOpenInvoice = listRows(db, 'SELECT * FROM invoices WHERE tenancyId = ?', [tenancy.id]).some(
        (invoice) => deriveInvoiceStatus(invoice, getTodayIso()) !== INVOICE_STATUS.PAID,
      );
      if (hasOpenInvoice) {
        throw new Error('Collect or review the latest invoice before closing this tenancy.');
      }

      return withTransaction(db, () => {
        db.prepare('UPDATE tenancies SET status = ? WHERE id = ?').run(TENANCY_STATUS.CLOSED, tenancy.id);
        db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(ROOM_STATUS.VACANT, tenancy.roomId);
        recordAudit(db, 'Tenancy closed', `Tenancy ${tenancy.id} was closed and the room marked vacant.`);
        return getState(db);
      });
    },
  };
}

module.exports = {
  createRentBackend,
};
