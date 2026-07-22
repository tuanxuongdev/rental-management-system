import { Injectable, type OnModuleInit } from '@nestjs/common';

import { type HealthResponse } from '@rpm/contracts';

/** Foundation heartbeat — no job consumers yet. */
@Injectable()
export class WorkerHealthService implements OnModuleInit {
  onModuleInit(): void {
    const snapshot = this.snapshot();
    console.info(`Worker health: ${snapshot.status} at ${snapshot.timestamp}`);
  }

  snapshot(): HealthResponse {
    return {
      status: 'ok',
      service: 'worker',
      timestamp: new Date().toISOString(),
    };
  }
}
