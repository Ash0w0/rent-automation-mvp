require('dotenv').config();

const { createSheetsApi, createSheetsPrismaClient, ensureSpreadsheetSchema } = require('../server/sheetsPrisma');
const { seedDatabase } = require('../server/seed');

function getSpreadsheetId() {
  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    throw new Error('Missing required environment variable: GOOGLE_SHEETS_SPREADSHEET_ID');
  }

  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
}

async function init() {
  await ensureSpreadsheetSchema({
    sheets: createSheetsApi(),
    spreadsheetId: getSpreadsheetId(),
    createMissing: true,
  });
  console.log('Google Sheets schema is ready.');
}

async function validate() {
  await ensureSpreadsheetSchema({
    sheets: createSheetsApi(),
    spreadsheetId: getSpreadsheetId(),
    createMissing: false,
  });
  console.log('Google Sheets schema is valid.');
}

async function seed() {
  const store = createSheetsPrismaClient({
    autoInit: true,
  });

  try {
    await seedDatabase(store);
    console.log('Google Sheets seed completed.');
  } finally {
    await store.$disconnect();
  }
}

async function main() {
  const command = process.argv[2];

  if (command === 'init') {
    await init();
    return;
  }

  if (command === 'validate') {
    await validate();
    return;
  }

  if (command === 'seed') {
    await seed();
    return;
  }

  throw new Error('Usage: node scripts/sheets.js <init|validate|seed>');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  init,
  seed,
  validate,
};
