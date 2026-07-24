import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  INVOICE_POSTED_EVENT_TYPE,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type InvoiceResponse,
  type InvoicesCollection,
  type PostInvoiceRequest,
  type VoidInvoiceRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  addCalendarDays,
  decimalToString,
  DUE_DAYS_AFTER_ISSUE,
  formatDateOnly,
  nextInvoiceNumber,
  parseDateOnly,
  roundMoney,
} from '../domain/billing.rules';

import { LedgerService } from './ledger.service';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(LedgerService) private readonly ledger: LedgerService,
  ) {}

  async listInvoices(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      status?: string;
      leaseId?: string;
      propertyId?: string;
      periodKey?: string;
    },
  ): Promise<InvoicesCollection> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.invoices.list',
    );
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    if (options?.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        options.propertyId,
      );
    }

    const propertyScope =
      accessible === null
        ? options?.propertyId !== undefined
          ? { propertyId: options.propertyId }
          : {}
        : {
            propertyId:
              options?.propertyId !== undefined
                ? accessible.includes(options.propertyId)
                  ? options.propertyId
                  : '00000000-0000-4000-8000-000000000000'
                : { in: accessible },
          };

    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: organizationId,
        ...propertyScope,
        ...(options?.status !== undefined
          ? { status: options.status as Prisma.EnumInvoiceStatusFilter['equals'] }
          : {}),
        ...(options?.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
        ...(options?.periodKey !== undefined ? { periodKey: options.periodKey } : {}),
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.toResponse(row, true)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getInvoice(
    organizationId: string,
    membershipId: string,
    invoiceId: string,
  ): Promise<InvoiceResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.invoices.view',
    );
    const row = await this.findInvoiceOrThrow(organizationId, invoiceId);
    await this.authorization.assertPropertyAccess(membershipId, organizationId, row.propertyId);
    return this.toResponse(row, true);
  }

  async postInvoice(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    invoiceId: string,
    body: PostInvoiceRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: InvoiceResponse }> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.invoices.issue',
    );
    const operation = `POST /v1/organizations/${organizationId}/invoices/${invoiceId}/post`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return { replayed: true, body: existing.responseBody as InvoiceResponse };
    }

    const result = await this.transactions.run(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId: organizationId },
        include: { lines: true },
      });
      if (invoice === null) {
        throw new NotFoundException({ message: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
      }
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        invoice.propertyId,
      );
      if (invoice.version !== expectedVersion) {
        throwVersionMismatch('Invoice version mismatch');
      }
      if (
        invoice.status === 'POSTED' ||
        invoice.status === 'PARTIALLY_PAID' ||
        invoice.status === 'PAID'
      ) {
        const responseBody = this.toResponse(invoice, true);
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
      if (invoice.status !== 'DRAFT') {
        throw new ConflictException({
          message: 'Only draft invoices can be posted',
          code: 'INVOICE_NOT_DRAFT',
        });
      }
      if (invoice.lines.length === 0) {
        throw new UnprocessableEntityException({
          message: 'Invoice has no lines',
          code: 'INVOICE_EMPTY',
        });
      }

      const postedAt = new Date(body.postedAt);
      const issueDate = parseDateOnly(formatDateOnly(postedAt));
      const dueDate = addCalendarDays(issueDate, DUE_DAYS_AFTER_ISSUE);
      const invoiceNumber = await nextInvoiceNumber(tx, organizationId, postedAt.getUTCFullYear());

      const totals = this.recomputeTotals(invoice.lines);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'POSTED',
          invoiceNumber,
          issueDate,
          dueDate,
          postedAt,
          subtotalAmount: totals.subtotal,
          taxAmount: totals.tax,
          totalAmount: totals.total,
          balanceAmount: totals.total,
          version: { increment: 1 },
        },
      });

      await tx.invoiceStatusHistory.create({
        data: {
          tenantId: organizationId,
          invoiceId: invoice.id,
          fromStatus: 'DRAFT',
          toStatus: 'POSTED',
          reason: 'Invoice posted',
          actorUserId,
        },
      });

      await this.ledger.postInvoiceRevenueJournal(tx, {
        tenantId: organizationId,
        invoiceId: invoice.id,
        leaseId: invoice.leaseId,
        currency: invoice.currency,
        amount: totals.total,
        effectiveAt: postedAt,
      });

      await this.outbox.appendInTransaction(tx, {
        aggregateType: 'invoice',
        aggregateId: invoice.id,
        eventType: INVOICE_POSTED_EVENT_TYPE,
        payload: {
          tenantId: organizationId,
          invoiceId: invoice.id,
          leaseId: invoice.leaseId,
          invoiceNumber,
        },
        correlationId,
        tenantId: organizationId,
      });

      const refreshed = await tx.invoice.findFirstOrThrow({
        where: { id: invoice.id, tenantId: organizationId },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      const responseBody = this.toResponse(refreshed, true);

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
        action: 'invoice.post',
        outcome: 'SUCCESS',
        targetType: 'invoice',
        targetId: invoiceId,
        correlationId,
      });
    }

    return result;
  }

  async voidInvoice(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    invoiceId: string,
    body: VoidInvoiceRequest,
    expectedVersion: number,
    idempotencyKey: string,
    requestHash: string,
    correlationId?: string,
  ): Promise<{ replayed: boolean; body: InvoiceResponse }> {
    await this.authorization.assertPermission(membershipId, organizationId, 'finance.charges.void');
    const operation = `POST /v1/organizations/${organizationId}/invoices/${invoiceId}/void`;
    const actorScope = actorScopeFromOrganization(organizationId);

    const existing = await this.idempotency.findExisting(
      organizationId,
      actorScope,
      operation,
      idempotencyKey,
    );
    if (existing !== null && existing.requestHash === requestHash) {
      return { replayed: true, body: existing.responseBody as InvoiceResponse };
    }

    const result = await this.transactions.run(async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId}::uuid AND tenant_id = ${organizationId}::uuid FOR UPDATE`;

      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId: organizationId },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      if (invoice === null) {
        throw new NotFoundException({ message: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
      }
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        invoice.propertyId,
      );
      if (invoice.version !== expectedVersion) {
        throwVersionMismatch('Invoice version mismatch');
      }
      if (invoice.status === 'VOID') {
        const responseBody = this.toResponse(invoice, true);
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
      if (invoice.status !== 'POSTED') {
        throw new ConflictException({
          message: 'Only posted invoices can be voided',
          code: 'INVOICE_NOT_POSTED',
        });
      }

      const postedCreditNotes = await tx.creditNote.count({
        where: {
          tenantId: organizationId,
          invoiceId: invoice.id,
          status: 'POSTED',
        },
      });
      if (postedCreditNotes > 0) {
        throw new ConflictException({
          message: 'Cannot void invoice with posted credit notes',
          code: 'CREDIT_NOTES_EXIST',
        });
      }

      const effectiveAt = new Date(body.effectiveAt);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'VOID',
          voidedAt: effectiveAt,
          balanceAmount: new Prisma.Decimal(0),
          version: { increment: 1 },
        },
      });

      await tx.invoiceStatusHistory.create({
        data: {
          tenantId: organizationId,
          invoiceId: invoice.id,
          fromStatus: 'POSTED',
          toStatus: 'VOID',
          reason: body.reason,
          actorUserId,
        },
      });

      await this.ledger.reverseInvoiceJournal(tx, {
        tenantId: organizationId,
        invoiceId: invoice.id,
        leaseId: invoice.leaseId,
        currency: invoice.currency,
        amount: invoice.totalAmount,
        effectiveAt,
      });

      const refreshed = await tx.invoice.findFirstOrThrow({
        where: { id: invoice.id, tenantId: organizationId },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      const responseBody = this.toResponse(refreshed, true);

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
        action: 'invoice.void',
        outcome: 'SUCCESS',
        targetType: 'invoice',
        targetId: invoiceId,
        correlationId,
        changeSummary: { reason: body.reason },
      });
    }

    return result;
  }

  /** Posted invoice lines are immutable — reject delete attempts. */
  async rejectDeletePostedLine(
    organizationId: string,
    membershipId: string,
    invoiceId: string,
    _lineId: string,
  ): Promise<never> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      'finance.invoices.view',
    );
    const invoice = await this.findInvoiceOrThrow(organizationId, invoiceId);
    if (invoice.status !== 'DRAFT') {
      throw new ConflictException({
        message: 'Posted invoice lines cannot be deleted; use credit note or void',
        code: 'INVOICE_LINE_IMMUTABLE',
      });
    }
    throw new ConflictException({
      message: 'Invoice line delete is not supported; recreate the draft invoice',
      code: 'INVOICE_LINE_DELETE_UNSUPPORTED',
    });
  }

  async postDraftInvoiceInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    invoiceId: string,
    actorUserId: string | null,
    postedAt: Date,
  ): Promise<void> {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, tenantId: organizationId },
      include: { lines: true },
    });
    if (invoice === null || invoice.status !== 'DRAFT') {
      return;
    }

    const issueDate = parseDateOnly(formatDateOnly(postedAt));
    const dueDate = addCalendarDays(issueDate, DUE_DAYS_AFTER_ISSUE);
    const invoiceNumber = await nextInvoiceNumber(tx, organizationId, postedAt.getUTCFullYear());
    const totals = this.recomputeTotals(invoice.lines);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'POSTED',
        invoiceNumber,
        issueDate,
        dueDate,
        postedAt,
        subtotalAmount: totals.subtotal,
        taxAmount: totals.tax,
        totalAmount: totals.total,
        balanceAmount: totals.total,
        version: { increment: 1 },
      },
    });

    await tx.invoiceStatusHistory.create({
      data: {
        tenantId: organizationId,
        invoiceId: invoice.id,
        fromStatus: 'DRAFT',
        toStatus: 'POSTED',
        reason: 'Billing run commit',
        actorUserId,
      },
    });

    await this.ledger.postInvoiceRevenueJournal(tx, {
      tenantId: organizationId,
      invoiceId: invoice.id,
      leaseId: invoice.leaseId,
      currency: invoice.currency,
      amount: totals.total,
      effectiveAt: postedAt,
    });
  }

  private async findInvoiceOrThrow(organizationId: string, invoiceId: string) {
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: organizationId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (row === null) {
      throw new NotFoundException({ message: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
    }
    return row;
  }

  private recomputeTotals(lines: Array<{ lineTotal: Prisma.Decimal; taxAmount: Prisma.Decimal }>): {
    subtotal: Prisma.Decimal;
    tax: Prisma.Decimal;
    total: Prisma.Decimal;
  } {
    let subtotal = new Prisma.Decimal(0);
    let tax = new Prisma.Decimal(0);
    for (const line of lines) {
      subtotal = subtotal.plus(line.lineTotal);
      tax = tax.plus(line.taxAmount);
    }
    subtotal = roundMoney(subtotal);
    tax = roundMoney(tax);
    return { subtotal, tax, total: roundMoney(subtotal.plus(tax)) };
  }

  toResponse(
    row: {
      id: string;
      tenantId: string;
      leaseId: string;
      propertyId: string;
      billingRunId: string | null;
      billToPartyId: string;
      invoiceNumber: string | null;
      status: InvoiceResponse['status'];
      currency: string;
      issueDate: Date | null;
      dueDate: Date | null;
      periodKey: string | null;
      subtotalAmount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      balanceAmount: Prisma.Decimal;
      version: number;
      postedAt: Date | null;
      voidedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      lines?: Array<{
        id: string;
        lineNumber: number;
        description: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        currency: string;
        servicePeriodStart: Date | null;
        servicePeriodEnd: Date | null;
      }>;
    },
    includeLines: boolean,
  ): InvoiceResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      leaseId: row.leaseId,
      propertyId: row.propertyId,
      billingRunId: row.billingRunId,
      billToPartyId: row.billToPartyId,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      currency: row.currency,
      issueDate: row.issueDate !== null ? formatDateOnly(row.issueDate) : null,
      dueDate: row.dueDate !== null ? formatDateOnly(row.dueDate) : null,
      periodKey: row.periodKey,
      subtotalAmount: decimalToString(row.subtotalAmount),
      taxAmount: decimalToString(row.taxAmount),
      totalAmount: decimalToString(row.totalAmount),
      balanceAmount: decimalToString(row.balanceAmount),
      version: row.version,
      postedAt: row.postedAt?.toISOString() ?? null,
      voidedAt: row.voidedAt?.toISOString() ?? null,
      ...(includeLines && row.lines !== undefined
        ? {
            lines: row.lines.map((line) => ({
              id: line.id,
              lineNumber: line.lineNumber,
              description: line.description,
              quantity: decimalToString(line.quantity),
              unitAmount: decimalToString(line.unitPrice),
              lineAmount: decimalToString(line.lineTotal),
              taxAmount: decimalToString(line.taxAmount),
              currency: line.currency,
              servicePeriodStart:
                line.servicePeriodStart !== null ? formatDateOnly(line.servicePeriodStart) : null,
              servicePeriodEnd:
                line.servicePeriodEnd !== null ? formatDateOnly(line.servicePeriodEnd) : null,
            })),
          }
        : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
