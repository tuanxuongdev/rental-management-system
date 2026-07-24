'use client';

import { useQuery } from '@tanstack/react-query';

import { useMe } from '@/features/admin';
import { listDeposits, type ListDepositsOptions } from '@/lib/billing-api';
import { useAuthStore } from '@/state/auth-store';

export function depositsQueryKey(
  organizationId: string,
  filters?: Pick<ListDepositsOptions, 'leaseId' | 'propertyId' | 'status'>,
) {
  return ['finance', 'deposits', 'list', organizationId, filters ?? {}] as const;
}

export function useDeposits(
  filters?: Pick<ListDepositsOptions, 'leaseId' | 'propertyId' | 'status'>,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: depositsQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listDeposits(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}
