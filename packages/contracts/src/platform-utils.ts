import { createHash } from 'node:crypto';

export type CursorPayload = {
  sortKey: string;
  direction: 'forward' | 'backward';
};

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sortKey' in parsed &&
      'direction' in parsed &&
      typeof (parsed as CursorPayload).sortKey === 'string' &&
      ((parsed as CursorPayload).direction === 'forward' ||
        (parsed as CursorPayload).direction === 'backward')
    ) {
      return parsed as CursorPayload;
    }
    throw new Error('Invalid cursor payload');
  } catch {
    throw new Error('CURSOR_INVALID');
  }
}

export function hashCanonicalJson(value: unknown): string {
  const canonical = JSON.stringify(value);
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildOrganizationObjectKey(organizationId: string, relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, '');
  if (normalized.includes('..')) {
    throw new Error('Relative object path must not contain parent segments');
  }
  return `org/${organizationId}/${normalized}`;
}
