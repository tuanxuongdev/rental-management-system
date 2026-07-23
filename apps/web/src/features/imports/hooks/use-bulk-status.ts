'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { BulkUnitStatusRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { bulkUnitStatus } from '@/lib/imports-api';
import { useAuthStore } from '@/state/auth-store';

export function useBulkUnitStatus() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: BulkUnitStatusRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return bulkUnitStatus(accessToken, organizationId, body);
    },
    onSuccess: async (_result, variables) => {
      if (!organizationId || variables.mode !== 'COMMIT') {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'units', organizationId],
      });
    },
  });
}
