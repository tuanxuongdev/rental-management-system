import { createServer, type Server } from 'node:http';

import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { type HealthResponse } from '@rpm/contracts';

import { loadWorkerConfig } from '../bootstrap/configuration';

@Injectable()
export class WorkerHealthServer implements OnModuleInit, OnModuleDestroy {
  private server: Server | null = null;

  snapshot(): HealthResponse {
    return {
      status: 'ok',
      service: 'worker',
      timestamp: new Date().toISOString(),
    };
  }

  onModuleInit(): void {
    const config = loadWorkerConfig();
    const snapshot = this.snapshot();

    console.info(
      JSON.stringify({
        level: 'info',
        message: 'worker.health.started',
        service: 'worker',
        status: snapshot.status,
        env: config.nodeEnv,
        healthPort: config.healthPort,
        timestamp: snapshot.timestamp,
      }),
    );

    this.server = createServer((req, res) => {
      if (req.url === '/health' || req.url === '/ready') {
        const body = JSON.stringify(this.snapshot());
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
        return;
      }

      res.writeHead(404).end();
    });

    this.server.listen(config.healthPort, config.healthHost, () => {
      console.info(
        JSON.stringify({
          level: 'info',
          message: 'worker.health.listening',
          service: 'worker',
          host: config.healthHost,
          port: config.healthPort,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }

  onModuleDestroy(): void {
    this.server?.close();
    this.server = null;
  }
}
