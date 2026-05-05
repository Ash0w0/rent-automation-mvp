export function formatInvoiceStateLabel(status) {
  const labels = {
    DUE: 'Bill ready',
    OVERDUE: 'Overdue',
    PAYMENT_SUBMITTED: 'Pending approval',
    PAID: 'Paid',
    ISSUED: 'Bill ready',
    DRAFT: 'Draft',
  };
  return labels[status] || String(status || 'Pending').replaceAll('_', ' ');
}

export function formatMeterStateLabel(status) {
  const labels = {
    PENDING_REVIEW: 'Pending approval',
    APPROVED: 'Approved',
    REJECTED: 'Resubmit',
  };
  return labels[status] || String(status || 'Pending').replaceAll('_', ' ');
}

export function formatSubmissionStateLabel(status) {
  const labels = {
    PENDING_REVIEW: 'Pending approval',
    APPROVED: 'Approved',
    REJECTED: 'Resubmit',
  };
  return labels[status] || String(status || 'Pending').replaceAll('_', ' ');
}
