function getDefaultDialCode() {
  return String(process.env.DEFAULT_DIAL_CODE || '+91').trim();
}

function normalizeDialCode(dialCode) {
  const raw = String(dialCode || '').trim();
  const digits = raw.replace(/\D+/g, '');
  if (!digits) {
    throw new Error('Invalid country dial code.');
  }

  return `+${digits}`;
}

function normalizePhoneNumber(phone, dialCode = getDefaultDialCode()) {
  const raw = String(phone || '').trim();
  if (raw.startsWith('+')) {
    const internationalDigits = raw.slice(1).replace(/\D+/g, '');
    if (internationalDigits.length >= 8 && internationalDigits.length <= 15) {
      return `+${internationalDigits}`;
    }
    throw new Error('Enter a valid mobile number including country context.');
  }

  const digits = raw.replace(/\D+/g, '');
  if (!digits) {
    throw new Error('Enter a valid mobile number including country context.');
  }

  const normalizedDialCode = normalizeDialCode(dialCode);
  const composed = `${normalizedDialCode}${digits}`;
  const composedDigits = composed.slice(1);
  if (composedDigits.length < 8 || composedDigits.length > 15) {
    throw new Error('Enter a valid mobile number including country context.');
  }

  return composed;
}

function tryNormalizePhoneNumber(phone) {
  try {
    return normalizePhoneNumber(phone);
  } catch (_error) {
    return null;
  }
}

function buildPhoneCandidates(phone, dialCode = getDefaultDialCode()) {
  const normalizedPhone = normalizePhoneNumber(phone, dialCode);
  const digits = normalizedPhone.slice(1);
  const dialDigits = normalizeDialCode(dialCode).slice(1);
  const localDigits =
    digits.startsWith(dialDigits) && digits.length > dialDigits.length
      ? digits.slice(dialDigits.length)
      : null;

  return Array.from(
    new Set(
      [
        normalizedPhone,
        digits,
        localDigits,
      ].filter(Boolean),
    ),
  );
}

module.exports = {
  buildPhoneCandidates,
  normalizeDialCode,
  normalizePhoneNumber,
  tryNormalizePhoneNumber,
};
