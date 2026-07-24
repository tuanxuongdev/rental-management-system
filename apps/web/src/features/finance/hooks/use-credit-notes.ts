'use client';

import { useQuery } from '@tanstack/react-query';

import { useMe } from '@/features/admin';
import { listCreditNotes } from '@/lib/billing-api';
import { useAuthStore } from '@/state/auth-store';

export function creditNotesQueryKey(organizationId: string) {
  return ['finance', 'credit-notes', 'list', organizationId] as const;
}

export function useCreditNotes() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: creditNotesQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listCreditNotes(accessToken, organizationId, { limit: 50 });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}
