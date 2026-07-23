'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreatePropertyRequest, PatchPropertyRequest, PropertyResponse } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  archiveProperty,
  createProperty,
  getProperty,
  listProperties,
  patchProperty,
} from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';

export function propertiesQueryKey(organizationId: string) {
  return ['inventory', 'properties', organizationId] as const;
}

export function propertyQueryKey(organizationId: string, propertyId: string) {
  return ['inventory', 'properties', organizationId, propertyId] as const;
}

/** Full org properties catalog (not filtered by shell Property scope). */
export function useProperties() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: propertiesQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listProperties(accessToken, organizationId, { limit: 100 });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useProperty(propertyId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: propertyQueryKey(organizationId ?? 'none', propertyId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getProperty(accessToken, organizationId, propertyId);
    },
    enabled: Boolean(accessToken && organizationId && propertyId),
  });
}

export function useCreateProperty() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePropertyRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createProperty(accessToken, organizationId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: propertiesQueryKey(organizationId) });
    },
  });
}

export function usePatchProperty(propertyId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchPropertyRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchProperty(accessToken, organizationId, propertyId, input.body, input.version);
    },
    onSuccess: async (result: PropertyResponse) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: propertiesQueryKey(organizationId) });
      await queryClient.invalidateQueries({
        queryKey: propertyQueryKey(organizationId, result.id),
      });
    },
  });
}

export function useArchiveProperty(propertyId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return archiveProperty(accessToken, organizationId, propertyId);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: propertiesQueryKey(organizationId) });
      await queryClient.invalidateQueries({
        queryKey: propertyQueryKey(organizationId, propertyId),
      });
    },
  });
}
