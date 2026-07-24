'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PostInvoiceRequest, VoidInvoiceRequest } from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  getInvoice,
  listInvoices,
  postInvoice,
  voidInvoice,
  type ListInvoicesOptions,
} from '@/lib/billing-api';
import { useAuthStore } from '@/state/auth-store';

export function invoicesQueryKey(
  organizationId: string,
  filters?: Pick<ListInvoicesOptions, 'status' | 'leaseId' | 'propertyId' | 'periodKey'>,
) {
  return ['finance', 'invoices', 'list', organizationId, filters ?? {}] as const;
}

export function invoiceQueryKey(organizationId: string, invoiceId: string) {
  return ['finance', 'invoices', 'detail', organizationId, invoiceId] as const;
}

export function useInvoices(
  filters?: Pick<ListInvoicesOptions, 'status' | 'leaseId' | 'propertyId' | 'periodKey'>,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: invoicesQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listInvoices(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useInvoice(invoiceId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: invoiceQueryKey(organizationId ?? 'none', invoiceId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getInvoice(accessToken, organizationId, invoiceId);
    },
    enabled: Boolean(accessToken && organizationId && invoiceId),
  });
}

export function usePostInvoice(invoiceId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PostInvoiceRequest; version: number; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return postInvoice(
        accessToken,
        organizationId,
        invoiceId,
        input.body,
        input.version,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['finance', 'invoices', organizationId] });
      await queryClient.invalidateQueries({
        queryKey: invoiceQueryKey(organizationId, invoiceId),
      });
    },
  });
}

export function useVoidInvoice(invoiceId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: VoidInvoiceRequest; version: number; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return voidInvoice(
        accessToken,
        organizationId,
        invoiceId,
        input.body,
        input.version,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['finance', 'invoices', organizationId] });
      await queryClient.invalidateQueries({
        queryKey: invoiceQueryKey(organizationId, invoiceId),
      });
    },
  });
}
