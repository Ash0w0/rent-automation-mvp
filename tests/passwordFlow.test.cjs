const assert = require('node:assert/strict');
const test = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-password-flow';

const { makeId } = require('../src/lib/rentEngine');
const { createRentBackend } = require('../server/backend');
const { issueTemporaryCredential } = require('../server/credentialService');
const { SheetsPrismaClient } = require('../server/sheetsPrisma');
const { ALL_TABS } = require('../server/sheetsSchema');

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

test('owner logs in with temporary code, sets password, then uses permanent password', async () => {
  const store = new SheetsPrismaClient({
    sheets: createFakeSheetsApi(),
    spreadsheetId: 'password-flow-test',
  });
  const owner = await store.owner.create({
    data: {
      id: makeId('owner'),
      name: 'Asha',
      phone: '+918002822133',
    },
  });
  const temporaryCredential = await issueTemporaryCredential(store, {
    role: 'owner',
    phone: owner.phone,
    ownerId: owner.id,
  });
  const backend = createRentBackend({
    prisma: store,
    skipSeed: true,
  });

  const firstLogin = await backend.login({
    role: 'owner',
    phone: owner.phone,
    password: temporaryCredential.temporaryCode,
  });

  assert.equal(firstLogin.state.session.role, 'owner');
  assert.equal(firstLogin.state.session.mustChangePassword, true);

  const temporarySession = await backend.getSessionForAccessToken(firstLogin.tokens.accessToken);
  const afterSetPassword = await backend.setPassword({ password: 'secret123' }, temporarySession);

  assert.equal(afterSetPassword.session.mustChangePassword, false);

  const secondLogin = await backend.login({
    role: 'owner',
    phone: owner.phone,
    password: 'secret123',
  });

  assert.equal(secondLogin.state.session.role, 'owner');
  assert.equal(secondLogin.state.session.mustChangePassword, false);
});
