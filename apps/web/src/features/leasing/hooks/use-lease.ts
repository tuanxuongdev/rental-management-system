'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ActivateLeaseRequest,
  LeaseResponse,
  PatchLeaseRequest,
  SetLeaseAllocationRequest,
} from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  activateLease,
  getLease,
  getLeaseHistory,
  listOccupancyEvents,
  patchLease,
  reviewLease,
  setLeaseAllocation,
} from '@/lib/leases-api';
import { useAuthStore } from '@/state/auth-store';

export function leaseQueryKey(organizationId: string, leaseId: string) {
  return ['leases', 'detail', organizationId, leaseId] as const;
}

export function leaseHistoryQueryKey(organizationId: string, leaseId: string) {
  return ['leases', 'history', organizationId, leaseId] as const;
}

export function occupancyEventsQueryKey(organizationId: string, leaseId: string) {
  return ['leases', 'occupancy-events', organizationId, leaseId] as const;
}

export function leaseReviewQueryKey(organizationId: string, leaseId: string) {
  return ['leases', 'review', organizationId, leaseId] as const;
}

export function useLease(leaseId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: leaseQueryKey(organizationId ?? 'none', leaseId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getLease(accessToken, organizationId, leaseId);
    },
    enabled: Boolean(accessToken && organizationId && leaseId),
  });
}

export function useLeaseHistory(leaseId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: leaseHistoryQueryKey(organizationId ?? 'none', leaseId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getLeaseHistory(accessToken, organizationId, leaseId);
    },
    enabled: Boolean(accessToken && organizationId && leaseId),
  });
}

export function useOccupancyEvents(leaseId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: occupancyEventsQueryKey(organizationId ?? 'none', leaseId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listOccupancyEvents(accessToken, organizationId, leaseId);
    },
    enabled: Boolean(accessToken && organizationId && leaseId),
  });
}

export function useLeaseReview(leaseId: string, enabled = true) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: leaseReviewQueryKey(organizationId ?? 'none', leaseId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return reviewLease(accessToken, organizationId, leaseId);
    },
    enabled: Boolean(accessToken && organizationId && leaseId && enabled),
  });
}

function invalidateLeaseQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  leaseId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['leases', 'list', organizationId] }),
    queryClient.invalidateQueries({ queryKey: leaseQueryKey(organizationId, leaseId) }),
    queryClient.invalidateQueries({ queryKey: leaseHistoryQueryKey(organizationId, leaseId) }),
    queryClient.invalidateQueries({ queryKey: leaseReviewQueryKey(organizationId, leaseId) }),
  ]);
}

export function usePatchLease(leaseId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchLeaseRequest; version: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchLease(accessToken, organizationId, leaseId, input.body, input.version);
    },
    onSuccess: async (result: LeaseResponse) => {
      if (!organizationId) {
        return;
      }
      await invalidateLeaseQueries(queryClient, organizationId, result.id);
    },
  });
}

export function useSetLeaseAllocation(leaseId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      body: SetLeaseAllocationRequest;
      version: number;
      idempotencyKey?: string;
    }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return setLeaseAllocation(
        accessToken,
        organizationId,
        leaseId,
        input.body,
        input.version,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async (result: LeaseResponse) => {
      if (!organizationId) {
        return;
      }
      await invalidateLeaseQueries(queryClient, organizationId, result.id);
    },
  });
}

export function useActivateLease(leaseId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      body: ActivateLeaseRequest;
      version: number;
      idempotencyKey: string;
    }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return activateLease(
        accessToken,
        organizationId,
        leaseId,
        input.body,
        input.version,
        input.idempotencyKey,
      );
    },
    onSuccess: async (result: LeaseResponse) => {
      if (!organizationId) {
        return;
      }
      await invalidateLeaseQueries(queryClient, organizationId, result.id);
    },
  });
}
