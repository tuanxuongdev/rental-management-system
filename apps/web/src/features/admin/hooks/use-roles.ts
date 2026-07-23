'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateRoleRequest, PatchRoleRequest } from '@rpm/contracts';

import { createRole, getRole, listPermissions, listRoles, patchRole } from '@/lib/admin-api';
import { useAuthStore } from '@/state/auth-store';

import { useMe } from './use-me';

export function rolesQueryKey(organizationId: string) {
  return ['admin', 'roles', organizationId] as const;
}

export function roleQueryKey(organizationId: string, roleId: string) {
  return ['admin', 'roles', organizationId, roleId] as const;
}

export function permissionsQueryKey(organizationId: string) {
  return ['admin', 'permissions', organizationId] as const;
}

export function useRoles() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: rolesQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listRoles(accessToken, organizationId);
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useRole(roleId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: roleQueryKey(organizationId ?? 'none', roleId),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getRole(accessToken, organizationId, roleId);
    },
    enabled: Boolean(accessToken && organizationId && roleId),
  });
}

export function usePermissionsCatalog() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;

  return useQuery({
    queryKey: permissionsQueryKey(organizationId ?? 'none'),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listPermissions(accessToken, organizationId);
    },
    enabled: Boolean(accessToken && organizationId),
  });
}

export function useCreateRole() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateRoleRequest) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createRole(accessToken, organizationId, body);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey(organizationId) });
    },
  });
}

export function usePatchRole(roleId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { body: PatchRoleRequest; version?: number }) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return patchRole(accessToken, organizationId, roleId, input.body, input.version);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey(organizationId) });
      await queryClient.invalidateQueries({ queryKey: roleQueryKey(organizationId, roleId) });
    },
  });
}
