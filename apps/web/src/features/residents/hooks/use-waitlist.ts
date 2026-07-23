'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateWaitlistEntryRequest,
  PatchWaitlistEntryRequest,
  RemoveWaitlistEntryRequest,
} from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  createWaitlistEntry,
  listWaitlistEntries,
  patchWaitlistEntry,
  removeWaitlistEntry,
  type ListWaitlistOptions,
} from '@/lib/residents-api';
import { useAuthStore } from '@/state/auth-store';

export function waitlistQueryKey(
  organizationId: string,
  filters?: Pick<ListWaitlistOptions, 'q' | 'status' | 'propertyId' | 'partyId'>,
) {
  return ['residents', 'waitlist', organizationId, filters ?? {}] as const;
}

export function useWaitlist(
  filters?: Pick<ListWaitlistOptions, 'q' | 'status' | 'propertyId' | 'partyId'>,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: waitlistQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listWaitlistEntries(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useCreateWaitlistEntry() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateWaitlistEntryRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createWaitlistEntry(accessToken, organizationId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['residents', 'waitlist', organizationId],
      });
    },
  });
}

export function usePatchWaitlistEntry() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { entryId: string; body: PatchWaitlistEntryRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchWaitlistEntry(
        accessToken,
        organizationId,
        input.entryId,
        input.body,
        input.version,
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['residents', 'waitlist', organizationId],
      });
    },
  });
}

export function useRemoveWaitlistEntry() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { entryId: string; body: RemoveWaitlistEntryRequest }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return removeWaitlistEntry(accessToken, organizationId, input.entryId, input.body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['residents', 'waitlist', organizationId],
      });
    },
  });
}
