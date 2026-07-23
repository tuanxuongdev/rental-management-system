'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateUnitRequest,
  PatchUnitRequest,
  UnitResponse,
  UnitStatusRequest,
  UnitsCollection,
} from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  archiveUnit,
  createUnit,
  getUnit,
  listUnitsOrg,
  patchUnit,
  updateUnitOperationalStatus,
} from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';
import { usePropertyScopeStore } from '@/state/property-scope-store';

const UNITS_PAGE_SIZE = 50;

export function unitsQueryKey(organizationId: string, scopeKey: string) {
  return ['inventory', 'units', organizationId, scopeKey] as const;
}

export function unitQueryKey(organizationId: string, unitId: string) {
  return ['inventory', 'units', organizationId, 'detail', unitId] as const;
}

export function useUnits(propertyIdOverride?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const effectiveScope = propertyIdOverride ?? propertyScope;

  return useInfiniteQuery({
    queryKey: unitsQueryKey(organizationId ?? 'none', effectiveScope),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<UnitsCollection> => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }

      return listUnitsOrg(accessToken, organizationId, {
        limit: UNITS_PAGE_SIZE,
        ...(pageParam !== undefined ? { after: pageParam } : {}),
        ...(effectiveScope !== 'ALL' ? { propertyId: effectiveScope } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useUnit(unitId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: unitQueryKey(organizationId ?? 'none', unitId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getUnit(accessToken, organizationId, unitId);
    },
    enabled: Boolean(accessToken && organizationId && unitId),
  });
}

export function useCreateUnit(propertyId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateUnitRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createUnit(accessToken, organizationId, propertyId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'units', organizationId],
      });
    },
  });
}

export function usePatchUnit(unitId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchUnitRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchUnit(accessToken, organizationId, unitId, input.body, input.version);
    },
    onSuccess: async (result: UnitResponse) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'units', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: unitQueryKey(organizationId, result.id),
      });
    },
  });
}

export function useArchiveUnit(unitId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return archiveUnit(accessToken, organizationId, unitId);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'units', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: unitQueryKey(organizationId, unitId),
      });
    },
  });
}

export function useUpdateUnitStatus(unitId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: UnitStatusRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return updateUnitOperationalStatus(
        accessToken,
        organizationId,
        unitId,
        input.body,
        input.version,
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: unitQueryKey(organizationId, unitId),
      });
      await queryClient.invalidateQueries({
        queryKey: ['inventory', 'units', organizationId],
      });
    },
  });
}
