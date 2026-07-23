'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateBuildingRequest, PatchBuildingRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import { createBuilding, listBuildings, patchBuilding } from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';

export function buildingsQueryKey(organizationId: string, propertyId: string) {
  return ['inventory', 'buildings', organizationId, propertyId] as const;
}

export function useBuildings(propertyId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: buildingsQueryKey(organizationId ?? 'none', propertyId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listBuildings(accessToken, organizationId, propertyId);
    },
    enabled: Boolean(accessToken && organizationId && propertyId),
  });
}

export function useCreateBuilding(propertyId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateBuildingRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createBuilding(accessToken, organizationId, propertyId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: buildingsQueryKey(organizationId, propertyId),
      });
    },
  });
}

export function usePatchBuilding(propertyId: string, buildingId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchBuildingRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchBuilding(accessToken, organizationId, buildingId, input.body, input.version);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: buildingsQueryKey(organizationId, propertyId),
      });
    },
  });
}
