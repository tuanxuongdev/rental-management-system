import { Inject, Injectable, Logger } from '@nestjs/common';

import { API_CONFIG } from '../../bootstrap/api-config.module';

import type { ApiConfig } from '../../bootstrap/configuration';

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
  correlationId?: string | undefined;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  async send(payload: EmailPayload): Promise<void> {
    if (this.config.auth.emailDeliveryMode === 'console') {
      // Never log raw tokens/links — body may contain secrets.
      this.logger.log(
        JSON.stringify({
          level: 'info',
          message: 'email.delivery.console',
          to: payload.to,
          subject: payload.subject,
          correlationId: payload.correlationId,
          bodyLength: payload.body.length,
        }),
      );
      return;
    }

    this.logger.warn(
      JSON.stringify({
        level: 'warn',
        message: 'email.delivery.not_configured',
        to: payload.to,
        subject: payload.subject,
      }),
    );
  }
}
