export declare function encrypt(plaintext: string, hexKey: string): string;
export declare function decrypt(encryptedBase64: string, hexKey: string): string;
export declare function sha256(data: Buffer | string): string;
export declare function generateSecureToken(bytes?: number): string;
export declare function hashToken(token: string): string;
export declare function generateIdempotencyKey(prefix: string): string;
export declare function maskSensitive(value: string, visibleChars?: number): string;
