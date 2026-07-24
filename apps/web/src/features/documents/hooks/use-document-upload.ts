'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useMe } from '@/features/admin';
import {
  completeDocumentUpload,
  createUploadIntent,
  fileToBase64,
  sha256Hex,
  uploadFileToIntent,
} from '@/lib/documents-api';
import { useAuthStore } from '@/state/auth-store';

import { documentQueryKey } from './use-documents';

export type DocumentUploadInput = {
  title: string;
  category: string;
  file: File;
  /** Party id for resident link (contracts use partyId, not resident profile id). */
  partyId?: string;
  propertyId?: string;
  leaseId?: string;
};

export function useDocumentUpload() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DocumentUploadInput) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }

      const checksumSha256 = await sha256Hex(input.file);
      const contentBase64 = await fileToBase64(input.file);

      const intent = await createUploadIntent(accessToken, organizationId, {
        title: input.title.trim(),
        category: input.category.trim(),
        fileName: input.file.name,
        mimeType: input.file.type || 'application/octet-stream',
        sizeBytes: input.file.size,
        checksumSha256,
        partyId: input.partyId,
        propertyId: input.propertyId,
        leaseId: input.leaseId,
        linkType: input.leaseId
          ? 'LEASE'
          : input.partyId
            ? 'RESIDENT'
            : input.propertyId
              ? 'PROPERTY'
              : undefined,
        contentBase64,
      });

      if (intent.uploadUrl) {
        await uploadFileToIntent(intent.uploadUrl, input.file);
      }

      const completed = await completeDocumentUpload(
        accessToken,
        organizationId,
        intent.document.id,
        {
          versionId: intent.versionId,
          checksumSha256,
          sizeBytes: input.file.size,
          contentBase64: intent.uploadUrl ? undefined : contentBase64,
        },
      );

      return completed ?? intent.document;
    },
    onSuccess: async (document) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['documents', 'list', organizationId] });
      await queryClient.invalidateQueries({
        queryKey: documentQueryKey(organizationId, document.id),
      });
    },
  });
}
