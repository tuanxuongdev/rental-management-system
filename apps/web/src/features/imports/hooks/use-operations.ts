'use client';

import { useQuery } from '@tanstack/react-query';

import { useMe } from '@/features/admin';
import { listOperations } from '@/lib/imports-api';
import { useAuthStore } from '@/state/auth-store';

export function operationsQueryKey(organizationId: string) {
  return ['imports', 'operations', organizationId] as const;
}

export function useOperations(options?: { limit?: number }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: [...operationsQueryKey(organizationId ?? 'none'), options?.limit ?? 25] as const,
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listOperations(accessToken, organizationId, { limit: options?.limit ?? 25 });
    },
    enabled: Boolean(accessToken && organizationId),
    refetchInterval: 5_000,
  });
}
