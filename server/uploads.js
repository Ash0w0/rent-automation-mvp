const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const uploadsDir = path.resolve(process.cwd(), '.data', 'uploads');
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function shouldInlineUploads() {
  return process.env.UPLOAD_STORAGE_MODE === 'inline' || Boolean(process.env.VERCEL);
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

function saveImageUpload(prefix, upload) {
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

  if (shouldInlineUploads()) {
    return upload.dataUrl;
  }

  const parsedName = path.parse(upload.fileName || `${prefix}.jpg`);
  const safeBaseName = sanitizeFileName(parsedName.name || prefix) || prefix;
  const extension = extensionForMimeType(mimeType);
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const fileName = `${prefix}-${Date.now()}-${uniqueId}-${safeBaseName}${extension}`;

  ensureUploadsDir();
  fs.writeFileSync(path.join(uploadsDir, fileName), buffer);

  return fileName;
}

function getUploadsDir() {
  return ensureUploadsDir();
}

function readStoredUploadAsDataUrl(fileName) {
  if (!fileName || fileName.startsWith('data:') || /^https?:\/\//.test(fileName)) {
    return fileName || null;
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
