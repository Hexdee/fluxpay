export function formatCurrency(amount: number, currency: string) {
  return `${amount.toFixed(2)} ${currency}`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatRelativeTime(value: string | null) {
  if (!value) return 'Pending';

  const now = Date.now();
  const diff = new Date(value).getTime() - now;
  const abs = Math.abs(diff);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (abs < hour) {
    return formatter.format(Math.round(diff / minute), 'minute');
  }

  if (abs < day) {
    return formatter.format(Math.round(diff / hour), 'hour');
  }

  return formatter.format(Math.round(diff / day), 'day');
}

export function formatStatusLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function clampAmount(value: string) {
  return value.replace(/[^0-9.]/g, '');
}
