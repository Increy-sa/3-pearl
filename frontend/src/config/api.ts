/**
 * Centralized API configuration.
 * Uses VITE_API_URL from environment variables.
 * Falls back to localhost for development.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'https://fawri.net';
