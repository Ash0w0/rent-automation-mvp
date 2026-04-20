const twilio = require('twilio');

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
  if (process.env.TWILIO_AUTH_TOKEN) {
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  return twilio(process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
  });
}

function normalizePhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (String(phone || '').startsWith('+')) {
    return String(phone).trim();
  }

  throw new Error('Enter a valid mobile number including country context.');
}

async function startPhoneVerification(phone) {
  if (!isTwilioConfigured()) {
    throw new Error('Twilio Verify is not configured on the server yet.');
  }

  const client = createTwilioClient();
  return client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({
      to: normalizePhoneNumber(phone),
      channel: 'sms',
    });
}

async function checkPhoneVerification(phone, code) {
  if (!isTwilioConfigured()) {
    throw new Error('Twilio Verify is not configured on the server yet.');
  }

  const client = createTwilioClient();
  const ab = client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({
      to: normalizePhoneNumber(phone),
      code: String(code || '').trim(),
    });
  console.log(ab, "ab")
  return client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({
      to: normalizePhoneNumber(phone),
      code: String(code || '').trim(),
    });
}

module.exports = {
  checkPhoneVerification,
  isTwilioConfigured,
  normalizePhoneNumber,
  startPhoneVerification,
};
