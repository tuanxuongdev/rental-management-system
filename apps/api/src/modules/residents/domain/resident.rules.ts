import { createHash } from 'node:crypto';

/** Normalize email for duplicate matching (trim + lower). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Digits-only phone normalize; strip leading US country code when present. */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export function isEmailContactType(type: string): boolean {
  return type.trim().toLowerCase() === 'email';
}

export function isPhoneContactType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return normalized === 'phone' || normalized === 'mobile' || normalized === 'tel';
}

export function normalizeContactValue(type: string, value: string): string {
  if (isEmailContactType(type)) {
    return normalizeEmail(value);
  }
  if (isPhoneContactType(type)) {
    return normalizePhone(value);
  }
  return value.trim();
}

/** SHA-256 hex of normalized identifier for duplicate lookup (never store plaintext as hash input without normalize). */
export function identifierLookupHash(identifierType: string, value: string): string {
  const normalized = `${identifierType.trim().toLowerCase()}:${value.trim().toUpperCase()}`;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** Local KEK placeholder — base64 encode until vault integration. */
export function encryptIdentifierValue(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

/**
 * Mask DOB as ****-**-dd when day is known; otherwise age-band style ****-**-**.
 */
export function maskDateOfBirth(date: Date | null | undefined): string | null {
  if (date === null || date === undefined) {
    return null;
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `****-**-${day}`;
}

/** Mask identifier showing only last 4 characters. */
export function maskIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return '****';
  }
  return `${'*'.repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export type DuplicateMatchInput = {
  emails: string[];
  phones: string[];
  identifierHashes: string[];
};

export function collectNormalizedContacts(
  contacts: Array<{ type: string; value: string }> | undefined,
): { emails: string[]; phones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  for (const contact of contacts ?? []) {
    if (isEmailContactType(contact.type)) {
      emails.push(normalizeEmail(contact.value));
    } else if (isPhoneContactType(contact.type)) {
      phones.push(normalizePhone(contact.value));
    }
  }
  return { emails, phones };
}
