'use client';

import { useMutation } from '@tanstack/react-query';

import type { CreateExportRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { createExport } from '@/lib/imports-api';
import { useAuthStore } from '@/state/auth-store';

export function useCreateExport() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useMutation({
    mutationFn: (body?: Partial<CreateExportRequest>) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createExport(accessToken, organizationId, body ?? {});
    },
  });
}
