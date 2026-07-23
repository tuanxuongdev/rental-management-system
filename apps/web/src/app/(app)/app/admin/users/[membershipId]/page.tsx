'use client';

import { use } from 'react';

import { UserDetail } from '@/features/admin';

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}): React.JSX.Element {
  const { membershipId } = use(params);

  return <UserDetail membershipId={membershipId} />;
}
