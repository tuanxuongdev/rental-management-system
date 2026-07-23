'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateBedRequest, PatchBedRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { createBed, listBeds, patchBed } from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';

export function bedsQueryKey(organizationId: string, unitId: string) {
  return ['inventory', 'beds', organizationId, unitId] as const;
}

export function useBeds(unitId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: bedsQueryKey(organizationId ?? 'none', unitId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listBeds(accessToken, organizationId, unitId);
    },
    enabled: Boolean(accessToken && organizationId && unitId),
  });
}

export function useCreateBed(unitId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateBedRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createBed(accessToken, organizationId, unitId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: bedsQueryKey(organizationId, unitId) });
    },
  });
}

export function usePatchBed(unitId: string, bedId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchBedRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchBed(accessToken, organizationId, bedId, input.body, input.version);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: bedsQueryKey(organizationId, unitId) });
    },
  });
}
