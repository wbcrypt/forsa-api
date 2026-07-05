import { BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Shared argon2id password hashing config — matches what UsersService /
 * AuthService already use. Kept here so new call sites (student/guarantor
 * self-registration, T-101/T-102) don't drift from the established config.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

/**
 * Same complexity rule enforced for staff accounts
 * (UsersService.validatePasswordComplexity) — min 12 chars, upper+lower+
 * digit+special. Self-registered portal accounts must meet the same bar.
 */
export function validatePasswordComplexity(password: string, minLength = 12): void {
  if (password.length < minLength) {
    throw new BadRequestException(`Password must be at least ${minLength} characters`);
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecial) {
    throw new BadRequestException(
      'Password must contain uppercase, lowercase, digit, and special character',
    );
  }
}
