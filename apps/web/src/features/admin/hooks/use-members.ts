'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PatchMemberRequest } from '@rpm/contracts';

import { getMember, listMembers, patchMember } from '@/lib/admin-api';
import { useAuthStore } from '@/state/auth-store';

import { useMe } from './use-me';

export function membersQueryKey(organizationId: string) {
  return ['admin', 'members', organizationId] as const;
}

export function memberQueryKey(organizationId: string, membershipId: string) {
  return ['admin', 'members', organizationId, membershipId] as const;
}

export function useMembers() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: membersQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listMembers(accessToken, organizationId);
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useMember(membershipId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: memberQueryKey(organizationId ?? 'none', membershipId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getMember(accessToken, organizationId, membershipId);
    },
    enabled: Boolean(accessToken && organizationId && membershipId),
  });
}

export function usePatchMember(membershipId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchMemberRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchMember(accessToken, organizationId, membershipId, input.body, input.version);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: membersQueryKey(organizationId) });
      await queryClient.invalidateQueries({
        queryKey: memberQueryKey(organizationId, membershipId),
      });
    },
  });
}
