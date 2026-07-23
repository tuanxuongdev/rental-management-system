'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listInvitations, revokeInvitation } from '@/lib/admin-api';
import { useAuthStore } from '@/state/auth-store';

import { useMe } from './use-me';

export function invitationsQueryKey(organizationId: string) {
  return ['admin', 'invitations', organizationId] as const;
}

export function useInvitations() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: invitationsQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listInvitations(accessToken, organizationId);
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useRevokeInvitation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return revokeInvitation(accessToken, organizationId, invitationId);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: invitationsQueryKey(organizationId) });
    },
  });
}
