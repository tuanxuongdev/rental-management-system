'use client';

import { useMutation } from '@tanstack/react-query';

import type { ResidentDuplicateCheckRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { checkResidentDuplicates } from '@/lib/residents-api';
import { useAuthStore } from '@/state/auth-store';

export function useDuplicateCheck() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useMutation({
    mutationFn: (body: ResidentDuplicateCheckRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return checkResidentDuplicates(accessToken, organizationId, body);
    },
  });
}
