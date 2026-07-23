'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreatePropertyOwnerRequest, PatchPropertyOwnerRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  createPropertyOwner,
  getPropertyOwner,
  listPropertyOwners,
  patchPropertyOwner,
} from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';

export function propertyOwnersQueryKey(organizationId: string) {
  return ['parties', 'property-owners', organizationId] as const;
}

export function propertyOwnerQueryKey(organizationId: string, ownerId: string) {
  return ['parties', 'property-owners', organizationId, ownerId] as const;
}

export function usePropertyOwners() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: propertyOwnersQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listPropertyOwners(accessToken, organizationId, { limit: 100 });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function usePropertyOwner(ownerId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: propertyOwnerQueryKey(organizationId ?? 'none', ownerId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getPropertyOwner(accessToken, organizationId, ownerId);
    },
    enabled: Boolean(accessToken && organizationId && ownerId),
  });
}

export function useCreatePropertyOwner() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePropertyOwnerRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createPropertyOwner(accessToken, organizationId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: propertyOwnersQueryKey(organizationId),
      });
    },
  });
}

export function usePatchPropertyOwner(ownerId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchPropertyOwnerRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchPropertyOwner(accessToken, organizationId, ownerId, input.body, input.version);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: propertyOwnersQueryKey(organizationId),
      });
      await queryClient.invalidateQueries({
        queryKey: propertyOwnerQueryKey(organizationId, ownerId),
      });
    },
  });
}
