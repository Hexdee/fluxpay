export function createEntityId(prefix: string) {
  const token = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${token}`;
}

export function createSecret(prefix: string) {
  const token = Math.random().toString(36).slice(2);
  const suffix = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${token}${suffix}`;
}

export async function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }

  await navigator.clipboard.writeText(value);
  return true;
}

export function statusTone(value: string) {
  switch (value) {
    case 'succeeded':
    case 'active':
    case 'confirmed':
    case 'healthy':
    case 'delivered':
    case 'valid':
      return 'ok';
    case 'pending':
    case 'draft':
    case 'limited':
    case 'queued':
    case 'info':
      return 'info';
    case 'expired':
    case 'paused':
    case 'retrying':
    case 'rotating':
      return 'warn';
    case 'error':
    case 'failed':
    case 'invalid':
      return 'error';
    default:
      return 'info';
  }
}
