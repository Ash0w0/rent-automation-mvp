const twilio = require('twilio');
const { normalizePhoneNumber } = require('./phoneUtils');

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) {
    return '[empty]';
  }

  return `***${digits.slice(-4)}`;
}

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_VERIFY_SERVICE_SID &&
      (
        process.env.TWILIO_AUTH_TOKEN ||
        (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)
      ),
  );
}

function createTwilioClient() {
  const authMode = process.env.TWILIO_AUTH_TOKEN ? 'account_sid_auth_token' : 'api_key';
  console.log('[twilio] creating client', {
    authMode,
    hasAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    hasVerifyServiceSid: Boolean(process.env.TWILIO_VERIFY_SERVICE_SID),
    hasAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    hasApiKeySid: Boolean(process.env.TWILIO_API_KEY_SID),
    hasApiKeySecret: Boolean(process.env.TWILIO_API_KEY_SECRET),
  });

  const timeoutMs = Number(process.env.TWILIO_REQUEST_TIMEOUT_MS || 60000);
  const maxRetries = Number(process.env.TWILIO_MAX_RETRIES || 1);
  const options = {
    timeout: timeoutMs,
    autoRetry: maxRetries > 0,
    maxRetries,
  };

  if (process.env.TWILIO_AUTH_TOKEN) {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, options);
  }

  return twilio(process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    ...options,
  });
}

async function startPhoneVerification(phone) {
  if (!isTwilioConfigured()) {
    throw new Error('Twilio Verify is not configured on the server yet.');
  }

  const client = createTwilioClient();
  const normalizedPhone = normalizePhoneNumber(phone);
  console.log('[twilio] starting phone verification', {
    to: maskPhone(normalizedPhone),
    serviceSidSuffix: process.env.TWILIO_VERIFY_SERVICE_SID?.slice(-6) || null,
  });

  try {
    const response = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: normalizedPhone,
        channel: 'sms',
      });

    console.log('[twilio] verification started', {
      sid: response.sid,
      status: response.status,
      to: maskPhone(response.to),
    });

    return response;
  } catch (error) {
    console.log('[twilio] verification start failed', {
      to: maskPhone(normalizedPhone),
      status: error?.status || null,
      code: error?.code || null,
      message: error?.message || String(error),
      moreInfo: error?.moreInfo || null,
    });
    throw error;
  }
}

async function checkPhoneVerification(phone, code) {
  if (!isTwilioConfigured()) {
    throw new Error('Twilio Verify is not configured on the server yet.');
  }

  const client = createTwilioClient();
  const normalizedPhone = normalizePhoneNumber(phone);
  const normalizedCode = String(code || '').trim();
  console.log('[twilio] checking phone verification', {
    to: maskPhone(normalizedPhone),
    codeLength: normalizedCode.length,
    serviceSidSuffix: process.env.TWILIO_VERIFY_SERVICE_SID?.slice(-6) || null,
  });

  try {
    const response = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: normalizedPhone,
        code: normalizedCode,
      });

    console.log('[twilio] verification check result', {
      to: maskPhone(normalizedPhone),
      status: response.status,
      valid: response.valid,
    });

    return response;
  } catch (error) {
    console.log('[twilio] verification check failed', {
      to: maskPhone(normalizedPhone),
      status: error?.status || null,
      code: error?.code || null,
      message: error?.message || String(error),
      moreInfo: error?.moreInfo || null,
    });
    throw error;
  }
}

module.exports = {
  checkPhoneVerification,
  isTwilioConfigured,
  normalizePhoneNumber,
  startPhoneVerification,
};
