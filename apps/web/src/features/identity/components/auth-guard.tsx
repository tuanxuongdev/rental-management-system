'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { fetchMe, refreshAccessToken } from '@/lib/auth-api';
import { useAuthStore } from '@/state/auth-store';

import type { ReactNode } from 'react';

type AuthGuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      let token = accessToken;

      if (!token) {
        token = await refreshAccessToken();
        if (token) {
          setAccessToken(token);
        }
      }

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        await fetchMe(token);
      } catch {
        useAuthStore.getState().clearSession();
        router.replace('/login');
        return;
      }

      if (!cancelled) {
        setReady(true);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [accessToken, router, setAccessToken]);

  if (!ready) {
    return (
      <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
        Loading session…
      </div>
    );
  }

  return children;
}
