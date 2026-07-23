'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ClearDoNotRentRequest, SetDoNotRentRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { clearDoNotRent, setDoNotRent } from '@/lib/residents-api';
import { useAuthStore } from '@/state/auth-store';

import { residentQueryKey } from './use-residents';

export function useSetDoNotRent(residentId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SetDoNotRentRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return setDoNotRent(accessToken, organizationId, residentId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: residentQueryKey(organizationId, residentId),
      });
      await queryClient.invalidateQueries({ queryKey: ['residents', 'list', organizationId] });
    },
  });
}

export function useClearDoNotRent(residentId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ClearDoNotRentRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return clearDoNotRent(accessToken, organizationId, residentId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: residentQueryKey(organizationId, residentId),
      });
      await queryClient.invalidateQueries({ queryKey: ['residents', 'list', organizationId] });
    },
  });
}
