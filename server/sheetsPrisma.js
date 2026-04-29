const { google } = require('googleapis');

const {
  ALL_TABS,
  METADATA_TAB,
  MODEL_NAMES,
  SHEET_MODELS,
  assertHeadersMatch,
  getHeaderRange,
  getSheetRange,
} = require('./sheetsSchema');

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

function createSheetsApi() {
  const clientEmail = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = normalizePrivateKey(requireEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'));
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [SHEETS_SCOPE],
  });

  return google.sheets({ version: 'v4', auth });
}

class AsyncQueue {
  constructor() {
    this.tail = Promise.resolve();
  }

  async run(task) {
    const previous = this.tail;
    let release;
    this.tail = new Promise((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

function cloneTables(tables) {
  return Object.fromEntries(
    MODEL_NAMES.map((modelName) => [
      modelName,
      (tables[modelName] || []).map((record) => cloneRecord(record)),
    ]),
  );
}

function getModelConfig(modelName) {
  const config = SHEET_MODELS[modelName];
  if (!config) {
    throw new Error(`Unknown Sheets model "${modelName}".`);
  }

  return {
    ...config,
    jsonFields: new Set(config.jsonFields || []),
    nullableFields: new Set(config.nullableFields || []),
    numberFields: new Set(config.numberFields || []),
  };
}

function deserializeValue(config, field, value) {
  const rawValue = value === undefined ? '' : value;
  if (rawValue === '' && config.nullableFields.has(field)) {
    return null;
  }

  if (config.jsonFields.has(field)) {
    if (rawValue === '') {
      return config.nullableFields.has(field) ? null : [];
    }

    return JSON.parse(rawValue);
  }

  if (config.numberFields.has(field)) {
    if (rawValue === '') {
      return config.nullableFields.has(field) ? null : 0;
    }

    return Number(rawValue);
  }

  return String(rawValue);
}

function serializeValue(config, field, value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (config.jsonFields.has(field)) {
    return JSON.stringify(value);
  }

  return value;
}

function deserializeRecord(modelName, row) {
  const config = getModelConfig(modelName);
  const record = {};

  config.headers.forEach((field, index) => {
    record[field] = deserializeValue(config, field, row[index]);
  });

  return record;
}

function serializeRecord(modelName, record) {
  const config = getModelConfig(modelName);
  return config.headers.map((field) => serializeValue(config, field, record[field]));
}

function compareValues(actual, expected) {
  return actual === expected;
}

function matchesFieldFilter(actual, filter) {
  if (filter && typeof filter === 'object' && !Array.isArray(filter)) {
    if (Object.prototype.hasOwnProperty.call(filter, 'in')) {
      return Array.isArray(filter.in) && filter.in.some((value) => compareValues(actual, value));
    }

    if (Object.prototype.hasOwnProperty.call(filter, 'not')) {
      return !matchesFieldFilter(actual, filter.not);
    }

    if (Object.prototype.hasOwnProperty.call(filter, 'equals')) {
      return compareValues(actual, filter.equals);
    }
  }

  return compareValues(actual, filter);
}

function matchesWhere(record, where = {}) {
  return Object.entries(where || {}).every(([field, expected]) => {
    if (field === 'OR') {
      return Array.isArray(expected) && expected.some((condition) => matchesWhere(record, condition));
    }

    if (field === 'AND') {
      return Array.isArray(expected) && expected.every((condition) => matchesWhere(record, condition));
    }

    return matchesFieldFilter(record[field], expected);
  });
}

function applySelect(record, select) {
  if (!record || !select) {
    return record ? cloneRecord(record) : record;
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([field]) => [field, record[field]]),
  );
}

function compareForSort(left, right, direction) {
  if (left === right) {
    return 0;
  }

  if (left === null || left === undefined) {
    return direction === 'desc' ? 1 : -1;
  }

  if (right === null || right === undefined) {
    return direction === 'desc' ? -1 : 1;
  }

  const result =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true });

  return direction === 'desc' ? -result : result;
}

function applyOrder(records, orderBy = []) {
  const rules = Array.isArray(orderBy) ? orderBy : [orderBy];
  const activeRules = rules.filter(Boolean);
  if (!activeRules.length) {
    return records;
  }

  return [...records].sort((left, right) => {
    for (const rule of activeRules) {
      const [[field, direction = 'asc']] = Object.entries(rule);
      const result = compareForSort(left[field], right[field], direction);
      if (result !== 0) {
        return result;
      }
    }

    return 0;
  });
}

function buildModelClient(modelName, tables, persist) {
  function getRows() {
    return tables[modelName] || [];
  }

  async function write(mutator) {
    const result = mutator();
    await persist();
    return result;
  }

  return {
    async findFirst(options = {}) {
      const rows = applyOrder(
        getRows().filter((record) => matchesWhere(record, options.where)),
        options.orderBy,
      );
      return applySelect(rows[0] || null, options.select);
    },

    async findUnique(options = {}) {
      const row = getRows().find((record) => matchesWhere(record, options.where));
      return applySelect(row || null, options.select);
    },

    async findMany(options = {}) {
      const rows = applyOrder(
        getRows().filter((record) => matchesWhere(record, options.where)),
        options.orderBy,
      );
      return rows.map((record) => applySelect(record, options.select));
    },

    async create(options = {}) {
      return write(() => {
        const record = cloneRecord(options.data || {});
        tables[modelName].push(record);
        return applySelect(record, options.select);
      });
    },

    async createMany(options = {}) {
      return write(() => {
        const records = (options.data || []).map((record) => cloneRecord(record));
        tables[modelName].push(...records);
        return { count: records.length };
      });
    },

    async update(options = {}) {
      return write(() => {
        const index = getRows().findIndex((record) => matchesWhere(record, options.where));
        if (index === -1) {
          throw new Error(`Unable to update missing ${modelName} record.`);
        }

        tables[modelName][index] = {
          ...tables[modelName][index],
          ...(options.data || {}),
        };

        return applySelect(tables[modelName][index], options.select);
      });
    },

    async upsert(options = {}) {
      const existing = getRows().find((record) => matchesWhere(record, options.where));
      if (existing) {
        return this.update({
          where: options.where,
          data: options.update,
          select: options.select,
        });
      }

      return this.create({
        data: options.create,
        select: options.select,
      });
    },
  };
}

async function ensureSpreadsheetSchema({ sheets, spreadsheetId, createMissing = false }) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const existingTabs = new Set(
    (spreadsheet.data.sheets || []).map((sheet) => sheet.properties.title),
  );
  const missingTabs = ALL_TABS.filter((tabConfig) => !existingTabs.has(tabConfig.tab));

