/**
 * Manual rate-limit blocks accept `u:<userId>` or `ip:<address>`. Operators type a
 * plain user id or IP, so normalise it into the stored shape and validate it.
 */
export const BLOCK_IDENTITY_PATTERN = /^(u:[a-zA-Z0-9-]+|ip:.+)$/;

export function normaliseBlockIdentity(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const prefixed = /^(u|ip):/i.exec(value);
  if (prefixed) {
    return `${prefixed[1].toLowerCase()}:${value.slice(prefixed[0].length).trim()}`;
  }
  // IP literals contain dots or colons; everything else is treated as a user id.
  return /[.:]/.test(value) ? `ip:${value}` : `u:${value}`;
}

export function isValidBlockIdentity(raw: string): boolean {
  return BLOCK_IDENTITY_PATTERN.test(normaliseBlockIdentity(raw));
}
