import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { StructuredLogger } from './structured-logger';

@Module({
  providers: [
    StructuredLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
  exports: [StructuredLogger],
})
export class ObservabilityModule {}
