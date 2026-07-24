import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type CreateCreditNoteRequest,
  type CreditNoteResponse,
  type CreditNotesCollection,
  type PostCreditNoteRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import { decimalToString, nextCreditNoteNumber, roundMoney } from '../domain/billing.rules';

import { LedgerService } from './ledger.service';

@Injectable()
export class CreditNoteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
  ) {}

  async listCreditNotes(
    organizationId: string,
    membershipId: string,
    options?: { limit?: number; after?: string; invoiceId?: string },
  ): Promise<CreditNotesCollection> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.credit_notes.create',
    );
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const rows = await this.prisma.creditNote.findMany({
      where: {
        tenantId: organizationId,
        ...(options?.invoiceId !== undefined ? { invoiceId: options.invoiceId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.toResponse(row)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async createCreditNote(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateCreditNoteRequest,
    correlationId?: string,
  ): Promise<CreditNoteResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.credit_notes.create',
    );

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: body.invoiceId, tenantId: organizationId },
      include: { lines: true },
    });
    if (invoice === null) {
      throw new NotFoundException({ message: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
    }
    await this.authorization.assertPropertyAccess(membershipId, organizationId, invoice.propertyId);
    if (invoice.status !== 'POSTED' && invoice.status !== 'PARTIALLY_PAID') {
      throw new ConflictException({
        message: 'Credit notes require a posted invoice',
        code: 'INVOICE_NOT_POSTED',
      });
    }
    if (body.currency !== invoice.currency) {
      throw new UnprocessableEntityException({
        message: 'Credit note currency must match invoice currency',
        code: 'CURRENCY_MISMATCH',
      });
    }

    let total = new Prisma.Decimal(0);
    for (const line of body.lines) {
      total = total.plus(roundMoney(new Prisma.Decimal(line.amount)));
    }
    total = roundMoney(total);
    if (total.lte(0)) {
      throw new UnprocessableEntityException({
        message: 'Credit note total must be positive',
        code: 'CREDIT_NOTE_AMOUNT_INVALID',
      });
    }
    if (total.gt(invoice.balanceAmount)) {
      throw new UnprocessableEntityException({
        message: 'Credit note exceeds invoice balance',
        code: 'CREDIT_NOTE_EXCEEDS_BALANCE',
      });
    }

    const creditNoteId = randomUUID();
    await this.prisma.creditNote.create({
      data: {
        id: creditNoteId,
        tenantId: organizationId,
        invoiceId: invoice.id,
        leaseId: invoice.leaseId,
        status: 'DRAFT',
        currency: body.currency,
        reason: body.reason,
        totalAmount: total,
        lines: {
          create: body.lines.map((line) => ({
            id: randomUUID(),
            tenantId: organizationId,
            invoiceLineId: line.invoiceLineId ?? null,
            description: line.description,
            amount: roundMoney(new Prisma.Decimal(line.amount)),
            currency: body.currency,
          })),
        },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'credit_note.create',
      outcome: 'SUCCESS',
      targetType: 'credit_note',
      targetId: creditNoteId,
      correlationId,
    });

    const created = await this.prisma.creditNote.findFirstOrThrow({
      where: { id: creditNoteId, tenantId: organizationId },
    });
    return this.toResponse(created);
  }

  async postCreditNote(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    creditNoteId: string,
    body: PostCreditNoteRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: CreditNoteResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.credit_notes.post',
    );
    const operation = `POST /v1/organizations/${organizationId}/credit-notes/${creditNoteId}/post`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return { replayed: true, body: existing.responseBody as CreditNoteResponse };
    }

    const result = await this.transactions.run(async (tx) => {
      const creditNote = await tx.creditNote.findFirst({
        where: { id: creditNoteId, tenantId: organizationId },
        include: { lines: true },
      });
      if (creditNote === null) {
        throw new NotFoundException({
          message: 'Credit note not found',
          code: 'CREDIT_NOTE_NOT_FOUND',
        });
      }
      if (creditNote.version !== expectedVersion) {
        throwVersionMismatch('Credit note version mismatch');
      }

      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${creditNote.invoiceId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;

      const invoice = await tx.invoice.findFirstOrThrow({
        where: { id: creditNote.invoiceId, tenantId: organizationId },
      });
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        invoice.propertyId,
      );

      if (creditNote.status === 'POSTED') {
        const responseBody = this.toResponse(creditNote);
        await this.idempotency.resolveOrCreate(tx, {
          tenantId: organizationId,
          actorScope,
          operation,
          key: idempotencyKey,
          requestHash,
          responseStatus: 200,
          responseBody,
        });
        return { replayed: false as const, body: responseBody };
      }
      if (creditNote.status !== 'DRAFT') {
        throw new ConflictException({
          message: 'Only draft credit notes can be posted',
          code: 'CREDIT_NOTE_NOT_DRAFT',
        });
      }
      if (creditNote.totalAmount.gt(invoice.balanceAmount)) {
        throw new UnprocessableEntityException({
          message: 'Credit note exceeds invoice balance',
          code: 'CREDIT_NOTE_EXCEEDS_BALANCE',
        });
      }

      const postedAt = new Date(body.postedAt);
      const creditNoteNumber = await nextCreditNoteNumber(
        tx,
        organizationId,
        postedAt.getUTCFullYear(),
      );

      await tx.creditNote.update({
        where: { id: creditNote.id },
        data: {
          status: 'POSTED',
          creditNoteNumber,
          postedAt,
          version: { increment: 1 },
        },
      });

      const newBalance = roundMoney(invoice.balanceAmount.minus(creditNote.totalAmount));
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          balanceAmount: newBalance.lt(0) ? new Prisma.Decimal(0) : newBalance,
          status: newBalance.lte(0) ? 'PAID' : 'PARTIALLY_PAID',
          version: { increment: 1 },
        },
      });

      await this.ledger.postCreditNoteJournal(tx, {
        tenantId: organizationId,
        creditNoteId: creditNote.id,
        leaseId: creditNote.leaseId,
        currency: creditNote.currency,
        amount: creditNote.totalAmount,
        effectiveAt: postedAt,
      });

      const refreshed = await tx.creditNote.findFirstOrThrow({
        where: { id: creditNote.id, tenantId: organizationId },
      });
      const responseBody = this.toResponse(refreshed);

      await this.idempotency.resolveOrCreate(tx, {
        tenantId: organizationId,
        actorScope,
        operation,
        key: idempotencyKey,
        requestHash,
        responseStatus: 200,
        responseBody,
      });

      return { replayed: false as const, body: responseBody };
    });

    if (!result.replayed) {
      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'credit_note.post',
        outcome: 'SUCCESS',
        targetType: 'credit_note',
        targetId: creditNoteId,
        correlationId,
      });
    }

    return result;
  }

  private toResponse(row: {
    id: string;
    tenantId: string;
    invoiceId: string;
    creditNoteNumber: string | null;
    status: CreditNoteResponse['status'];
    currency: string;
    reason: string;
    totalAmount: Prisma.Decimal;
    version: number;
    postedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): CreditNoteResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      invoiceId: row.invoiceId,
      creditNoteNumber: row.creditNoteNumber,
      status: row.status,
      currency: row.currency,
      reason: row.reason,
      totalAmount: decimalToString(row.totalAmount),
      version: row.version,
      postedAt: row.postedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
