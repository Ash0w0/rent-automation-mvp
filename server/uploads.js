const fs = require('node:fs');
const path = require('node:path');

const uploadsDir = path.resolve(process.cwd(), '.data', 'uploads');

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

function saveImageUpload(prefix, upload) {
  if (!upload?.dataUrl) {
    throw new Error('Image upload data is required.');
  }

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(upload.dataUrl);
  if (!match) {
    throw new Error('Only image uploads are supported right now.');
  }

  if (shouldInlineUploads()) {
    return upload.dataUrl;
  }

  const [, mimeType, encoded] = match;
  const parsedName = path.parse(upload.fileName || `${prefix}.jpg`);
  const safeBaseName = sanitizeFileName(parsedName.name || prefix) || prefix;
  const extension = parsedName.ext || extensionForMimeType(mimeType);
  const fileName = `${prefix}-${Date.now()}-${safeBaseName}${extension}`;

  ensureUploadsDir();
  fs.writeFileSync(path.join(uploadsDir, fileName), Buffer.from(encoded, 'base64'));

  return fileName;
}

function getUploadsDir() {
  return ensureUploadsDir();
}

module.exports = {
  getUploadsDir,
  saveImageUpload,
};
