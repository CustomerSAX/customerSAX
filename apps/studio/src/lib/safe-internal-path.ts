export function safeInternalAppPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  return '/';
}
