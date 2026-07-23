'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateResidentRequest, PatchResidentRequest, ResidentResponse } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  createResident,
  getResident,
  listResidents,
  patchResident,
  type ListResidentsOptions,
} from '@/lib/residents-api';
import { useAuthStore } from '@/state/auth-store';

export function residentsQueryKey(
  organizationId: string,
  filters?: Pick<ListResidentsOptions, 'q' | 'status' | 'propertyId'>,
) {
  return ['residents', 'list', organizationId, filters ?? {}] as const;
}

export function residentQueryKey(organizationId: string, residentId: string) {
  return ['residents', 'detail', organizationId, residentId] as const;
}

export function useResidents(filters?: Pick<ListResidentsOptions, 'q' | 'status' | 'propertyId'>) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: residentsQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listResidents(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useResident(residentId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: residentQueryKey(organizationId ?? 'none', residentId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getResident(accessToken, organizationId, residentId);
    },
    enabled: Boolean(accessToken && organizationId && residentId),
  });
}

export function useCreateResident() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateResidentRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createResident(accessToken, organizationId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['residents', 'list', organizationId] });
    },
  });
}

export function usePatchResident(residentId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchResidentRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchResident(accessToken, organizationId, residentId, input.body, input.version);
    },
    onSuccess: async (result: ResidentResponse) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['residents', 'list', organizationId] });
      await queryClient.invalidateQueries({
        queryKey: residentQueryKey(organizationId, result.id),
      });
    },
  });
}
