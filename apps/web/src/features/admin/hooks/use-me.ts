'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchMe } from '@/lib/auth-api';
import { useAuthStore } from '@/state/auth-store';

export const meQueryKey = ['me'] as const;

export function useMe() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Not authenticated');
      }
      return fetchMe(accessToken);
    },
    enabled: Boolean(accessToken),
  });
}
