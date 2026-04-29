# Google Sheets Backend Setup

This branch replaces Postgres with one super-admin Google Sheet. Only the backend service account and the super admin should have direct access to the Sheet. Owners and tenants should only use the app.

## Google Setup

1. Create a Google Cloud service account.
2. Enable the Google Sheets API for the project.
3. Enable the Google Drive API if you want contract, meter, and payment-proof images stored in Drive.
4. Create one Google Sheet for app data.
5. Share the Sheet with the service account email as Editor.
6. Create one Drive folder for uploads and share it with the service account email as Editor.

## Environment Variables

```env
GOOGLE_SHEETS_SPREADSHEET_ID="your-super-admin-spreadsheet-id"
GOOGLE_SERVICE_ACCOUNT_EMAIL="rent-automation@your-project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_AUTO_INIT="false"
UPLOAD_STORAGE_MODE="google-drive"
GOOGLE_DRIVE_UPLOAD_FOLDER_ID="your-drive-folder-id"
```

Keep `JWT_SECRET` and the Twilio env vars configured as before.

## Commands

```bash
npm run sheets:init
npm run sheets:seed
npm run sheets:validate
npm run server
```

`sheets:init` creates the required tabs and headers. `sheets:seed` only seeds demo data if the Sheet has no owner rows yet.

## Notes

- The Sheet is treated like a database, so avoid manual edits except for emergency admin fixes.
- The backend validates headers on startup and fails if the schema is wrong.
- Google Sheets has no real transactions; this branch serializes writes inside the running backend process, which is enough for MVP/low-volume usage.
- Drive stores uploaded images. The Sheet stores only Drive metadata tokens, not raw files.
