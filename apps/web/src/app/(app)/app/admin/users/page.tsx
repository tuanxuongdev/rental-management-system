'use client';

import { UsersList } from '@/features/admin';

export default function AdminUsersPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          Workforce members in the active Organization.
        </p>
      </div>
      <UsersList />
    </div>
  );
}
