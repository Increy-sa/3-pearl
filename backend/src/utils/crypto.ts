/**
 * AES-256-CBC Encryption Utility
 * 
 * Used to encrypt sensitive store credentials (passwords) before
 * persisting to the database. Only ADMIN and DEVELOPER roles
 * are authorized to decrypt these values via the API.
 * 
 * SECURITY: No fallback keys. The server will refuse to start
 * if ENCRYPTION_KEY is not set in .env.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '❌ CRITICAL: ENCRYPTION_KEY is not defined in environment variables.\n' +
      '   Add ENCRYPTION_KEY="your-32-char-secret" to your .env file.\n' +
      '   The server cannot encrypt/decrypt credentials without this key.'
    );
  }
  // Derive exactly 32 bytes for AES-256 via SHA-256 hash
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a combined string: `iv_hex:encrypted_hex`
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string.
 * Expects format: `iv_hex:encrypted_hex`
 */
export function decrypt(encryptedText: string): string {
  const key = getKey();
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted text format. Expected "iv_hex:encrypted_hex".');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Validate that the encryption key is available at startup.
 * Call this during server boot to fail fast.
 */
export function validateEncryptionKey(): void {
  getKey(); // Will throw if missing
  console.log('🔐 ENCRYPTION_KEY validated — AES-256-CBC ready.');
}
