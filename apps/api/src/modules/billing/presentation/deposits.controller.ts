import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';

import { FINANCE_PERMISSION_KEYS, paginationQuerySchema } from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { DepositService } from '../application/deposit.service';

import type { AuthActor } from '../../../common/auth/auth.types';

@Controller('organizations/:organizationId/deposits')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class DepositsController {
  constructor(@Inject(DepositService) private readonly deposits: DepositService) {}

  @Get()
  @RequirePermissions(FINANCE_PERMISSION_KEYS.DEPOSITS_VIEW)
  list(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.deposits.listDeposits(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      leaseId: typeof query.leaseId === 'string' ? query.leaseId : undefined,
      propertyId: typeof query.propertyId === 'string' ? query.propertyId : undefined,
    });
  }

  @Get(':depositId')
  @RequirePermissions(FINANCE_PERMISSION_KEYS.DEPOSITS_VIEW)
  get(
    @Param('organizationId') organizationId: string,
    @Param('depositId') depositId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.deposits.getDeposit(organizationId, actor.membershipId!, depositId);
  }
}
