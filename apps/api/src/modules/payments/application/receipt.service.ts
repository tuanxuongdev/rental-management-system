import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ReceiptResponse } from '@rpm/contracts';

import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { decimalToString } from '../../billing/domain/billing.rules';
import { AuthorizationService } from '../../tenancy/application/authorization.service';

@Injectable()
export class ReceiptService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  async getReceipt(
    organizationId: string,
    membershipId: string,
    receiptId: string,
  ): Promise<ReceiptResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.payments.view',
    );

    const row = await this.prisma.paymentReceipt.findFirst({
      where: { id: receiptId, tenantId: organizationId },
      include: { payment: { select: { propertyId: true } } },
    });
    if (row === null) {
      throw new NotFoundException({ message: 'Receipt not found', code: 'RECEIPT_NOT_FOUND' });
    }
    if (row.payment.propertyId !== null) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        row.payment.propertyId,
      );
    }

    return {
      id: row.id,
      organizationId: row.tenantId,
      paymentTransactionId: row.paymentTransactionId,
      receiptNumber: row.receiptNumber,
      issuedAt: row.issuedAt.toISOString(),
      currency: row.currency,
      amount: decimalToString(row.amount),
      summary:
        row.summary !== null && typeof row.summary === 'object' && !Array.isArray(row.summary)
          ? (row.summary as Record<string, unknown>)
          : {},
      documentId: row.documentId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
