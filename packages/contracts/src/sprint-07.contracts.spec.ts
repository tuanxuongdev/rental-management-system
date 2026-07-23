import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_DOWNLOAD_TTL_DEFAULT_SECONDS,
  DOCUMENT_DOWNLOAD_TTL_MAX_SECONDS,
  DOCUMENT_MAX_SIZE_BYTES,
  DOCUMENT_PERMISSION_KEYS,
  ORGANIZATION_DOCUMENTS_PATH,
  ORGANIZATION_DOCUMENT_UPLOAD_INTENTS_PATH,
  ORGANIZATION_RESIDENTS_PATH,
  ORGANIZATION_RESIDENTS_DUPLICATE_CHECK_PATH,
  ORGANIZATION_WAITLIST_ENTRIES_PATH,
  RESIDENT_PERMISSION_KEYS,
  WAITLIST_PERMISSION_KEYS,
  completeUploadRequestSchema,
  createResidentRequestSchema,
  createWaitlistEntryRequestSchema,
  downloadUrlRequestSchema,
  residentDuplicateCheckRequestSchema,
  residentStatusSchema,
  setDoNotRentRequestSchema,
  uploadIntentRequestSchema,
  waitlistEntryStatusSchema,
} from './index';

describe('@rpm/contracts Sprint-07 residents + documents', () => {
  it('exposes path constants and permission keys from docs/06', () => {
    expect(ORGANIZATION_RESIDENTS_PATH).toBe('/v1/organizations/{organizationId}/residents');
    expect(ORGANIZATION_RESIDENTS_DUPLICATE_CHECK_PATH).toBe(
      '/v1/organizations/{organizationId}/residents/duplicate-check',
    );
    expect(ORGANIZATION_WAITLIST_ENTRIES_PATH).toBe(
      '/v1/organizations/{organizationId}/waitlist-entries',
    );
    expect(ORGANIZATION_DOCUMENTS_PATH).toBe('/v1/organizations/{organizationId}/documents');
    expect(ORGANIZATION_DOCUMENT_UPLOAD_INTENTS_PATH).toBe(
      '/v1/organizations/{organizationId}/documents/upload-intents',
    );

    expect(RESIDENT_PERMISSION_KEYS.LIST).toBe('residents.list');
    expect(RESIDENT_PERMISSION_KEYS.SENSITIVE_DATA_VIEW).toBe('residents.sensitive_data.view');
    expect(RESIDENT_PERMISSION_KEYS.DO_NOT_RENT_MANAGE).toBe('residents.do_not_rent.manage');
    expect(WAITLIST_PERMISSION_KEYS.VIEW).toBe('waitlist.view');
    expect(WAITLIST_PERMISSION_KEYS.REMOVE).toBe('waitlist.remove');
    expect(DOCUMENT_PERMISSION_KEYS.UPLOAD).toBe('documents.upload');
    expect(DOCUMENT_PERMISSION_KEYS.DELETE).toBe('documents.delete');
  });

  it('validates resident, waitlist, and document schemas', () => {
    expect(residentStatusSchema.parse('PROSPECT')).toBe('PROSPECT');
    expect(waitlistEntryStatusSchema.parse('OPEN')).toBe('OPEN');

    const created = createResidentRequestSchema.parse({
      displayName: 'Alex Resident',
      contacts: [{ type: 'email', value: 'alex@example.com' }],
    });
    expect(created.displayName).toBe('Alex Resident');

    const dup = residentDuplicateCheckRequestSchema.parse({
      email: 'alex@example.com',
      phone: '+1 (555) 010-2000',
    });
    expect(dup.email).toBe('alex@example.com');

    const flag = setDoNotRentRequestSchema.parse({ reason: 'Prior eviction' });
    expect(flag.reason).toBe('Prior eviction');

    const waitlist = createWaitlistEntryRequestSchema.parse({
      partyId: '00000000-0000-4000-8000-000000000001',
      propertyId: '00000000-0000-4000-8000-000000000002',
    });
    expect(waitlist.partyId).toBe('00000000-0000-4000-8000-000000000001');

    const intent = uploadIntentRequestSchema.parse({
      title: 'ID scan',
      category: 'IDENTITY',
      fileName: 'id.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
    });
    expect(intent.sizeBytes).toBe(1024);
    expect(DOCUMENT_MAX_SIZE_BYTES).toBe(25 * 1024 * 1024);

    const complete = completeUploadRequestSchema.parse({
      versionId: '00000000-0000-4000-8000-000000000010',
      checksumSha256: 'b'.repeat(64),
      sizeBytes: 1024,
    });
    expect(complete.versionId).toBe('00000000-0000-4000-8000-000000000010');

    const download = downloadUrlRequestSchema.parse({ expiresInSeconds: 60 });
    expect(download.expiresInSeconds).toBe(60);
    expect(DOCUMENT_DOWNLOAD_TTL_DEFAULT_SECONDS).toBe(300);
    expect(DOCUMENT_DOWNLOAD_TTL_MAX_SECONDS).toBe(900);
  });
});
