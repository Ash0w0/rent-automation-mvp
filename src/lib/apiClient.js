const { Platform } = require('react-native');

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function getApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || '127.0.0.1';
    return `${protocol}//${hostname}:4000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://127.0.0.1:4000';
}

function resolveUploadUrl(fileName) {
  if (!fileName) {
    return null;
  }

  if (/^https?:\/\//.test(fileName) || fileName.startsWith('data:')) {
    return fileName;
  }

  return `${getApiBaseUrl()}/uploads/${fileName}`;
}

async function requestJson(path, options = {}) {
  const requestOptions = {
    method: options.method || 'GET',
    headers: {},
  };

  if (options.body !== undefined) {
    requestOptions.headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, requestOptions);
  const rawBody = await response.text();
  const payload = rawBody ? JSON.parse(rawBody) : null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}.`);
  }

  return payload;
}

function fetchAppState() {
  return requestJson('/api/state');
}

function demoLogin(role, phone) {
  return requestJson('/api/auth/demo-login', {
    method: 'POST',
    body: { role, phone },
  });
}

function updateProperty(payload) {
  return requestJson('/api/property', {
    method: 'PATCH',
    body: payload,
  });
}

function updateSettlement(payload) {
  return requestJson('/api/settlement', {
    method: 'PATCH',
    body: payload,
  });
}

function addRoom(payload) {
  return requestJson('/api/rooms', {
    method: 'POST',
    body: payload,
  });
}

function inviteTenant(payload) {
  return requestJson('/api/tenancies/invite', {
    method: 'POST',
    body: payload,
  });
}

function completeTenantProfile(tenantId, payload) {
  return requestJson(`/api/tenants/${tenantId}/profile`, {
    method: 'PATCH',
    body: payload,
  });
}

function activateTenancy(tenancyId, payload) {
  return requestJson(`/api/tenancies/${tenancyId}/activate`, {
    method: 'POST',
    body: payload,
  });
}

function generateInvoice(payload) {
  return requestJson('/api/invoices', {
    method: 'POST',
    body: payload,
  });
}

function submitMeterReading(payload) {
  return requestJson('/api/meter-readings/submissions', {
    method: 'POST',
    body: payload,
  });
}

function reviewMeterReading(payload) {
  return requestJson('/api/meter-readings/review', {
    method: 'POST',
    body: payload,
  });
}

function submitPayment(payload) {
  return requestJson('/api/payments/submissions', {
    method: 'POST',
    body: payload,
  });
}

function reviewPayment(payload) {
  return requestJson('/api/payments/review', {
    method: 'POST',
    body: payload,
  });
}

function updateReminderStatus(reminderId, deliveryStatus) {
  return requestJson(`/api/reminders/${reminderId}/status`, {
    method: 'PATCH',
    body: { deliveryStatus },
  });
}

function scheduleMoveOut(tenancyId, moveOutDate) {
  return requestJson(`/api/tenancies/${tenancyId}/move-out`, {
    method: 'POST',
    body: { moveOutDate },
  });
}

function closeTenancy(tenancyId) {
  return requestJson(`/api/tenancies/${tenancyId}/close`, {
    method: 'POST',
  });
}

module.exports = {
  addRoom,
  activateTenancy,
  closeTenancy,
  completeTenantProfile,
  demoLogin,
  fetchAppState,
  generateInvoice,
  getApiBaseUrl,
  inviteTenant,
  resolveUploadUrl,
  reviewMeterReading,
  reviewPayment,
  scheduleMoveOut,
  submitMeterReading,
  submitPayment,
  updateProperty,
  updateReminderStatus,
  updateSettlement,
};
