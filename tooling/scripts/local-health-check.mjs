#!/usr/bin/env node
/**
 * Local health probe for API + worker (no cloud).
 * Usage: pnpm health:check
 */
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';
const workerBase = process.env.WORKER_HEALTH_BASE_URL ?? 'http://127.0.0.1:3002';

async function probe(name, url) {
  try {
    const response = await fetch(url);
    const body = await response.text();
    const ok = response.ok;
    console.log(`${ok ? 'OK ' : 'FAIL'} ${name} ${response.status} ${url}`);
    if (!ok) {
      console.log(body.slice(0, 500));
    }
    return ok;
  } catch (error) {
    console.log(`FAIL ${name} ${url} — ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

const results = await Promise.all([
  probe('api/health', `${apiBase}/health`),
  probe('api/ready', `${apiBase}/ready`),
  probe('worker/health', `${workerBase}/health`),
  probe('worker/ready', `${workerBase}/ready`),
]);

process.exit(results.every(Boolean) ? 0 : 1);
