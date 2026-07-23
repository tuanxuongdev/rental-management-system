'use client';

import { WaitlistList } from '@/features/residents';

export default function WaitlistPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Waitlist</h1>
        <p className="text-muted-foreground text-sm">
          Property waitlist entries for authorized inventory demand tracking.
        </p>
      </div>
      <WaitlistList />
    </div>
  );
}
