import { API_URL } from '../config/api';

/**
 * Check if the API itself is running locally.
 * If API_URL points to fawri.net, then files are on the server
 * even if the browser is on localhost.
 */
const isApiLocal = API_URL.includes('localhost') || API_URL.includes('127.0.0.1');

/**
 * Normalize a URL stored in the database.
 *
 * If API points to production (fawri.net):
 *   - Converts localhost URLs → API_URL (files are on the server)
 *   - Converts relative paths → full API_URL
 *
 * If API points to localhost (true local dev):
 *   - Keeps localhost URLs as-is (files are on your machine)
 *   - Converts relative paths → http://localhost:5000
 *
 * Returns null for invalid/empty URLs so the UI can hide the link.
 */
export const normalizeUrl = (url: string | null | undefined): string | null => {
  if (!url || url === '#' || url === 'about:blank' || url.trim() === '') return null;

  // data: and blob: URIs are valid inline content (e.g. SVG logos) — keep as-is
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  // Relative path → prepend appropriate base
  if (url.startsWith('/uploads/') || url.startsWith('/api/')) {
    if (isApiLocal) {
      return `http://localhost:5000${url}`;
    }
    return `${API_URL}${url}`;
  }

  // localhost URL
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    if (isApiLocal) {
      // True local dev — files are on your machine
      return url;
    }
    // API is on production server — replace localhost with API_URL
    try {
      const parsed = new URL(url);
      return `${API_URL}${parsed.pathname}${parsed.search}`;
    } catch {
      return null;
    }
  }

  // Already a full external URL (e.g. https://fawri.net/uploads/...)
  return url;
};
