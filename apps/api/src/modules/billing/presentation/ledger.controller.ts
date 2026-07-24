import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';

import { FINANCE_PERMISSION_KEYS, paginationQuerySchema } from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequireAnyPermissions } from '../../../common/auth/require-permissions.decorator';
import { LedgerService } from '../application/ledger.service';

import type { AuthActor } from '../../../common/auth/auth.types';

@Controller('organizations/:organizationId/ledger-entries')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class LedgerController {
  constructor(@Inject(LedgerService) private readonly ledger: LedgerService) {}

  @Get()
  @RequireAnyPermissions(
    FINANCE_PERMISSION_KEYS.INVOICES_VIEW,
    FINANCE_PERMISSION_KEYS.REPORTS_VIEW,
  )
  list(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.ledger.listLedgerEntries(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      leaseId: typeof query.leaseId === 'string' ? query.leaseId : undefined,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
      sourceType: typeof query.sourceType === 'string' ? query.sourceType : undefined,
    });
  }
}
