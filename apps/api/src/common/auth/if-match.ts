import { HttpException, HttpStatus, PreconditionFailedException } from '@nestjs/common';

/** Versioned-write mismatch per API contract (412 VERSION_MISMATCH). */
export function throwVersionMismatch(message: string): never {
  throw new PreconditionFailedException({
    message,
    code: 'VERSION_MISMATCH',
  });
}

/** Parse If-Match header as a positive integer resource version (ETag or raw number). */
export function parseIfMatchVersion(header: string | string[] | undefined): number | undefined {
  if (header === undefined) {
    return undefined;
  }

  const raw = Array.isArray(header) ? header[0] : header;
  if (raw === undefined || raw.trim() === '' || raw.trim() === '*') {
    return undefined;
  }

  const unquoted = raw.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
  const parsed = Number.parseInt(unquoted, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

/** Require If-Match for versioned writes (Sprint-04 / API §7). */
export function requireIfMatchVersion(header: string | string[] | undefined): number {
  if (header === undefined || (Array.isArray(header) ? header[0] : header)?.trim() === '') {
    throw new HttpException(
      {
        message: 'If-Match header is required',
        code: 'PRECONDITION_REQUIRED',
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }

  const version = parseIfMatchVersion(header);
  if (version === undefined) {
    throw new PreconditionFailedException({
      message: 'If-Match header is invalid',
      code: 'PRECONDITION_FAILED',
    });
  }

  return version;
}
