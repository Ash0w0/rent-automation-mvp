const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SheetsPrismaClient,
  matchesWhere,
  serializeRecord,
  deserializeRecord,
} = require('../server/sheetsPrisma');
const { ALL_TABS } = require('../server/sheetsSchema');
const { seedDatabase } = require('../server/seed');

function tabFromRange(range) {
  return range.match(/^'((?:''|[^'])+)'!/)?.[1].replace(/''/g, "'") || range.split('!')[0];
}

function createFakeSheetsApi() {
  const tables = Object.fromEntries(ALL_TABS.map((config) => [config.tab, [config.headers]]));

  return {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: Object.keys(tables).map((title) => ({ properties: { title } })),
        },
      }),
      batchUpdate: async () => ({}),
      values: {
        get: async ({ range }) => ({
          data: {
            values: [tables[tabFromRange(range)]?.[0] || []],
          },
        }),
        batchGet: async ({ ranges }) => ({
          data: {
            valueRanges: ranges.map((range) => ({
              values: tables[tabFromRange(range)] || [[]],
            })),
          },
        }),
        batchClear: async ({ requestBody }) => {
          for (const range of requestBody.ranges) {
            tables[tabFromRange(range)] = [];
          }
          return {};
        },
        batchUpdate: async ({ requestBody }) => {
          for (const item of requestBody.data) {
            tables[tabFromRange(item.range)] = item.values;
          }
          return {};
        },
        update: async ({ range, requestBody }) => {
          tables[tabFromRange(range)] = requestBody.values;
          return {};
        },
      },
    },
  };
}

test('sheets adapter serializes json, numbers, and nulls', () => {
  const invoice = {
    id: 'invoice-1',
    propertyId: 'property-1',
    tenancyId: 'tenancy-1',
    tenantId: 'tenant-1',
    roomId: 'room-1',
    month: '2026-04',
    billingPeriodStart: '2026-04-01',
    billingPeriodEnd: '2026-04-30',
    dueDate: '2026-04-05',
    status: 'ISSUED',
    baseRent: 15000,
    electricityCharge: 255,
    totalAmount: 15255,
    lineItems: [{ id: 'line-1', type: 'BASE_RENT', amount: 15000 }],
    readingSnapshot: { openingReading: 10, closingReading: 40, tariff: 8.5 },
    settlementSnapshot: { upiId: 'owner@upi', payeeName: 'Owner' },
    paymentLink: 'upi://pay',
    generatedAt: '2026-04-01',
    paymentSubmissionId: null,
    paidAt: null,
  };

  const row = serializeRecord('invoice', invoice);
  const restored = deserializeRecord('invoice', row);

  assert.deepEqual(restored, invoice);
  assert.equal(row[18], '');
  assert.equal(row[19], '');
});

test('sheets adapter matches prisma-like filters used by backend', () => {
  const record = {
    id: 'tenancy-1',
    roomId: 'room-1',
    status: 'ACTIVE',
    tenantId: 'tenant-1',
  };

  assert.equal(matchesWhere(record, { id: 'tenancy-1' }), true);
  assert.equal(matchesWhere(record, { id: { not: 'tenancy-2' } }), true);
  assert.equal(matchesWhere(record, { status: { in: ['ACTIVE', 'MOVE_OUT_SCHEDULED'] } }), true);
  assert.equal(
    matchesWhere(record, {
      OR: [{ tenantId: 'tenant-2' }, { roomId: 'room-1' }],
    }),
    true,
  );
  assert.equal(matchesWhere(record, { status: { in: ['CLOSED'] } }), false);
});

test('sheets adapter supports seed transaction flow', async () => {
  const store = new SheetsPrismaClient({
    sheets: createFakeSheetsApi(),
    spreadsheetId: 'test-spreadsheet',
  });

  await seedDatabase(store);

  const owner = await store.owner.findFirst({ where: { phone: '9000000000' } });
  const rooms = await store.room.findMany({ orderBy: [{ label: 'asc' }] });

  assert.equal(owner.id, 'owner-1');
  assert.equal(rooms.length, 3);
  assert.deepEqual(
    rooms.map((room) => room.label),
    ['101', '202', '303'],
  );
});
