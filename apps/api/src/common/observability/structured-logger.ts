import { Injectable, Logger } from '@nestjs/common';

type LogPayload = Record<string, unknown>;

@Injectable()
export class StructuredLogger {
  private readonly logger = new Logger('api');

  info(message: string, payload: LogPayload = {}): void {
    this.write('info', message, payload);
  }

  warn(message: string, payload: LogPayload = {}): void {
    this.write('warn', message, payload);
  }

  error(message: string, payload: LogPayload = {}): void {
    this.write('error', message, payload);
  }

  private write(level: 'info' | 'warn' | 'error', message: string, payload: LogPayload): void {
    const entry = {
      level,
      message,
      service: 'api',
      timestamp: new Date().toISOString(),
      ...payload,
    };

    const serialized = JSON.stringify(entry);

    if (level === 'error') {
      this.logger.error(serialized);
      return;
    }

    if (level === 'warn') {
      this.logger.warn(serialized);
      return;
    }

    this.logger.log(serialized);
  }
}
