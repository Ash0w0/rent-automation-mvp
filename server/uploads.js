const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const { google } = require('googleapis');

const uploadsDir = path.resolve(process.cwd(), '.data', 'uploads');
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DRIVE_PREFIX = 'gdrive:';

function shouldInlineUploads() {
  return process.env.UPLOAD_STORAGE_MODE === 'inline' || Boolean(process.env.VERCEL);
}

function shouldUseGoogleDrive() {
  return process.env.UPLOAD_STORAGE_MODE === 'google-drive' || Boolean(process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID);
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

function createDriveClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive uploads require GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: normalizePrivateKey(privateKey),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return google.drive({ version: 'v3', auth });
}

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

function sanitizeFileName(value) {
  return String(value || 'upload')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extensionForMimeType(mimeType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
  };

  return map[mimeType] || '.jpg';
}

function mimeTypeForExtension(extension) {
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
  };

  return map[String(extension || '').toLowerCase()] || 'application/octet-stream';
}

async function uploadToGoogleDrive({ buffer, fileName, mimeType }) {
  const folderId = process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID;
  if (!folderId) {
    throw new Error('Google Drive uploads require GOOGLE_DRIVE_UPLOAD_FOLDER_ID.');
  }

  const drive = createDriveClient();
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id,mimeType,name',
  });

  return `${DRIVE_PREFIX}${response.data.id}:${mimeType}`;
}

async function readGoogleDriveUploadAsDataUrl(fileName) {
  const [, fileId, mimeType = 'application/octet-stream'] = String(fileName).split(':');
  if (!fileId) {
    return null;
  }

  const drive = createDriveClient();
  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
    },
    {
      responseType: 'arraybuffer',
    },
  );
  const buffer = Buffer.from(response.data);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function saveImageUpload(prefix, upload) {
  if (!upload?.dataUrl) {
    throw new Error('Image upload data is required.');
  }

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(upload.dataUrl);
  if (!match) {
    throw new Error('Only image uploads are supported right now.');
  }

  const [, mimeType, encoded] = match;
  const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']);
  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error('Only JPG, PNG, WEBP, and HEIC uploads are supported.');
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image uploads must be 8 MB or smaller.');
  }

  const parsedName = path.parse(upload.fileName || `${prefix}.jpg`);
  const safeBaseName = sanitizeFileName(parsedName.name || prefix) || prefix;
  const extension = extensionForMimeType(mimeType);
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const fileName = `${prefix}-${Date.now()}-${uniqueId}-${safeBaseName}${extension}`;

  if (shouldUseGoogleDrive()) {
    return uploadToGoogleDrive({ buffer, fileName, mimeType });
  }

  if (shouldInlineUploads()) {
    return upload.dataUrl;
  }

  ensureUploadsDir();
  fs.writeFileSync(path.join(uploadsDir, fileName), buffer);

  return fileName;
}

function getUploadsDir() {
  return ensureUploadsDir();
}

async function readStoredUploadAsDataUrl(fileName) {
  if (!fileName || fileName.startsWith('data:') || /^https?:\/\//.test(fileName)) {
    return fileName || null;
  }

  if (fileName.startsWith(DRIVE_PREFIX)) {
    return readGoogleDriveUploadAsDataUrl(fileName);
  }

  const safeFileName = path.basename(fileName);
  const absolutePath = path.join(ensureUploadsDir(), safeFileName);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const extension = path.extname(safeFileName);
  const mimeType = mimeTypeForExtension(extension);
  const encoded = fs.readFileSync(absolutePath).toString('base64');
  return `data:${mimeType};base64,${encoded}`;
}

module.exports = {
  getUploadsDir,
  readStoredUploadAsDataUrl,
  saveImageUpload,
};
