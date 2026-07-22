import { HEALTH_PATH } from '@rpm/contracts';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

/** Typed fetch helper skeleton — no auth headers yet. */
export async function fetchHealth(): Promise<Response> {
  return fetch(`${apiBaseUrl}${HEALTH_PATH}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}
