'use client';

import { InvitationsList } from '@/features/admin';

export default function AdminInvitationsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invitations</h1>
        <p className="text-muted-foreground text-sm">
          Pending and historical workforce invitations.
        </p>
      </div>
      <InvitationsList />
    </div>
  );
}
