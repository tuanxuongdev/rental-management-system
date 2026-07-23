'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateImportRequest, ImportJobStatus } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  commitImport,
  createImport,
  dryRunImport,
  getImport,
  getImportErrors,
  getInventoryTemplate,
} from '@/lib/imports-api';
import { useAuthStore } from '@/state/auth-store';

const TERMINAL_IMPORT_STATUSES: ReadonlySet<ImportJobStatus> = new Set([
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export function importJobQueryKey(organizationId: string, importId: string) {
  return ['imports', 'job', organizationId, importId] as const;
}

export function useInventoryTemplate() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: ['imports', 'template', organizationId ?? 'none'] as const,
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getInventoryTemplate(accessToken, organizationId);
    },
    enabled: false,
  });
}

export function useCreateImport() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useMutation({
    mutationFn: (body: CreateImportRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createImport(accessToken, organizationId, body);
    },
  });
}

export function useDryRunImport() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useMutation({
    mutationFn: (importId: string) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return dryRunImport(accessToken, organizationId, importId);
    },
  });
}

export function useCommitImport() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { importId: string; idempotencyKey: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return commitImport(accessToken, organizationId, input.importId, input.idempotencyKey);
    },
    onSuccess: async (job) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: importJobQueryKey(organizationId, job.id),
      });
      await queryClient.invalidateQueries({
        queryKey: ['imports', 'operations', organizationId],
      });
    },
  });
}

export function useImportJob(importId: string | null, options?: { poll?: boolean }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const poll = options?.poll ?? false;

  return useQuery({
    queryKey: importJobQueryKey(organizationId ?? 'none', importId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId || !importId) {
        throw new Error('Organization context required');
      }
      return getImport(accessToken, organizationId, importId);
    },
    enabled: Boolean(accessToken && organizationId && importId),
    refetchInterval: (query) => {
      if (!poll) {
        return false;
      }
      const status = query.state.data?.status;
      if (!status || TERMINAL_IMPORT_STATUSES.has(status)) {
        return false;
      }
      return 2_000;
    },
  });
}

export function useImportErrors() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useMutation({
    mutationFn: (importId: string) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getImportErrors(accessToken, organizationId, importId);
    },
  });
}
