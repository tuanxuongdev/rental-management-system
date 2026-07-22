import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import {
  metaIdempotentEchoRequestSchema,
  type MetaPingResponse,
  type MetaVersionResponse,
  META_IDEMPOTENT_ECHO_PATH,
  META_OPERATIONS_PATH,
  META_PAGINATION_EXAMPLE_PATH,
  META_PING_PATH,
  META_VERSION_PATH,
  paginationQuerySchema,
} from '@rpm/contracts';

import { API_CONFIG } from '../../bootstrap/api-config.module';
import { Public } from '../../common/auth/public.decorator';

import { MetaService } from './meta.service';

import type { ApiConfig } from '../../bootstrap/configuration';
import type { RequestWithCorrelation } from '../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('meta')
export class MetaController {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    @Inject(MetaService) private readonly metaService: MetaService,
  ) {}

  @Public()
  @Get('version')
  version(): MetaVersionResponse {
    return {
      version: this.config.appVersion,
      gitSha: this.config.gitSha,
      service: 'api',
    };
  }

  @Public()
  @Get('ping')
  ping(@Req() request: RequestWithCorrelation): MetaPingResponse {
    return {
      message: 'pong',
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
      service: 'api',
    };
  }

  @Public()
  @Get('pagination-example')
  paginationExample(@Query() query: Record<string, unknown>) {
    const parsed = paginationQuerySchema.safeParse(query);
    const limit = parsed.success ? parsed.data.limit : undefined;
    return this.metaService.paginationExample(limit);
  }

  @Public()
  @Get('operations')
  operations() {
    return this.metaService.listOperations();
  }

  @Public()
  @Post('idempotent-echo')
  @HttpCode(HttpStatus.OK)
  async idempotentEcho(
    @Req() request: RequestWithCorrelation,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    if (!this.config.metaDemoEnabled) {
      throw new NotFoundException({ message: 'Not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const parsed = metaIdempotentEchoRequestSchema.parse(body);
    return this.metaService.idempotentEcho(
      request as Request,
      response,
      parsed,
      request.correlationId,
    );
  }

  static readonly versionPath = META_VERSION_PATH;
  static readonly pingPath = META_PING_PATH;
  static readonly paginationExamplePath = META_PAGINATION_EXAMPLE_PATH;
  static readonly idempotentEchoPath = META_IDEMPOTENT_ECHO_PATH;
  static readonly operationsPath = META_OPERATIONS_PATH;
}
