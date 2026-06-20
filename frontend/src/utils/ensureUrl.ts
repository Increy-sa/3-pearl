/**
 * Ensures an external URL has a protocol prefix (https://).
 * Prevents the browser from treating it as a relative path
 * (e.g. "ahmed.com" → "https://ahmed.com" instead of "localhost:5173/ahmed.com").
 */
export function ensureUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://' + url;
}
