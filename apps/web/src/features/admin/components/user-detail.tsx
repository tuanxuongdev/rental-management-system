'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button, Label } from '@rpm/ui';

import { AuthApiError } from '@/lib/auth-api';

import { useMe } from '../hooks/use-me';
import { useMember, usePatchMember } from '../hooks/use-members';
import { useRoles } from '../hooks/use-roles';
import { ADMIN_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

import { PropertyAccessGrantsSection } from './property-access-grants-section';

export function UserDetail({ membershipId }: { membershipId: string }): React.JSX.Element {
  const meQuery = useMe();
  const memberQuery = useMember(membershipId);
  const rolesQuery = useRoles();
  const patchMember = usePatchMember(membershipId);

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (memberQuery.data) {
      setSelectedRoleIds(memberQuery.data.roles.map((role) => role.id));
    }
  }, [memberQuery.data]);

  const canView = hasPermission(meQuery.data, ADMIN_PERMISSIONS.membersView);
  const canAssignRoles = canMutate(meQuery.data, ADMIN_PERMISSIONS.membersRolesAssign);
  const canSuspend = canMutate(meQuery.data, ADMIN_PERMISSIONS.membersSuspend);

  if (meQuery.isLoading || memberQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading member…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this member.
      </p>
    );
  }

  if (memberQuery.isError || !memberQuery.data) {
    const message =
      memberQuery.error instanceof AuthApiError ? memberQuery.error.message : 'Member not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const member = memberQuery.data;
  const roles = rolesQuery.data?.data ?? [];

  async function onSaveRoles(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      await patchMember.mutateAsync({
        body: { roleIds: selectedRoleIds },
        version: member.version,
      });
      setSuccess('Roles updated.');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to update roles.');
    }
  }

  async function onToggleSuspend(): Promise<void> {
    setError(null);
    setSuccess(null);
    const nextStatus = member.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await patchMember.mutateAsync({
        body: {
          status: nextStatus,
          reason:
            nextStatus === 'SUSPENDED'
              ? 'Suspended by administrator'
              : 'Reactivated by administrator',
        },
        version: member.version,
      });
      setSuccess(nextStatus === 'SUSPENDED' ? 'Member suspended.' : 'Member reactivated.');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to update member status.');
    }
  }

  function toggleRole(roleId: string): void {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/app/admin/users"
          className="text-muted-foreground text-xs underline-offset-4 hover:underline"
        >
          ← Users
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {member.displayName ?? member.email}
        </h1>
        <p className="text-muted-foreground text-sm">{member.email}</p>
        <p className="text-muted-foreground mt-1 text-sm">Status: {member.status}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Roles</h2>
        {rolesQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading roles…</p>
        ) : (
          <ul className="space-y-2">
            {roles.map((role) => (
              <li key={role.id} className="flex items-center gap-2">
                <input
                  id={`role-${role.id}`}
                  type="checkbox"
                  className="size-4"
                  checked={selectedRoleIds.includes(role.id)}
                  disabled={!canAssignRoles || patchMember.isPending}
                  onChange={() => toggleRole(role.id)}
                />
                <Label htmlFor={`role-${role.id}`}>{role.name}</Label>
              </li>
            ))}
          </ul>
        )}
        {canAssignRoles ? (
          <Button
            type="button"
            disabled={patchMember.isPending || selectedRoleIds.length === 0}
            onClick={() => void onSaveRoles()}
          >
            {patchMember.isPending ? 'Saving…' : 'Save roles'}
          </Button>
        ) : null}
      </section>

      <PropertyAccessGrantsSection membershipId={membershipId} />

      {canSuspend ? (
        <section>
          <Button
            type="button"
            variant="destructive"
            disabled={patchMember.isPending}
            onClick={() => void onToggleSuspend()}
          >
            {member.status === 'SUSPENDED' ? 'Reactivate member' : 'Suspend member'}
          </Button>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-700" role="status">
          {success}
        </p>
      ) : null}
    </div>
  );
}
