'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateLeaseRequest, LeaseResponse } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { createLease, listLeases, type ListLeasesOptions } from '@/lib/leases-api';
import { useAuthStore } from '@/state/auth-store';

export function leasesQueryKey(
  organizationId: string,
  filters?: Pick<ListLeasesOptions, 'q' | 'status' | 'propertyId' | 'residentId'>,
) {
  return ['leases', 'list', organizationId, filters ?? {}] as const;
}

export function useLeases(
  filters?: Pick<ListLeasesOptions, 'q' | 'status' | 'propertyId' | 'residentId'>,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: leasesQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listLeases(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useCreateLease() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateLeaseRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createLease(accessToken, organizationId, body);
    },
    onSuccess: async (result: LeaseResponse) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['leases', 'list', organizationId] });
      await queryClient.invalidateQueries({
        queryKey: ['leases', 'detail', organizationId, result.id],
      });
    },
  });
}
