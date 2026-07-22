import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

import { API_CONFIG } from '../../bootstrap/api-config.module';

import type { ApiConfig } from '../../bootstrap/configuration';

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const MFA_SECRET_PREFIX = 'enc:v1:' as const;

@Injectable()
export class PasswordHasherService {
  async hashPassword(plaintext: string): Promise<string> {
    return hash(plaintext, ARGON2_OPTIONS);
  }

  async verifyPassword(plaintext: string, passwordHash: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plaintext, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }

  validatePolicy(password: string): { valid: boolean; message?: string } {
    if (password.length < 12) {
      return { valid: false, message: 'Password must be at least 12 characters' };
    }
    if (password.length > 128) {
      return { valid: false, message: 'Password must be at most 128 characters' };
    }
    return { valid: true };
  }
}

@Injectable()
export class TokenHashService {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    const pepper = this.config.auth.tokenHashPepper;
    return createHash('sha256').update(`${pepper}:${token}`).digest('hex');
  }

  hashIp(ip: string | undefined): string | undefined {
    if (ip === undefined || ip.length === 0) {
      return undefined;
    }
    const pepper = this.config.auth.tokenHashPepper;
    return createHash('sha256').update(`${pepper}:ip:${ip}`).digest('hex').slice(0, 32);
  }
}

@Injectable()
export class SecretEncryptionService {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  private key(): Buffer {
    return createHash('sha256').update(`mfa:${this.config.auth.tokenHashPepper}`).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${MFA_SECRET_PREFIX}${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
  }

  decrypt(value: string): string {
    if (!value.startsWith(MFA_SECRET_PREFIX)) {
      // Legacy plaintext values (tests / pre-migration rows).
      return value;
    }

    const payload = value.slice(MFA_SECRET_PREFIX.length);
    const [ivPart, cipherPart, tagPart] = payload.split('.');
    if (ivPart === undefined || cipherPart === undefined || tagPart === undefined) {
      throw new Error('Invalid encrypted secret format');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  timingSafeEqualHex(left: string, right: string): boolean {
    const leftBuf = Buffer.from(left);
    const rightBuf = Buffer.from(right);
    if (leftBuf.length !== rightBuf.length) {
      return false;
    }
    return timingSafeEqual(leftBuf, rightBuf);
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function slugifyOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
