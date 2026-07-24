import { Controller, Headers, Inject, Param, Post, Req } from '@nestjs/common';

import { Public } from '../../../common/auth/public.decorator';
import { WebhookService } from '../application/webhook.service';

import type { Request } from 'express';

@Controller('provider/webhooks')
export class ProviderWebhooksController {
  constructor(@Inject(WebhookService) private readonly webhooks: WebhookService) {}

  @Public()
  @Post(':provider')
  handle(
    @Param('provider') provider: string,
    @Req() request: Request,
    @Headers('x-payments-signature') signature: string | undefined,
    @Headers('x-payments-timestamp') timestamp: string | undefined,
    @Headers('x-payments-event-id') externalEventId: string | undefined,
    @Headers('x-payments-event-type') eventType: string | undefined,
  ) {
    const withRaw = request as Request & { rawBody?: Buffer };
    const rawBody =
      withRaw.rawBody !== undefined
        ? withRaw.rawBody.toString('utf8')
        : typeof request.body === 'string'
          ? request.body
          : Buffer.isBuffer(request.body)
            ? request.body.toString('utf8')
            : JSON.stringify(request.body ?? {});

    return this.webhooks.handleProviderWebhook(provider, rawBody, {
      signature,
      timestamp,
      externalEventId,
      eventType,
    });
  }
}
