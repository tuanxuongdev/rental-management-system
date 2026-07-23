import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import {
  completeUploadRequestSchema,
  createDocumentLinkRequestSchema,
  downloadUrlRequestSchema,
  paginationQuerySchema,
  PERMISSION_KEYS,
  uploadIntentRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { DocumentService } from '../application/document.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Response } from 'express';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class DocumentsController {
  constructor(@Inject(DocumentService) private readonly documents: DocumentService) {}

  @Get('documents')
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_LIST)
  listDocuments(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.documents.listDocuments(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      status: typeof query.status === 'string' ? query.status : undefined,
      category: typeof query.category === 'string' ? query.category : undefined,
      partyId:
        typeof query.partyId === 'string'
          ? query.partyId
          : typeof query.residentId === 'string'
            ? query.residentId
            : undefined,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
      q: typeof query.q === 'string' ? query.q : undefined,
    });
  }

  @Post('documents/upload-intents')
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_UPLOAD)
  createUploadIntent(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = uploadIntentRequestSchema.parse(body);
    return this.documents.createUploadIntent(
      organizationId,
      actor.membershipId!,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Get('documents/:documentId')
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_VIEW)
  getDocument(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.documents.getDocument(organizationId, actor.membershipId!, documentId);
  }

  @Post('documents/:documentId/complete-upload')
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_UPLOAD)
  completeUpload(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = completeUploadRequestSchema.parse(body);
    return this.documents.completeUpload(
      organizationId,
      actor.membershipId!,
      actor.userId,
      documentId,
      parsed,
      request.correlationId,
    );
  }

  @Post('documents/:documentId/download-url')
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_VIEW)
  createDownloadUrl(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = downloadUrlRequestSchema.parse(body ?? {});
    return this.documents.createDownloadUrl(
      organizationId,
      actor.membershipId!,
      actor.userId,
      documentId,
      parsed,
      request.correlationId,
    );
  }

  @Get('documents/:documentId/content')
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_VIEW)
  async getDocumentContent(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Res({ passthrough: false }) response: Response,
  ) {
    const file = await this.documents.getDocumentContent(
      organizationId,
      actor.membershipId!,
      actor.userId,
      documentId,
      request.correlationId,
    );
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName.replace(/"/g, '')}"`,
    );
    response.setHeader('Content-Length', String(file.sizeBytes));
    response.send(Buffer.from(file.body));
  }

  @Post('documents/:documentId/links')
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_UPLOAD)
  createLink(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createDocumentLinkRequestSchema.parse(body);
    return this.documents.createLink(
      organizationId,
      actor.membershipId!,
      actor.userId,
      documentId,
      parsed,
      request.correlationId,
    );
  }

  @Delete('documents/:documentId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_KEYS.DOCUMENTS_DELETE)
  async deleteDocument(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    await this.documents.deleteDocument(
      organizationId,
      actor.membershipId!,
      actor.userId,
      documentId,
      request.correlationId,
    );
  }
}
