'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AllocationCreate,
  CreateDepositDispositionRequest,
  DispositionDecisionRequest,
  ExecuteDepositDispositionRequest,
  ManualPaymentCreate,
  PaymentReverseRequest,
  RefundCreate,
  RefundDecisionRequest,
  RefundExecuteRequest,
} from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  allocatePayment,
  approveDepositDisposition,
  approveRefund,
  createDepositDispositions,
  executeDepositDisposition,
  executeRefund,
  getFinanceDashboard,
  getPayment,
  getReceipt,
  listArrears,
  listPayments,
  recordManualPayment,
  requestRefund,
  reversePayment,
  type ListPaymentsOptions,
} from '@/lib/payments-api';
import { useAuthStore } from '@/state/auth-store';

export function paymentsQueryKey(
  organizationId: string,
  filters?: Pick<ListPaymentsOptions, 'status' | 'leaseId' | 'propertyId' | 'channel'>,
) {
  return ['finance', 'payments', 'list', organizationId, filters ?? {}] as const;
}

export function paymentQueryKey(organizationId: string, paymentId: string) {
  return ['finance', 'payments', 'detail', organizationId, paymentId] as const;
}

export function arrearsQueryKey(organizationId: string, propertyId?: string) {
  return ['finance', 'arrears', organizationId, propertyId ?? 'ALL'] as const;
}

export function financeDashboardQueryKey(organizationId: string) {
  return ['finance', 'dashboard', organizationId] as const;
}

export function usePayments(
  filters?: Pick<ListPaymentsOptions, 'status' | 'leaseId' | 'propertyId' | 'channel'>,
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: paymentsQueryKey(organizationId ?? 'none', filters),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listPayments(accessToken, organizationId, { limit: 50, ...filters });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function usePayment(paymentId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: paymentQueryKey(organizationId ?? 'none', paymentId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getPayment(accessToken, organizationId, paymentId);
    },
    enabled: Boolean(accessToken && organizationId && paymentId),
  });
}

export function useRecordPayment() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: ManualPaymentCreate; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return recordManualPayment(
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
      await queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
      await queryClient.invalidateQueries({ queryKey: ['finance', 'arrears'] });
      await queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    },
  });
}

export function useAllocatePayment(paymentTransactionId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: AllocationCreate; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return allocatePayment(
        accessToken,
        organizationId,
        paymentTransactionId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: paymentQueryKey(organizationId, paymentTransactionId),
      });
      await queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    },
  });
}

export function useArrears(propertyId?: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: arrearsQueryKey(organizationId ?? 'none', propertyId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listArrears(accessToken, organizationId, { limit: 50, propertyId });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useFinanceDashboard() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: financeDashboardQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getFinanceDashboard(accessToken, organizationId);
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useReceipt(receiptId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: ['finance', 'receipts', organizationId ?? 'none', receiptId] as const,
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getReceipt(accessToken, organizationId, receiptId);
    },
    enabled: Boolean(accessToken && organizationId && receiptId),
  });
}

export function useCreateDepositDispositions(depositId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: CreateDepositDispositionRequest; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createDepositDispositions(
        accessToken,
        organizationId,
        depositId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance', 'deposits'] });
    },
  });
}

export function useExecuteDepositDisposition() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      dispositionId: string;
      body: ExecuteDepositDispositionRequest;
      idempotencyKey?: string;
    }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return executeDepositDisposition(
        accessToken,
        organizationId,
        input.dispositionId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance', 'deposits'] });
      await queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
    },
  });
}

export function useApproveDepositDisposition() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      dispositionId: string;
      body: DispositionDecisionRequest;
      idempotencyKey?: string;
    }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return approveDepositDisposition(
        accessToken,
        organizationId,
        input.dispositionId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance', 'deposits'] });
    },
  });
}

export function useRequestRefund() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (input: { body: RefundCreate; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return requestRefund(
        accessToken,
        organizationId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
  });
}

export function useApproveRefund() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (input: {
      refundId: string;
      body: RefundDecisionRequest;
      idempotencyKey?: string;
    }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return approveRefund(
        accessToken,
        organizationId,
        input.refundId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
  });
}

export function useExecuteRefund() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      refundId: string;
      body?: RefundExecuteRequest;
      idempotencyKey?: string;
    }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return executeRefund(
        accessToken,
        organizationId,
        input.refundId,
        input.body ?? {},
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance', 'payments'] });
    },
  });
}

export function useReversePayment(paymentId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: PaymentReverseRequest; idempotencyKey?: string }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return reversePayment(
        accessToken,
        organizationId,
        paymentId,
        input.body,
        input.idempotencyKey ?? crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: paymentQueryKey(organizationId ?? 'none', paymentId),
      });
    },
  });
}
