'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  createRequestId,
  fetchMetaPing,
  fetchMetaVersion,
  fetchReadiness,
  postMetaIdempotentEcho,
} from '@/lib/api-client';

export function usePlatformStatus() {
  const [requestId] = useState(() => createRequestId());
  const [idempotencyKey] = useState(() => createRequestId());

  const readinessQuery = useQuery({
    queryKey: ['platform', 'readiness'],
    queryFn: () => fetchReadiness(),
  });

  const versionQuery = useQuery({
    queryKey: ['platform', 'meta', 'version'],
    queryFn: () => fetchMetaVersion(),
  });

  const pingQuery = useQuery({
    queryKey: ['platform', 'meta', 'ping', requestId],
    queryFn: () => fetchMetaPing(requestId),
  });

  const echoMutation = useMutation({
    mutationFn: (message: string) => postMetaIdempotentEcho({ message }, idempotencyKey, requestId),
  });

  const summaryMessage = useMemo(() => {
    if (readinessQuery.isLoading || versionQuery.isLoading || pingQuery.isLoading) {
      return 'Loading platform status.';
    }

    if (readinessQuery.isError || versionQuery.isError || pingQuery.isError) {
      return 'Platform status failed to load.';
    }

    if (readinessQuery.isSuccess && versionQuery.isSuccess && pingQuery.isSuccess) {
      const dbStatus = readinessQuery.data.data.checks.database ?? 'unknown';
      return `Platform status loaded. Database check ${dbStatus}. Ping correlation ID ${pingQuery.data.data.correlationId}.`;
    }

    return 'Platform status pending.';
  }, [pingQuery, readinessQuery, versionQuery]);

  return {
    readinessQuery,
    versionQuery,
    pingQuery,
    echoMutation,
    requestId,
    idempotencyKey,
    summaryMessage,
  };
}
