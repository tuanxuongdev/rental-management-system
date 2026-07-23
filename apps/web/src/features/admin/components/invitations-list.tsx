'use client';

import { Button } from '@rpm/ui';

import { AuthApiError } from '@/lib/auth-api';

import { useInvitations, useRevokeInvitation } from '../hooks/use-invitations';
import { useMe } from '../hooks/use-me';
import { ADMIN_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function InvitationsList(): React.JSX.Element {
  const meQuery = useMe();
  const invitationsQuery = useInvitations();
  const revokeInvitation = useRevokeInvitation();
  const canView = hasPermission(meQuery.data, ADMIN_PERMISSIONS.membersInvite);
  const canRevoke = canMutate(meQuery.data, ADMIN_PERMISSIONS.membersInvite);

  if (meQuery.isLoading || invitationsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading invitations…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to manage invitations.
      </p>
    );
  }

  if (invitationsQuery.isError) {
    const message =
      invitationsQuery.error instanceof AuthApiError
        ? invitationsQuery.error.message
        : 'Unable to load invitations.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const invitations = invitationsQuery.data?.data ?? [];

  if (invitations.length === 0) {
    return <p className="text-muted-foreground text-sm">No invitations yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-border border-b">
            <th className="px-2 py-2 font-medium">Email</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 font-medium">Expires</th>
            <th className="px-2 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr key={invitation.id} className="border-border border-b">
              <td className="px-2 py-2">{invitation.email}</td>
              <td className="px-2 py-2">{invitation.status}</td>
              <td className="px-2 py-2">{new Date(invitation.expiresAt).toLocaleString()}</td>
              <td className="px-2 py-2">
                {canRevoke && invitation.status === 'PENDING' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={revokeInvitation.isPending}
                    onClick={() => {
                      void revokeInvitation.mutateAsync(invitation.id).catch(() => undefined);
                    }}
                  >
                    Revoke
                  </Button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {revokeInvitation.isError ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {revokeInvitation.error instanceof AuthApiError
            ? revokeInvitation.error.message
            : 'Unable to revoke invitation.'}
        </p>
      ) : null}
    </div>
  );
}
