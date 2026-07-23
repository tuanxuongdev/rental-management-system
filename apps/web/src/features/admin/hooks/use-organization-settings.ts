'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PatchOrganizationSettingsRequest } from '@rpm/contracts';

import { getOrganizationSettings, patchOrganizationSettings } from '@/lib/admin-api';
import { useAuthStore } from '@/state/auth-store';

import { meQueryKey, useMe } from './use-me';

export function organizationSettingsQueryKey(organizationId: string) {
  return ['admin', 'settings', organizationId] as const;
}

export function useOrganizationSettings() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: organizationSettingsQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getOrganizationSettings(accessToken, organizationId);
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function usePatchOrganizationSettings() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchOrganizationSettingsRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchOrganizationSettings(accessToken, organizationId, input.body, input.version);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: organizationSettingsQueryKey(organizationId),
      });
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}
