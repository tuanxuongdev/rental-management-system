import {
  HEALTH_PATH,
  IDEMPOTENCY_KEY_HEADER,
  META_IDEMPOTENT_ECHO_PATH,
  META_PING_PATH,
  META_VERSION_PATH,
  READY_PATH,
  REQUEST_ID_HEADER,
  healthResponseSchema,
  metaIdempotentEchoRequestSchema,
  metaIdempotentEchoResponseSchema,
  metaPingResponseSchema,
  metaVersionResponseSchema,
  problemDetailsSchema,
  readinessResponseSchema,
  type HealthResponse,
  type MetaIdempotentEchoRequest,
  type MetaIdempotentEchoResponse,
  type MetaPingResponse,
  type MetaVersionResponse,
  type ReadinessResponse,
} from '@rpm/contracts';

import { createRequestId } from './request-id';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problem?: ReturnType<typeof problemDetailsSchema.parse>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export { createRequestId };

type ApiRequestOptions = {
  requestId?: string;
};

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('json')) {
    return null;
  }

  return response.json();
}

async function apiGet<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  options: ApiRequestOptions = {},
): Promise<{ data: T; correlationId: string; traceId: string | null }> {
  const requestId = options.requestId ?? createRequestId();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      [REQUEST_ID_HEADER]: requestId,
    },
    cache: 'no-store',
  });

  const correlationId = response.headers.get(REQUEST_ID_HEADER) ?? requestId;
  const traceId = response.headers.get('X-Trace-Id');
  const payload: unknown = await parseResponseBody(response);

  if (!response.ok) {
    const problem =
      payload !== null && typeof payload === 'object'
        ? problemDetailsSchema.safeParse(payload)
        : undefined;

    throw new ApiClientError(
      problem?.success
        ? (problem.data.detail ?? problem.data.title)
        : `API request failed (${response.status})`,
      response.status,
      problem?.success ? problem.data : undefined,
    );
  }

  return {
    data: schema.parse(payload),
    correlationId,
    traceId,
  };
}

export async function fetchHealth(): Promise<{
  data: HealthResponse;
  correlationId: string;
  traceId: string | null;
}> {
  return apiGet(HEALTH_PATH, healthResponseSchema);
}

export async function fetchReadiness(): Promise<{
  data: ReadinessResponse;
  correlationId: string;
  traceId: string | null;
}> {
  return apiGet(READY_PATH, readinessResponseSchema);
}

export async function fetchMetaVersion(): Promise<{
  data: MetaVersionResponse;
  correlationId: string;
  traceId: string | null;
}> {
  return apiGet(META_VERSION_PATH, metaVersionResponseSchema);
}

export async function fetchMetaPing(requestId?: string): Promise<{
  data: MetaPingResponse;
  correlationId: string;
  traceId: string | null;
}> {
  return apiGet(META_PING_PATH, metaPingResponseSchema, { requestId });
}

export async function postMetaIdempotentEcho(
  body: MetaIdempotentEchoRequest,
  idempotencyKey: string,
  requestId?: string,
): Promise<{
  data: MetaIdempotentEchoResponse;
  correlationId: string;
  traceId: string | null;
  idempotencyReplayed: boolean;
}> {
  const outboundRequestId = requestId ?? createRequestId();
  metaIdempotentEchoRequestSchema.parse(body);

  const response = await fetch(`${apiBaseUrl}${META_IDEMPOTENT_ECHO_PATH}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      [REQUEST_ID_HEADER]: outboundRequestId,
      [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const correlationId = response.headers.get(REQUEST_ID_HEADER) ?? outboundRequestId;
  const traceId = response.headers.get('X-Trace-Id');
  const idempotencyReplayed = response.headers.get('idempotency-replayed') === 'true';
  const payload: unknown = await parseResponseBody(response);

  if (!response.ok) {
    const problem =
      payload !== null && typeof payload === 'object'
        ? problemDetailsSchema.safeParse(payload)
        : undefined;

    throw new ApiClientError(
      problem?.success
        ? (problem.data.detail ?? problem.data.title)
        : `API request failed (${response.status})`,
      response.status,
      problem?.success ? problem.data : undefined,
    );
  }

  return {
    data: metaIdempotentEchoResponseSchema.parse(payload),
    correlationId,
    traceId,
    idempotencyReplayed,
  };
}

export {
  HEALTH_PATH,
  META_IDEMPOTENT_ECHO_PATH,
  META_PING_PATH,
  META_VERSION_PATH,
  READY_PATH,
  REQUEST_ID_HEADER,
};