  if (missingTabs.length) {
    if (!createMissing) {
      throw new Error(
        `Google Sheet is missing tabs: ${missingTabs
          .map((tabConfig) => tabConfig.tab)
          .join(', ')}. Run npm run sheets:init.`,
      );
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingTabs.map((tabConfig) => ({
          addSheet: {
            properties: {
              title: tabConfig.tab,
            },
          },
        })),
      },
    });
  }

  for (const tabConfig of ALL_TABS) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: getHeaderRange(tabConfig.tab, tabConfig.headers.length),
    });
    const headers = response.data.values?.[0] || [];

    if (!headers.length && createMissing) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: getHeaderRange(tabConfig.tab, tabConfig.headers.length),
        valueInputOption: 'RAW',
        requestBody: {
          values: [tabConfig.headers],
        },
      });
      continue;
    }

    assertHeadersMatch(tabConfig.tab, tabConfig.headers, headers);
  }

  if (createMissing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${METADATA_TAB.tab}!A1:B2`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [METADATA_TAB.headers, ['schemaVersion', '1']],
      },
    });
  }
}

class SheetsPrismaClient {
  constructor(options = {}) {
    this.sheets = options.sheets || createSheetsApi();
    this.spreadsheetId = options.spreadsheetId || requireEnv('GOOGLE_SHEETS_SPREADSHEET_ID');
    this.autoInit = options.autoInit ?? process.env.GOOGLE_SHEETS_AUTO_INIT === 'true';
    this.queue = new AsyncQueue();
    this.loaded = false;
    this.tables = Object.fromEntries(MODEL_NAMES.map((modelName) => [modelName, []]));

    for (const modelName of MODEL_NAMES) {
      this[modelName] = this.createQueuedModelClient(modelName);
    }
  }

  createQueuedModelClient(modelName) {
    return {
      findFirst: (options) => this.queue.run(() => this.withLoadedClient(modelName, 'findFirst', options)),
      findUnique: (options) => this.queue.run(() => this.withLoadedClient(modelName, 'findUnique', options)),
      findMany: (options) => this.queue.run(() => this.withLoadedClient(modelName, 'findMany', options)),
      create: (options) => this.queue.run(() => this.withLoadedClient(modelName, 'create', options)),
      createMany: (options) => this.queue.run(() => this.withLoadedClient(modelName, 'createMany', options)),
      update: (options) => this.queue.run(() => this.withLoadedClient(modelName, 'update', options)),
      upsert: (options) => this.queue.run(() => this.withLoadedClient(modelName, 'upsert', options)),
    };
  }

  async withLoadedClient(modelName, methodName, options) {
    await this.load();
    const client = buildModelClient(modelName, this.tables, () => this.persist());
    return client[methodName](options);
  }

  async load() {
    if (this.loaded) {
      return;
    }

    await ensureSpreadsheetSchema({
      sheets: this.sheets,
      spreadsheetId: this.spreadsheetId,
      createMissing: this.autoInit,
    });

    const response = await this.sheets.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges: MODEL_NAMES.map((modelName) => getSheetRange(SHEET_MODELS[modelName].tab)),
    });

    const valueRanges = response.data.valueRanges || [];
    this.tables = Object.fromEntries(
      MODEL_NAMES.map((modelName, index) => {
        const config = SHEET_MODELS[modelName];
        const rows = valueRanges[index]?.values || [];
        const headers = rows[0] || [];
        assertHeadersMatch(config.tab, config.headers, headers);

        return [
          modelName,
          rows
            .slice(1)
            .filter((row) => row.some((value) => value !== ''))
            .map((row) => deserializeRecord(modelName, row)),
        ];
      }),
    );
    this.loaded = true;
  }

  async persist(tables = this.tables) {
    const ranges = MODEL_NAMES.map((modelName) => getSheetRange(SHEET_MODELS[modelName].tab));
    await this.sheets.spreadsheets.values.batchClear({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        ranges,
      },
    });

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: MODEL_NAMES.map((modelName) => {
          const config = SHEET_MODELS[modelName];
          return {
            range: getSheetRange(config.tab),
            values: [
              config.headers,
              ...(tables[modelName] || []).map((record) => serializeRecord(modelName, record)),
            ],
          };
        }),
      },
    });
  }

  async $transaction(callback) {
    return this.queue.run(async () => {
      await this.load();
      const draftTables = cloneTables(this.tables);
      const tx = Object.fromEntries(
        MODEL_NAMES.map((modelName) => [
          modelName,
          buildModelClient(modelName, draftTables, async () => {}),
        ]),
      );

      const result = await callback(tx);
      this.tables = draftTables;
      await this.persist();
      return result;
    });
  }

  async $disconnect() {
    return undefined;
  }
}

function createSheetsPrismaClient(options = {}) {
  return new SheetsPrismaClient(options);
}

module.exports = {
  SHEETS_SCOPE,
  SheetsPrismaClient,
  createSheetsApi,
  createSheetsPrismaClient,
  deserializeRecord,
  ensureSpreadsheetSchema,
  matchesWhere,
  serializeRecord,
};
