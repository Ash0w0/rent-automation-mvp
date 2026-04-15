function pad(value) {
  return String(value).padStart(2, '0');
}

function parseIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
}

function getTodayIso() {
  return toIsoDate(new Date());
}

function getDaysInMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function clampDueDay(monthKey, dueDay) {
  return Math.min(Math.max(Number(dueDay) || 1, 1), getDaysInMonth(monthKey));
}

function shiftIsoDate(dateString, dayDelta) {
  const next = parseIsoDate(dateString);
  next.setDate(next.getDate() + dayDelta);
  return toIsoDate(next);
}

function compareIsoDates(left, right) {
  return parseIsoDate(left).getTime() - parseIsoDate(right).getTime();
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseIsoDate(dateString));
}

function formatMonth(monthKey) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(parseIsoDate(`${monthKey}-01`));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function toMonthKey(dateString) {
  return dateString.slice(0, 7);
}

module.exports = {
  clampDueDay,
  compareIsoDates,
  formatCurrency,
  formatDate,
  formatMonth,
  getDaysInMonth,
  getTodayIso,
  pad,
  parseIsoDate,
  shiftIsoDate,
  toIsoDate,
  toMonthKey,
};
