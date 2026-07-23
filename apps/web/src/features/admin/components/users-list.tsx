'use client';

import Link from 'next/link';

import { AuthApiError } from '@/lib/auth-api';

import { useMe } from '../hooks/use-me';
import { useMembers } from '../hooks/use-members';
import { ADMIN_PERMISSIONS, hasPermission } from '../utils/permissions';

export function UsersList(): React.JSX.Element {
  const meQuery = useMe();
  const membersQuery = useMembers();
  const canView = hasPermission(meQuery.data, ADMIN_PERMISSIONS.membersList);

  if (meQuery.isLoading || membersQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading users…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list users.
      </p>
    );
  }

  if (membersQuery.isError) {
    const message =
      membersQuery.error instanceof AuthApiError
        ? membersQuery.error.message
        : 'Unable to load users.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const members = membersQuery.data?.data ?? [];

  if (members.length === 0) {
    return <p className="text-muted-foreground text-sm">No workforce members yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <th className="px-2 py-2 font-medium">Name</th>
            <th className="px-2 py-2 font-medium">Email</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 font-medium">Roles</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-border border-b">
              <td className="px-2 py-2">
                <Link
                  href={`/app/admin/users/${member.id}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {member.displayName ?? '—'}
                </Link>
              </td>
              <td className="px-2 py-2">{member.email}</td>
              <td className="px-2 py-2">{member.status}</td>
              <td className="px-2 py-2">
                {member.roles.map((role) => role.name).join(', ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
