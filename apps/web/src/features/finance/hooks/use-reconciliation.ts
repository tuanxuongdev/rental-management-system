'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CompleteReconciliationRunRequest,
  CreateReconciliationRunRequest,
  FinanceExportRequest,
  IngestSettlementsRequest,
  ParallelBillingComparisonRequest,
  ResolveReconciliationItemRequest,
} from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  closeAccountingPeriod,
  completeReconciliationRun,
  createReconciliationRun,
  exportFinance,
  getInvoiceAging,
  getReconciliationRun,
  ingestSettlements,
  listAccountingPeriods,
  listReconciliationItems,
  listReconciliationRuns,
  resolveReconciliationItem,
  runParallelComparison,
} from '@/lib/reconciliation-api';
import { useAuthStore } from '@/state/auth-store';

export function useReconciliationRuns() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useQuery({
    queryKey: ['finance', 'recon', 'runs', organizationId],
    queryFn: () => listReconciliationRuns(accessToken!, organizationId!, { limit: 50 }),
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useReconciliationRun(runId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useQuery({
    queryKey: ['finance', 'recon', 'run', organizationId, runId],
    queryFn: () => getReconciliationRun(accessToken!, organizationId!, runId),
    enabled: Boolean(accessToken && organizationId && runId),
  });
}

export function useReconciliationItems(runId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useQuery({
    queryKey: ['finance', 'recon', 'items', organizationId, runId],
    queryFn: () => listReconciliationItems(accessToken!, organizationId!, runId),
    enabled: Boolean(accessToken && organizationId && runId),
  });
}

export function useCreateReconciliationRun() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const qc = useQueryClient();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (input: { body: CreateReconciliationRunRequest; idempotencyKey: string }) =>
      createReconciliationRun(accessToken!, organizationId!, input.body, input.idempotencyKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance', 'recon', 'runs', organizationId] });
    },
  });
}

export function useIngestSettlements(runId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const qc = useQueryClient();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (input: { body: IngestSettlementsRequest; idempotencyKey: string }) =>
      ingestSettlements(accessToken!, organizationId!, runId, input.body, input.idempotencyKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance', 'recon', 'run', organizationId, runId] });
      void qc.invalidateQueries({ queryKey: ['finance', 'recon', 'items', organizationId, runId] });
    },
  });
}

export function useResolveReconItem() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const qc = useQueryClient();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (input: {
      itemId: string;
      body: ResolveReconciliationItemRequest;
      idempotencyKey: string;
    }) =>
      resolveReconciliationItem(
        accessToken!,
        organizationId!,
        input.itemId,
        input.body,
        input.idempotencyKey,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance', 'recon'] });
    },
  });
}

export function useCompleteReconRun(runId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const qc = useQueryClient();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (input: { body: CompleteReconciliationRunRequest; idempotencyKey: string }) =>
      completeReconciliationRun(
        accessToken!,
        organizationId!,
        runId,
        input.body,
        input.idempotencyKey,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance', 'recon'] });
    },
  });
}

export function useInvoiceAging(asOf: string, currency: string, propertyId?: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useQuery({
    queryKey: ['finance', 'aging', organizationId, asOf, currency, propertyId ?? 'ALL'],
    queryFn: () => getInvoiceAging(accessToken!, organizationId!, { asOf, currency, propertyId }),
    enabled: Boolean(accessToken && organizationId && asOf && currency),
  });
}

export function useAccountingPeriods() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useQuery({
    queryKey: ['finance', 'periods', organizationId],
    queryFn: () => listAccountingPeriods(accessToken!, organizationId!),
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useClosePeriod() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const qc = useQueryClient();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (input: { periodKey: string; reason?: string }) =>
      closeAccountingPeriod(accessToken!, organizationId!, input.periodKey, input.reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance', 'periods', organizationId] });
    },
  });
}

export function useParallelComparison() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (body: ParallelBillingComparisonRequest) =>
      runParallelComparison(accessToken!, organizationId!, body),
  });
}

export function useFinanceExport() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  return useMutation({
    mutationFn: (body: FinanceExportRequest) => exportFinance(accessToken!, organizationId!, body),
  });
}
