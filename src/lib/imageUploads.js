import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// Mirrors the server's 8 MB cap — fail fast before base64-inflating in memory.
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

function getMimeType(asset) {
  return asset?.mimeType || 'image/jpeg';
}

function assertUploadAllowed(asset) {
  const mimeType = getMimeType(asset);
  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    throw new Error('Please choose a photo (JPG, PNG, WebP, or HEIC).');
  }

  if (typeof asset?.fileSize === 'number' && asset.fileSize > MAX_UPLOAD_BYTES) {
    throw new Error('That image is too large. Please pick one under 6 MB.');
  }
}

function getFileName(asset) {
  if (asset?.fileName) {
    return asset.fileName;
  }

  const extension = getMimeType(asset).split('/')[1] || 'jpg';
  return `upload-${Date.now()}.${extension}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('We could not read the selected image.'));
    reader.readAsDataURL(blob);
  });
}

async function assetToDataUrl(asset) {
  if (asset?.base64) {
    return `data:${getMimeType(asset)};base64,${asset.base64}`;
  }

  if (typeof asset?.uri === 'string' && asset.uri.startsWith('data:')) {
    return asset.uri;
  }

  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error('We could not read the selected image.');
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export async function pickImageUpload() {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Please allow photo access to upload an image.');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.7,
    base64: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets?.[0];
  if (!asset) {
    return null;
  }

  assertUploadAllowed(asset);

  return {
    fileName: getFileName(asset),
    mimeType: getMimeType(asset),
    dataUrl: await assetToDataUrl(asset),
    previewUri: asset.uri,
  };
}
