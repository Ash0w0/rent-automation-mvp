const SHEET_MODELS = {
  owner: {
    tab: 'owners',
    headers: ['id', 'name', 'phone'],
  },
  property: {
    tab: 'properties',
    headers: ['id', 'ownerId', 'name', 'address', 'defaultTariff', 'managerName', 'managerPhone'],
    numberFields: ['defaultTariff'],
  },
  settlementAccount: {
    tab: 'settlement_accounts',
    headers: ['id', 'propertyId', 'payeeName', 'upiId', 'instructions'],
  },
  room: {
    tab: 'rooms',
    headers: ['id', 'propertyId', 'label', 'floor', 'meterId', 'status'],
  },
  roomMeter: {
    tab: 'room_meters',
    headers: ['id', 'propertyId', 'roomId', 'serialNumber', 'lastReading'],
    numberFields: ['lastReading'],
  },
  tenant: {
    tab: 'tenants',
    headers: [
      'id',
      'phone',
      'fullName',
      'email',
      'emergencyContact',
      'idDocument',
      'notes',
      'profileStatus',
    ],
  },
  authSession: {
    tab: 'auth_sessions',
    headers: [
      'id',
      'role',
      'phone',
      'ownerId',
      'tenantId',
      'refreshTokenHash',
      'sessionExpiresAt',
      'refreshExpiresAt',
      'createdAt',
      'updatedAt',
      'lastUsedAt',
      'revokedAt',
    ],
    nullableFields: ['ownerId', 'tenantId', 'revokedAt'],
  },
  contract: {
    tab: 'contracts',
    headers: [
      'id',
      'tenancyId',
      'fileName',
      'imageLabels',
      'rentAmount',
      'depositAmount',
      'dueDay',
      'moveInDate',
      'contractStart',
      'contractEnd',
      'createdAt',
    ],
    jsonFields: ['imageLabels'],
    numberFields: ['rentAmount', 'depositAmount', 'dueDay'],
    nullableFields: ['imageLabels'],
  },
  tenancy: {
    tab: 'tenancies',
    headers: [
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
    numberFields: ['rentAmount', 'depositAmount', 'dueDay'],
    nullableFields: [
      'contractId',
      'rentAmount',
      'depositAmount',
      'dueDay',
      'moveInDate',
      'contractStart',
      'contractEnd',
      'moveOutDate',
    ],
  },
  invoice: {
    tab: 'invoices',
    headers: [
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
    jsonFields: ['lineItems', 'readingSnapshot', 'settlementSnapshot'],
    numberFields: ['baseRent', 'electricityCharge', 'totalAmount'],
    nullableFields: ['paymentSubmissionId', 'paidAt'],
  },
  meterReading: {
    tab: 'meter_readings',
    headers: [
      'id',
      'propertyId',
      'tenancyId',
      'tenantId',
      'roomId',
      'meterId',
      'invoiceId',
      'month',
      'openingReading',
      'closingReading',
      'tariff',
      'capturedAt',
      'status',
      'photoLabel',
      'reviewedAt',
      'reviewerNote',
      'capturedByRole',
    ],
    numberFields: ['openingReading', 'closingReading', 'tariff'],
    nullableFields: ['tenancyId', 'tenantId', 'invoiceId', 'photoLabel', 'reviewedAt'],
  },
  paymentSubmission: {
    tab: 'payment_submissions',
    headers: [
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
    nullableFields: ['reviewedAt'],
  },
  reminder: {
    tab: 'reminders',
    headers: [
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
    nullableFields: ['lastAttemptAt'],
  },
  auditTrail: {
    tab: 'audit_trail',
    headers: ['id', 'title', 'detail', 'createdAt'],
  },
};

const METADATA_TAB = {
  tab: 'metadata',
  headers: ['key', 'value'],
};

const MODEL_NAMES = Object.keys(SHEET_MODELS);
const ALL_TABS = [...MODEL_NAMES.map((name) => SHEET_MODELS[name]), METADATA_TAB];

function quoteSheetName(tabName) {
  return `'${String(tabName).replace(/'/g, "''")}'`;
}

function getSheetRange(tabName) {
  return `${quoteSheetName(tabName)}!A:ZZ`;
}

function getHeaderRange(tabName, headerLength) {
  return `${quoteSheetName(tabName)}!A1:${columnName(headerLength)}1`;
}

function columnName(index) {
  let value = Number(index);
  let output = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }

  return output || 'A';
}

function assertHeadersMatch(tabName, expectedHeaders, actualHeaders = []) {
  const normalizedActual = actualHeaders.slice(0, expectedHeaders.length);
  const matches =
    normalizedActual.length === expectedHeaders.length &&
    expectedHeaders.every((header, index) => normalizedActual[index] === header);

  if (!matches) {
    throw new Error(
      `Google Sheet tab "${tabName}" has invalid headers. Expected: ${expectedHeaders.join(
        ', ',
      )}`,
    );
  }
}

module.exports = {
  ALL_TABS,
  METADATA_TAB,
  MODEL_NAMES,
  SHEET_MODELS,
  assertHeadersMatch,
  getHeaderRange,
  getSheetRange,
};
