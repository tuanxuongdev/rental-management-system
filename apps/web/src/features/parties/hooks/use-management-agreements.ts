'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ActivateAgreementRequest,
  CreateManagementAgreementRequest,
  TerminateAgreementRequest,
} from '@rpm/contracts';

import { useMe } from '@/features/admin';
import {
  activateManagementAgreement,
  createManagementAgreement,
  getManagementAgreement,
  listManagementAgreements,
  terminateManagementAgreement,
} from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';
import { usePropertyScopeStore } from '@/state/property-scope-store';

export function managementAgreementsQueryKey(organizationId: string, propertyScope: string) {
  return ['parties', 'management-agreements', organizationId, propertyScope] as const;
}

export function managementAgreementQueryKey(organizationId: string, agreementId: string) {
  return ['parties', 'management-agreements', organizationId, agreementId] as const;
}

export function useManagementAgreements() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);

  return useQuery({
    queryKey: managementAgreementsQueryKey(organizationId ?? 'none', propertyScope),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listManagementAgreements(accessToken, organizationId, {
        limit: 100,
        propertyId: propertyScope === 'ALL' ? undefined : propertyScope,
      });
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useManagementAgreement(agreementId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: managementAgreementQueryKey(organizationId ?? 'none', agreementId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getManagementAgreement(accessToken, organizationId, agreementId);
    },
    enabled: Boolean(accessToken && organizationId && agreementId),
  });
}

export function useCreateManagementAgreement() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateManagementAgreementRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createManagementAgreement(accessToken, organizationId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['parties', 'management-agreements', organizationId],
      });
    },
  });
}

export function useActivateManagementAgreement(agreementId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body?: ActivateAgreementRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return activateManagementAgreement(
        accessToken,
        organizationId,
        agreementId,
        input.body ?? {},
        input.version,
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['parties', 'management-agreements', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: managementAgreementQueryKey(organizationId, agreementId),
      });
    },
  });
}

export function useTerminateManagementAgreement(agreementId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: TerminateAgreementRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return terminateManagementAgreement(
        accessToken,
        organizationId,
        agreementId,
        input.body,
        input.version,
      );
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['parties', 'management-agreements', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: managementAgreementQueryKey(organizationId, agreementId),
      });
    },
  });
}
