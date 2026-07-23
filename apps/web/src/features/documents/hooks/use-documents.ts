'use client';

import { useQuery } from '@tanstack/react-query';

import { useMe } from '@/features/admin';
import { getDocument, listDocuments, type ListDocumentsOptions } from '@/lib/documents-api';
import { useAuthStore } from '@/state/auth-store';

export function documentsQueryKey(
  organizationId: string,
  filters?: Pick<ListDocumentsOptions, 'q' | 'category' | 'status' | 'propertyId' | 'residentId'>,
) {
  return ['documents', 'list', organizationId, filters ?? {}] as const;
}

export function documentQueryKey(organizationId: string, documentId: string) {
  return ['documents', 'detail', organizationId, documentId] as const;
}

export function useDocuments(
  filters?: Pick<ListDocumentsOptions, 'q' | 'category' | 'status' | 'propertyId' | 'residentId'>,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: documentsQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listDocuments(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useDocument(documentId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: documentQueryKey(organizationId ?? 'none', documentId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getDocument(accessToken, organizationId, documentId);
    },
    enabled: Boolean(accessToken && organizationId && documentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'UPLOADING' || status === 'SCANNING') {
        return 2_000;
      }
      return false;
    },
  });
}
