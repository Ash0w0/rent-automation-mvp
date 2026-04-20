const COUNTRY_PHONE_OPTIONS = [
  { iso: 'IN', flag: '🇮🇳', label: 'India', dialCode: '+91', minLength: 10, maxLength: 10 },
  { iso: 'US', flag: '🇺🇸', label: 'United States', dialCode: '+1', minLength: 10, maxLength: 10 },
  { iso: 'CA', flag: '🇨🇦', label: 'Canada', dialCode: '+1', minLength: 10, maxLength: 10 },
  { iso: 'GB', flag: '🇬🇧', label: 'United Kingdom', dialCode: '+44', minLength: 10, maxLength: 10 },
  { iso: 'AE', flag: '🇦🇪', label: 'UAE', dialCode: '+971', minLength: 9, maxLength: 9 },
  { iso: 'AU', flag: '🇦🇺', label: 'Australia', dialCode: '+61', minLength: 9, maxLength: 9 },
  { iso: 'SG', flag: '🇸🇬', label: 'Singapore', dialCode: '+65', minLength: 8, maxLength: 8 },
];

const DEFAULT_DIAL_CODE = '+91';

function getCountryByDialCode(dialCode) {
  return COUNTRY_PHONE_OPTIONS.find((option) => option.dialCode === dialCode) || COUNTRY_PHONE_OPTIONS[0];
}

function normalizePhoneForCountry(phone, dialCode = DEFAULT_DIAL_CODE) {
  const raw = String(phone || '').trim();
  if (raw.startsWith('+')) {
    const internationalDigits = raw.slice(1).replace(/\D+/g, '');
    if (internationalDigits.length >= 8 && internationalDigits.length <= 15) {
      return `+${internationalDigits}`;
    }
    return null;
  }

  const normalizedDialCode = `+${String(dialCode || '').replace(/\D+/g, '')}`;
  if (normalizedDialCode === '+') {
    return null;
  }

  const digits = raw.replace(/\D+/g, '');
  if (!digits) {
    return null;
  }

  const dialDigits = normalizedDialCode.slice(1);
  const localDigits =
    digits.startsWith(dialDigits) && digits.length > dialDigits.length
      ? digits.slice(dialDigits.length)
      : digits;
  const country = getCountryByDialCode(normalizedDialCode);

  if (localDigits.length < country.minLength || localDigits.length > country.maxLength) {
    return null;
  }

  return `${normalizedDialCode}${localDigits}`;
}

function buildPhoneValidationMessage(dialCode) {
  const country = getCountryByDialCode(dialCode);
  return `Enter a valid ${country.minLength}-${country.maxLength} digit mobile number to continue.`;
}

module.exports = {
  buildPhoneValidationMessage,
  COUNTRY_PHONE_OPTIONS,
  DEFAULT_DIAL_CODE,
  getCountryByDialCode,
  normalizePhoneForCountry,
};
