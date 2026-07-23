'use client';

import { OrganizationSettingsForm } from '@/features/admin';

export default function AdminSettingsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization settings</h1>
        <p className="text-muted-foreground text-sm">
          Profile, locale, and time zone defaults for this Organization.
        </p>
      </div>
      <OrganizationSettingsForm />
    </div>
  );
}
