'use client';

import { useQuery } from '@tanstack/react-query';

import type { AvailabilityQuery } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { lookupAvailability } from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';

export function availabilityQueryKey(organizationId: string, query: AvailabilityQuery) {
  return ['inventory', 'availability', organizationId, query] as const;
}

export function useAvailability(query: AvailabilityQuery | null) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: availabilityQueryKey(
      organizationId ?? 'none',
      query ?? { propertyId: '00000000-0000-0000-0000-000000000000' },
    ),
    queryFn: () => {
      if (!accessToken || !organizationId || !query) {
        throw new Error('Organization context and property required');
      }
      return lookupAvailability(accessToken, organizationId, query);
    },
    enabled: Boolean(accessToken && organizationId && query?.propertyId),
  });
}
