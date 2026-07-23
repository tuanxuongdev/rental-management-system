'use client';

import { RoleEditor } from '@/features/admin';

export default function AdminRoleCreatePage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create role</h1>
        <p className="text-muted-foreground text-sm">
          Define a custom role within your effective permissions.
        </p>
      </div>
      <RoleEditor mode="create" />
    </div>
  );
}
