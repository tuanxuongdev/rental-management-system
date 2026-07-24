'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MeterReadingBulkRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { bulkMeterReadings, listMeters, type ListMetersOptions } from '@/lib/billing-api';
import { useAuthStore } from '@/state/auth-store';

export function metersQueryKey(
  organizationId: string,
  filters?: Pick<ListMetersOptions, 'propertyId' | 'status'>,
) {
  return ['finance', 'meters', 'list', organizationId, filters ?? {}] as const;
}

export function useMeters(filters?: Pick<ListMetersOptions, 'propertyId' | 'status'>) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: metersQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listMeters(accessToken, organizationId, { limit: 100, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useBulkMeterReadings() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: MeterReadingBulkRequest; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return bulkMeterReadings(
        accessToken,
        organizationId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'meters', 'list', organizationId],
      });
    },
  });
}
