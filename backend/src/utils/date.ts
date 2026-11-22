import { SALON_TIMEZONE } from '@velora/shared';

/**
 * Returns today's date in 'YYYY-MM-DD' formatted strictly in the salon timezone (Asia/Kolkata).
 */
export function getSalonDateString(date: Date = new Date(), timezone: string = SALON_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Generates an unguessable, URL-safe random string for customer tracking (public_id).
 */
export function generatePublicId(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
