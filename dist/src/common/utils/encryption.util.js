"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.sha256 = sha256;
exports.generateSecureToken = generateSecureToken;
exports.hashToken = hashToken;
exports.generateIdempotencyKey = generateIdempotencyKey;
exports.maskSensitive = maskSensitive;
const crypto = __importStar(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
function encrypt(plaintext, hexKey) {
    if (!plaintext)
        return plaintext;
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
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
}
function decrypt(encryptedBase64, hexKey) {
    if (!encryptedBase64)
        return encryptedBase64;
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
function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
function generateSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
function generateIdempotencyKey(prefix) {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(16).toString('hex');
    return `${prefix}:${timestamp}:${random}`;
}
function maskSensitive(value, visibleChars = 4) {
    if (!value || value.length <= visibleChars * 2)
        return '***';
    return `${value.substring(0, visibleChars)}***${value.substring(value.length - visibleChars)}`;
}
//# sourceMappingURL=encryption.util.js.map