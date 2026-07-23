'use client';

import Link from 'next/link';

import { AuthApiError } from '@/lib/auth-api';

import { useMe } from '../hooks/use-me';
import { useRoles } from '../hooks/use-roles';
import { ADMIN_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function RolesList(): React.JSX.Element {
  const meQuery = useMe();
  const rolesQuery = useRoles();
  const canView = hasPermission(meQuery.data, ADMIN_PERMISSIONS.rolesList);
  const canCreate = canMutate(meQuery.data, ADMIN_PERMISSIONS.rolesCreate);

  if (meQuery.isLoading || rolesQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading roles…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list roles.
      </p>
    );
  }

  if (rolesQuery.isError) {
    const message =
      rolesQuery.error instanceof AuthApiError ? rolesQuery.error.message : 'Unable to load roles.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const roles = rolesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      {canCreate ? (
        <div>
          <Link
            href="/app/admin/roles/new"
            className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
          >
            Create role
          </Link>
        </div>
      ) : null}

      {roles.length === 0 ? (
        <p className="text-muted-foreground text-sm">No roles found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Key</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/admin/roles/${role.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {role.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{role.key}</td>
                  <td className="px-2 py-2">{role.isSystem ? 'System' : 'Custom'}</td>
                  <td className="px-2 py-2">{role.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
