'use client';

import { use } from 'react';

import { RoleEditor } from '@/features/admin';

export default function AdminRoleEditPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}): React.JSX.Element {
  const { roleId } = use(params);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit role</h1>
        <p className="text-muted-foreground text-sm">
          Update a custom role. System roles are read-only.
        </p>
      </div>
      <RoleEditor mode="edit" roleId={roleId} />
    </div>
  );
}
