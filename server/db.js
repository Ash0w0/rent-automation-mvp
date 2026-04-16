const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { createSeedState } = require('../src/data/seed');

const DEFAULT_DB_FILE = path.join(process.cwd(), '.data', 'rent-automation.sqlite');

function ensureParentDirectory(filePath) {
  if (filePath === ':memory:') {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      defaultTariff REAL NOT NULL,
      managerName TEXT NOT NULL,
      managerPhone TEXT NOT NULL,
      FOREIGN KEY(ownerId) REFERENCES owners(id)
    );

    CREATE TABLE IF NOT EXISTS settlement_accounts (
      id TEXT PRIMARY KEY,
      propertyId TEXT NOT NULL UNIQUE,
      payeeName TEXT NOT NULL,
      upiId TEXT NOT NULL,
      instructions TEXT NOT NULL,
      FOREIGN KEY(propertyId) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      propertyId TEXT NOT NULL,
      label TEXT NOT NULL UNIQUE,
      floor TEXT NOT NULL,
      meterId TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY(propertyId) REFERENCES properties(id)
    );

    CREATE TABLE IF NOT EXISTS room_meters (
      id TEXT PRIMARY KEY,
      propertyId TEXT NOT NULL,
      roomId TEXT NOT NULL UNIQUE,
      serialNumber TEXT NOT NULL,
      lastReading REAL NOT NULL,
      FOREIGN KEY(propertyId) REFERENCES properties(id),
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL,
      emergencyContact TEXT NOT NULL,
      idDocument TEXT NOT NULL,
      notes TEXT NOT NULL,
      profileStatus TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      tenancyId TEXT NOT NULL UNIQUE,
      fileName TEXT NOT NULL,
      rentAmount REAL NOT NULL,
      depositAmount REAL NOT NULL,
      dueDay INTEGER NOT NULL,
      moveInDate TEXT NOT NULL,
      contractStart TEXT NOT NULL,
      contractEnd TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tenancies (
      id TEXT PRIMARY KEY,
      propertyId TEXT NOT NULL,
      roomId TEXT NOT NULL,
      tenantId TEXT NOT NULL,
      status TEXT NOT NULL,
      contractId TEXT,
      rentAmount REAL,
      depositAmount REAL,
      dueDay INTEGER,
      moveInDate TEXT,
      contractStart TEXT,
      contractEnd TEXT,
      moveOutDate TEXT,
      FOREIGN KEY(propertyId) REFERENCES properties(id),
      FOREIGN KEY(roomId) REFERENCES rooms(id),
      FOREIGN KEY(tenantId) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      propertyId TEXT NOT NULL,
      tenancyId TEXT NOT NULL,
      tenantId TEXT NOT NULL,
      roomId TEXT NOT NULL,
      month TEXT NOT NULL,
      billingPeriodStart TEXT NOT NULL,
      billingPeriodEnd TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      status TEXT NOT NULL,
      baseRent REAL NOT NULL,
      electricityCharge REAL NOT NULL,
      totalAmount REAL NOT NULL,
      lineItems TEXT NOT NULL,
      readingSnapshot TEXT NOT NULL,
      settlementSnapshot TEXT NOT NULL,
      paymentLink TEXT NOT NULL,
      generatedAt TEXT NOT NULL,
      paymentSubmissionId TEXT,
      paidAt TEXT,
      FOREIGN KEY(propertyId) REFERENCES properties(id),
      FOREIGN KEY(tenancyId) REFERENCES tenancies(id),
      FOREIGN KEY(tenantId) REFERENCES tenants(id),
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS meter_readings (
      id TEXT PRIMARY KEY,
      propertyId TEXT NOT NULL,
      roomId TEXT NOT NULL,
      meterId TEXT NOT NULL,
      month TEXT NOT NULL,
      openingReading REAL NOT NULL,
      closingReading REAL NOT NULL,
      tariff REAL NOT NULL,
      capturedAt TEXT NOT NULL,
      FOREIGN KEY(propertyId) REFERENCES properties(id),
      FOREIGN KEY(roomId) REFERENCES rooms(id),
      FOREIGN KEY(meterId) REFERENCES room_meters(id)
    );

    CREATE TABLE IF NOT EXISTS payment_submissions (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      tenantId TEXT NOT NULL,
      status TEXT NOT NULL,
      utr TEXT NOT NULL,
      screenshotLabel TEXT NOT NULL,
      note TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      reviewedAt TEXT,
      reviewerNote TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(invoiceId) REFERENCES invoices(id),
      FOREIGN KEY(tenantId) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      propertyId TEXT NOT NULL,
      invoiceId TEXT NOT NULL,
      tenantId TEXT NOT NULL,
      channel TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      triggerDate TEXT NOT NULL,
      deliveryStatus TEXT NOT NULL,
      lastAttemptAt TEXT,
      note TEXT NOT NULL,
      FOREIGN KEY(propertyId) REFERENCES properties(id),
      FOREIGN KEY(invoiceId) REFERENCES invoices(id),
      FOREIGN KEY(tenantId) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS audit_trail (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
}

function insertRecords(db, tableName, columns, rows) {
  if (!rows.length) {
    return;
  }

  const placeholders = columns.map(() => '?').join(', ');
  const statement = db.prepare(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
  );

  for (const row of rows) {
    statement.run(...columns.map((column) => row[column]));
  }
}

function seedDatabase(db) {
  const existingOwner = db.prepare('SELECT id FROM owners LIMIT 1').get();
  if (existingOwner) {
    return;
  }

  const seed = createSeedState();

  insertRecords(db, 'owners', ['id', 'name', 'phone'], [seed.owner]);
  insertRecords(
    db,
    'properties',
    ['id', 'ownerId', 'name', 'address', 'defaultTariff', 'managerName', 'managerPhone'],
    [seed.property],
  );
  insertRecords(
    db,
    'settlement_accounts',
    ['id', 'propertyId', 'payeeName', 'upiId', 'instructions'],
    [seed.settlementAccount],
  );
  insertRecords(db, 'rooms', ['id', 'propertyId', 'label', 'floor', 'meterId', 'status'], seed.rooms);
  insertRecords(
    db,
    'room_meters',
    ['id', 'propertyId', 'roomId', 'serialNumber', 'lastReading'],
    seed.roomMeters,
  );
  insertRecords(
    db,
    'tenants',
    ['id', 'phone', 'fullName', 'email', 'emergencyContact', 'idDocument', 'notes', 'profileStatus'],
    seed.tenants,
  );
  insertRecords(
    db,
    'contracts',
    [
      'id',
      'tenancyId',
      'fileName',
      'rentAmount',
      'depositAmount',
      'dueDay',
      'moveInDate',
      'contractStart',
      'contractEnd',
      'createdAt',
    ],
    seed.contracts,
  );
  insertRecords(
    db,
    'tenancies',
    [
      'id',
      'propertyId',
      'roomId',
      'tenantId',
      'status',
      'contractId',
      'rentAmount',
      'depositAmount',
      'dueDay',
      'moveInDate',
      'contractStart',
      'contractEnd',
      'moveOutDate',
    ],
    seed.tenancies,
  );
  insertRecords(
    db,
    'invoices',
    [
      'id',
      'propertyId',
      'tenancyId',
      'tenantId',
      'roomId',
      'month',
      'billingPeriodStart',
      'billingPeriodEnd',
      'dueDate',
      'status',
      'baseRent',
      'electricityCharge',
      'totalAmount',
      'lineItems',
      'readingSnapshot',
      'settlementSnapshot',
      'paymentLink',
      'generatedAt',
      'paymentSubmissionId',
      'paidAt',
    ],
    seed.invoices.map((invoice) => ({
      ...invoice,
      lineItems: JSON.stringify(invoice.lineItems),
      readingSnapshot: JSON.stringify(invoice.readingSnapshot),
      settlementSnapshot: JSON.stringify(invoice.settlementSnapshot),
      paymentSubmissionId: invoice.paymentSubmissionId || null,
      paidAt: invoice.paidAt || null,
    })),
  );
  insertRecords(
    db,
    'meter_readings',
    [
      'id',
      'propertyId',
      'roomId',
      'meterId',
      'month',
      'openingReading',
      'closingReading',
      'tariff',
      'capturedAt',
    ],
    seed.meterReadings,
  );
  insertRecords(
    db,
    'payment_submissions',
    [
      'id',
      'invoiceId',
      'tenantId',
      'status',
      'utr',
      'screenshotLabel',
      'note',
      'submittedAt',
      'reviewedAt',
      'reviewerNote',
    ],
    seed.paymentSubmissions.map((submission) => ({
      ...submission,
      reviewedAt: submission.reviewedAt || null,
      reviewerNote: submission.reviewerNote || '',
    })),
  );
  insertRecords(
    db,
    'reminders',
    [
      'id',
      'propertyId',
      'invoiceId',
      'tenantId',
      'channel',
      'kind',
      'title',
      'triggerDate',
      'deliveryStatus',
      'lastAttemptAt',
      'note',
    ],
    seed.reminders.map((reminder) => ({
      ...reminder,
      lastAttemptAt: reminder.lastAttemptAt || null,
    })),
  );
  insertRecords(
    db,
    'audit_trail',
    ['id', 'title', 'detail', 'createdAt'],
    seed.auditTrail.map((entry) => ({
      ...entry,
      createdAt: seed.referenceDate,
    })),
  );
}

function createDatabase(options = {}) {
  const filename = options.filename || DEFAULT_DB_FILE;

  ensureParentDirectory(filename);

  const db = new DatabaseSync(filename);
  createSchema(db);
  seedDatabase(db);
  return db;
}

function withTransaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');

  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  DEFAULT_DB_FILE,
  createDatabase,
  withTransaction,
};
