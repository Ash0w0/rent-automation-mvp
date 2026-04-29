const test = require('node:test');
test('backend integration requires TEST_GOOGLE_SHEETS_SPREADSHEET_ID', { skip: !process.env.TEST_GOOGLE_SHEETS_SPREADSHEET_ID }, () => {
  // The backend now targets a super-admin Google Sheet through the Sheets API.
  // Run full backend integration flows after provisioning a test spreadsheet,
  // sharing it with the service account, and setting the Google env vars.
});
