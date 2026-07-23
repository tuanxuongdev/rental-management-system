'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreatePropertyAccessGrantRequest,
  EndPropertyAccessGrantRequest,
  PropertyAccessGrantResponse,
  PropertyAccessGrantsCollection,
} from '@rpm/contracts';

import {
  createPropertyAccessGrant,
  endPropertyAccessGrant,
  listPropertyAccessGrants,
} from '@/lib/admin-api';
import { useAuthStore } from '@/state/auth-store';

import { useMe } from './use-me';

export function propertyAccessGrantsQueryKey(organizationId: string, membershipId: string) {
  return ['admin', 'property-access-grants', organizationId, membershipId] as const;
}

export function usePropertyAccessGrants(membershipId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: propertyAccessGrantsQueryKey(organizationId ?? 'none', membershipId),
    queryFn: async (): Promise<PropertyAccessGrantsCollection> => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listPropertyAccessGrants(accessToken, organizationId, membershipId, { limit: 100 });
    },
    enabled: Boolean(accessToken && organizationId && membershipId),
  });
}

export function useCreatePropertyAccessGrant(membershipId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePropertyAccessGrantRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createPropertyAccessGrant(accessToken, organizationId, membershipId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: propertyAccessGrantsQueryKey(organizationId, membershipId),
      });
    },
  });
}

export function useEndPropertyAccessGrant(membershipId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { grantId: string; body?: EndPropertyAccessGrantRequest }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return endPropertyAccessGrant(
        accessToken,
        organizationId,
        membershipId,
        input.grantId,
        input.body,
      );
    },
    onSuccess: async (_result: PropertyAccessGrantResponse) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: propertyAccessGrantsQueryKey(organizationId, membershipId),
      });
    },
  });
}
