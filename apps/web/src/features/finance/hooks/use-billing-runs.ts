'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ApproveBillingRunRequest,
  BillingRunPreviewRequest,
  BillingRunPreviewResponse,
  CommitBillingRunRequest,
  CreateBillingRunRequest,
} from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  approveBillingRun,
  commitBillingRun,
  createBillingRun,
  getBillingRun,
  listBillingRuns,
  previewBillingRun,
  type ListBillingRunsOptions,
} from '@/lib/billing-api';
import { useAuthStore } from '@/state/auth-store';

export function billingRunsQueryKey(
  organizationId: string,
  filters?: Pick<ListBillingRunsOptions, 'periodKey' | 'status'>,
) {
  return ['finance', 'billing-runs', 'list', organizationId, filters ?? {}] as const;
}

export function billingRunQueryKey(organizationId: string, billingRunId: string) {
  return ['finance', 'billing-runs', 'detail', organizationId, billingRunId] as const;
}

export function useBillingRuns(filters?: Pick<ListBillingRunsOptions, 'periodKey' | 'status'>) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: billingRunsQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listBillingRuns(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useBillingRun(billingRunId: string | null) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: billingRunQueryKey(organizationId ?? 'none', billingRunId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId || !billingRunId) {
        throw new Error('Organization context required');
      }
      return getBillingRun(accessToken, organizationId, billingRunId);
    },
    enabled: Boolean(accessToken && organizationId && billingRunId),
  });
}

export function useCreateBillingRun() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: CreateBillingRunRequest; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createBillingRun(
        accessToken,
        organizationId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'billing-runs', 'list', organizationId],
      });
    },
  });
}

export function usePreviewBillingRunMutation() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      billingRunId: string;
      body?: BillingRunPreviewRequest;
      version: number;
    }): Promise<BillingRunPreviewResponse> => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return previewBillingRun(
        accessToken,
        organizationId,
        input.billingRunId,
        input.body ?? { refresh: true },
        input.version,
      );
    },
    onSuccess: async (_data, variables) => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: billingRunQueryKey(organizationId, variables.billingRunId),
      });
    },
  });
}

export function useApproveBillingRun(billingRunId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: ApproveBillingRunRequest; version: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return approveBillingRun(
        accessToken,
        organizationId,
        billingRunId,
        input.body,
        input.version,
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: billingRunQueryKey(organizationId, billingRunId),
      });
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'billing-runs', 'list', organizationId],
      });
    },
  });
}

export function useCommitBillingRun(billingRunId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      body: CommitBillingRunRequest;
      version: number;
      idempotencyKey?: string;
    }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return commitBillingRun(
        accessToken,
        organizationId,
        billingRunId,
        input.body,
        input.version,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: billingRunQueryKey(organizationId, billingRunId),
      });
      await queryClient.invalidateQueries({
        queryKey: ['finance', 'billing-runs', 'list', organizationId],
      });
      await queryClient.invalidateQueries({ queryKey: ['finance', 'invoices', organizationId] });
    },
  });
}
