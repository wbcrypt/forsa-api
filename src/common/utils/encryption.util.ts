import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The key must be a 32-byte (64 hex char) string.
 * Returns base64-encoded: IV + ciphertext + auth tag
 */
export function encrypt(plaintext: string, hexKey: string): string {
  if (!plaintext) return plaintext;

  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (64 hex characters)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: IV (16) + AuthTag (16) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded AES-256-GCM encrypted string.
 */
export function decrypt(encryptedBase64: string, hexKey: string): string {
  if (!encryptedBase64) return encryptedBase64;

  const key = Buffer.from(hexKey, 'hex');
  const combined = Buffer.from(encryptedBase64, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Creates a SHA-256 hash of the input (for file integrity verification)
 */
export function sha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Creates a secure random token
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hashes a token for safe database storage (one-way)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a globally unique idempotency key
 */
export function generateIdempotencyKey(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(16).toString('hex');
  return `${prefix}:${timestamp}:${random}`;
}

/**
 * Masks sensitive strings for logging (shows only first/last 4 chars)
 */
export function maskSensitive(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars * 2) return '***';
  return `${value.substring(0, visibleChars)}***${value.substring(value.length - visibleChars)}`;
}
