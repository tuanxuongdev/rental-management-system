'use client';

import { RolesList } from '@/features/admin';

export default function AdminRolesPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
        <p className="text-muted-foreground text-sm">
          System and custom roles for this Organization.
        </p>
      </div>
      <RolesList />
    </div>
  );
}
