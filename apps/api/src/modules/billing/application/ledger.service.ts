import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type LedgerEntriesCollection,
  type LedgerEntryResponse,
} from '@rpm/contracts';

import { isPrismaUniqueViolation } from '../../../infrastructure/prisma/prisma-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  DEFAULT_AR_ACCOUNT_CODE,
  DEFAULT_BANK_ACCOUNT_CODE,
  DEFAULT_CASH_ACCOUNT_CODE,
  DEFAULT_DEPOSIT_LIABILITY_ACCOUNT_CODE,
  DEFAULT_REVENUE_ACCOUNT_CODE,
  DEFAULT_UNAPPLIED_ACCOUNT_CODE,
  decimalToString,
  roundMoney,
} from '../domain/billing.rules';

export type JournalLineInput = {
  accountCode: string;
  side: 'DEBIT' | 'CREDIT';
  amount: Prisma.Decimal;
  postingKey: string;
  description?: string;
  leaseId?: string | null;
  reversalOfId?: string | null;
};

@Injectable()
export class LedgerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
  ) {}

  async listLedgerEntries(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      leaseId?: string;
      propertyId?: string;
      sourceType?: string;
    },
  ): Promise<LedgerEntriesCollection> {
    await this.authorization.assertAnyPermission(membershipId, organizationId, [
      'finance.invoices.view',
      'finance.reports.view',
    ]);

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

    const propertyFilter =
      accessible === null
        ? options?.propertyId !== undefined
          ? { propertyId: options.propertyId }
          : undefined
        : {
            propertyId:
              options?.propertyId !== undefined
                ? accessible.includes(options.propertyId)
                  ? options.propertyId
                  : '00000000-0000-4000-8000-000000000000'
                : { in: accessible },
          };

    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        tenantId: organizationId,
        ...(options?.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
        ...(options?.sourceType !== undefined ? { sourceType: options.sourceType } : {}),
        ...(propertyFilter !== undefined
          ? {
              OR: [
                { lease: { ...propertyFilter, deletedAt: null } },
                ...(accessible === null && options?.propertyId === undefined
                  ? [{ leaseId: null }]
                  : []),
              ],
            }
          : {}),
      },
      include: {
        account: { select: { code: true } },
        lease: { select: { propertyId: true } },
      },
      orderBy: [{ effectiveAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options?.after !== undefined ? { cursor: { id: options.after }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => this.toEntryResponse(row)),
      page: {
        nextCursor: rows.length > limit && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  private toEntryResponse(row: {
    id: string;
    tenantId: string;
    side: LedgerEntryResponse['side'];
    amount: Prisma.Decimal;
    currency: string;
    effectiveAt: Date;
    sourceType: string;
    sourceId: string;
    leaseId: string | null;
    description: string | null;
    createdAt: Date;
    account: { code: string };
    lease: { propertyId: string } | null;
  }): LedgerEntryResponse {
    return {
      id: row.id,
      organizationId: row.tenantId,
      accountCode: row.account.code,
      side: row.side,
      amount: decimalToString(row.amount),
      currency: row.currency,
      effectiveAt: row.effectiveAt.toISOString(),
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      leaseId: row.leaseId,
      propertyId: row.lease?.propertyId ?? null,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async ensureDefaultAccounts(
    tenantId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{
    arAccountId: string;
    revenueAccountId: string;
    depositLiabilityAccountId: string;
    cashAccountId: string;
    bankAccountId: string;
    unappliedAccountId: string;
  }> {
    const defaults = [
      {
        code: DEFAULT_AR_ACCOUNT_CODE,
        name: 'Accounts Receivable',
        accountType: 'RECEIVABLE' as const,
      },
      {
        code: DEFAULT_REVENUE_ACCOUNT_CODE,
        name: 'Rental Revenue',
        accountType: 'REVENUE' as const,
      },
      {
        code: DEFAULT_DEPOSIT_LIABILITY_ACCOUNT_CODE,
        name: 'Security Deposit Liability',
        accountType: 'LIABILITY' as const,
      },
      {
        code: DEFAULT_CASH_ACCOUNT_CODE,
        name: 'Cash on Hand',
        accountType: 'CONTROL' as const,
      },
      {
        code: DEFAULT_BANK_ACCOUNT_CODE,
        name: 'Bank Operating',
        accountType: 'CONTROL' as const,
      },
      {
        code: DEFAULT_UNAPPLIED_ACCOUNT_CODE,
        name: 'Unapplied Cash',
        accountType: 'LIABILITY' as const,
      },
    ];

    for (const account of defaults) {
      await tx.ledgerAccount.upsert({
        where: { tenantId_code: { tenantId, code: account.code } },
        create: {
          tenantId,
          code: account.code,
          name: account.name,
          accountType: account.accountType,
          active: true,
        },
        update: { active: true, name: account.name },
      });
    }

    const [ar, revenue, deposit, cash, bank, unapplied] = await Promise.all([
      tx.ledgerAccount.findFirstOrThrow({
        where: { tenantId, code: DEFAULT_AR_ACCOUNT_CODE },
      }),
      tx.ledgerAccount.findFirstOrThrow({
        where: { tenantId, code: DEFAULT_REVENUE_ACCOUNT_CODE },
      }),
      tx.ledgerAccount.findFirstOrThrow({
        where: { tenantId, code: DEFAULT_DEPOSIT_LIABILITY_ACCOUNT_CODE },
      }),
      tx.ledgerAccount.findFirstOrThrow({
        where: { tenantId, code: DEFAULT_CASH_ACCOUNT_CODE },
      }),
      tx.ledgerAccount.findFirstOrThrow({
        where: { tenantId, code: DEFAULT_BANK_ACCOUNT_CODE },
      }),
      tx.ledgerAccount.findFirstOrThrow({
        where: { tenantId, code: DEFAULT_UNAPPLIED_ACCOUNT_CODE },
      }),
    ]);

    return {
      arAccountId: ar.id,
      revenueAccountId: revenue.id,
      depositLiabilityAccountId: deposit.id,
      cashAccountId: cash.id,
      bankAccountId: bank.id,
      unappliedAccountId: unapplied.id,
    };
  }

  /**
   * Posts a balanced journal. Duplicate postingKey is treated as idempotent success.
   */
  async postBalancedJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      journalId: string;
      currency: string;
      effectiveAt: Date;
      sourceType: string;
      sourceId: string;
      lines: JournalLineInput[];
    },
  ): Promise<{ created: boolean; journalId: string }> {
    const lines = input.lines.map((line) => ({
      ...line,
      amount: roundMoney(line.amount),
    }));

    if (lines.length < 2) {
      throw new ConflictException({
        message: 'Journal requires at least two lines',
        code: 'LEDGER_UNBALANCED',
      });
    }

    let debit = new Prisma.Decimal(0);
    let credit = new Prisma.Decimal(0);
    for (const line of lines) {
      if (line.amount.lte(0)) {
        throw new ConflictException({
          message: 'Ledger amounts must be positive',
          code: 'LEDGER_AMOUNT_INVALID',
        });
      }
      if (line.side === 'DEBIT') {
        debit = debit.plus(line.amount);
      } else {
        credit = credit.plus(line.amount);
      }
    }
    if (!debit.equals(credit)) {
      throw new ConflictException({
        message: 'Journal debit and credit totals must match',
        code: 'LEDGER_UNBALANCED',
      });
    }

    await this.ensureDefaultAccounts(input.tenantId, tx);

    const accounts = await tx.ledgerAccount.findMany({
      where: {
        tenantId: input.tenantId,
        code: { in: [...new Set(lines.map((line) => line.accountCode))] },
      },
    });
    const byCode = new Map(accounts.map((account) => [account.code, account.id]));

    try {
      for (const line of lines) {
        const accountId = byCode.get(line.accountCode);
        if (accountId === undefined) {
          throw new ConflictException({
            message: `Unknown ledger account ${line.accountCode}`,
            code: 'LEDGER_ACCOUNT_MISSING',
          });
        }
        await tx.ledgerEntry.create({
          data: {
            tenantId: input.tenantId,
            accountId,
            leaseId: line.leaseId ?? null,
            journalId: input.journalId,
            side: line.side,
            amount: line.amount,
            currency: input.currency,
            effectiveAt: input.effectiveAt,
            postingKey: line.postingKey,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            description: line.description ?? null,
            reversalOfId: line.reversalOfId ?? null,
          },
        });
      }
      return { created: true, journalId: input.journalId };
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        return { created: false, journalId: input.journalId };
      }
      throw error;
    }
  }

  async postInvoiceRevenueJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      invoiceId: string;
      leaseId: string;
      currency: string;
      amount: Prisma.Decimal;
      effectiveAt: Date;
      description?: string;
    },
  ): Promise<void> {
    const amount = roundMoney(input.amount);
    if (amount.lte(0)) {
      return;
    }
    await this.postBalancedJournal(tx, {
      tenantId: input.tenantId,
      journalId: input.invoiceId,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      sourceType: 'INVOICE',
      sourceId: input.invoiceId,
      lines: [
        {
          accountCode: DEFAULT_AR_ACCOUNT_CODE,
          side: 'DEBIT',
          amount,
          postingKey: `invoice:${input.invoiceId}:ar`,
          leaseId: input.leaseId,
          description: input.description ?? 'Invoice AR',
        },
        {
          accountCode: DEFAULT_REVENUE_ACCOUNT_CODE,
          side: 'CREDIT',
          amount,
          postingKey: `invoice:${input.invoiceId}:revenue`,
          leaseId: input.leaseId,
          description: input.description ?? 'Invoice revenue',
        },
      ],
    });
  }

  async reverseInvoiceJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      invoiceId: string;
      leaseId: string;
      currency: string;
      amount: Prisma.Decimal;
      effectiveAt: Date;
    },
  ): Promise<void> {
    const amount = roundMoney(input.amount);
    if (amount.lte(0)) {
      return;
    }
    const originals = await tx.ledgerEntry.findMany({
      where: {
        tenantId: input.tenantId,
        sourceType: 'INVOICE',
        sourceId: input.invoiceId,
        reversalOfId: null,
      },
    });

    await this.postBalancedJournal(tx, {
      tenantId: input.tenantId,
      journalId: `${input.invoiceId}:void`,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      sourceType: 'INVOICE_VOID',
      sourceId: input.invoiceId,
      lines: [
        {
          accountCode: DEFAULT_REVENUE_ACCOUNT_CODE,
          side: 'DEBIT',
          amount,
          postingKey: `invoice:${input.invoiceId}:void:revenue`,
          leaseId: input.leaseId,
          description: 'Void invoice revenue',
          reversalOfId: originals.find((entry) => entry.side === 'CREDIT')?.id ?? null,
        },
        {
          accountCode: DEFAULT_AR_ACCOUNT_CODE,
          side: 'CREDIT',
          amount,
          postingKey: `invoice:${input.invoiceId}:void:ar`,
          leaseId: input.leaseId,
          description: 'Void invoice AR',
          reversalOfId: originals.find((entry) => entry.side === 'DEBIT')?.id ?? null,
        },
      ],
    });
  }

  async postCreditNoteJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      creditNoteId: string;
      leaseId: string;
      currency: string;
      amount: Prisma.Decimal;
      effectiveAt: Date;
    },
  ): Promise<void> {
    const amount = roundMoney(input.amount);
    if (amount.lte(0)) {
      return;
    }
    await this.postBalancedJournal(tx, {
      tenantId: input.tenantId,
      journalId: input.creditNoteId,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      sourceType: 'CREDIT_NOTE',
      sourceId: input.creditNoteId,
      lines: [
        {
          accountCode: DEFAULT_REVENUE_ACCOUNT_CODE,
          side: 'DEBIT',
          amount,
          postingKey: `credit_note:${input.creditNoteId}:revenue`,
          leaseId: input.leaseId,
          description: 'Credit note revenue reduction',
        },
        {
          accountCode: DEFAULT_AR_ACCOUNT_CODE,
          side: 'CREDIT',
          amount,
          postingKey: `credit_note:${input.creditNoteId}:ar`,
          leaseId: input.leaseId,
          description: 'Credit note AR reduction',
        },
      ],
    });
  }

  /**
   * Settlement journal with unapplied cash (O1):
   * Dr cash/bank for full payment; Cr AR for allocated; Cr unapplied for remainder.
   * Later allocate: Dr unapplied Cr AR.
   */
  async postPaymentSettlementJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      paymentTransactionId: string;
      leaseId: string | null;
      currency: string;
      amount: Prisma.Decimal;
      effectiveAt: Date;
      channel: string;
      description?: string;
      /** Distinguishes initial settlement vs later allocate batches. */
      postingBatchId?: string;
      /** Full cash received on initial record (defaults to amount when omitted). */
      cashAmount?: Prisma.Decimal;
      /** When true, treat amount as moving unapplied → AR (no cash debit). */
      fromUnapplied?: boolean;
    },
  ): Promise<void> {
    await this.ensureDefaultAccounts(input.tenantId, tx);
    const amount = roundMoney(input.amount);
    if (amount.lte(0) && (input.cashAmount === undefined || roundMoney(input.cashAmount).lte(0))) {
      return;
    }
    const cashLike =
      input.channel === 'CASH' ? DEFAULT_CASH_ACCOUNT_CODE : DEFAULT_BANK_ACCOUNT_CODE;
    const batch = input.postingBatchId ?? input.paymentTransactionId;

    if (input.fromUnapplied === true) {
      if (amount.lte(0)) {
        return;
      }
      await this.postBalancedJournal(tx, {
        tenantId: input.tenantId,
        journalId: `${batch}:unapplied`,
        currency: input.currency,
        effectiveAt: input.effectiveAt,
        sourceType: 'PAYMENT',
        sourceId: input.paymentTransactionId,
        lines: [
          {
            accountCode: DEFAULT_UNAPPLIED_ACCOUNT_CODE,
            side: 'DEBIT',
            amount,
            postingKey: `payment:${input.paymentTransactionId}:${batch}:unapplied`,
            leaseId: input.leaseId,
            description: input.description ?? 'Allocate unapplied cash',
          },
          {
            accountCode: DEFAULT_AR_ACCOUNT_CODE,
            side: 'CREDIT',
            amount,
            postingKey: `payment:${input.paymentTransactionId}:${batch}:ar`,
            leaseId: input.leaseId,
            description: input.description ?? 'Payment AR settlement',
          },
        ],
      });
      return;
    }

    const cashAmount = roundMoney(input.cashAmount ?? amount);
    const allocated = amount;
    const unapplied = roundMoney(cashAmount.minus(allocated));
    const lines: JournalLineInput[] = [
      {
        accountCode: cashLike,
        side: 'DEBIT',
        amount: cashAmount,
        postingKey: `payment:${input.paymentTransactionId}:${batch}:cash`,
        leaseId: input.leaseId,
        description: input.description ?? 'Payment receipt',
      },
    ];
    if (allocated.gt(0)) {
      lines.push({
        accountCode: DEFAULT_AR_ACCOUNT_CODE,
        side: 'CREDIT',
        amount: allocated,
        postingKey: `payment:${input.paymentTransactionId}:${batch}:ar`,
        leaseId: input.leaseId,
        description: input.description ?? 'Payment AR settlement',
      });
    }
    if (unapplied.gt(0)) {
      lines.push({
        accountCode: DEFAULT_UNAPPLIED_ACCOUNT_CODE,
        side: 'CREDIT',
        amount: unapplied,
        postingKey: `payment:${input.paymentTransactionId}:${batch}:unapplied`,
        leaseId: input.leaseId,
        description: input.description ?? 'Unapplied cash',
      });
    }
    if (lines.length < 2) {
      return;
    }
    await this.postBalancedJournal(tx, {
      tenantId: input.tenantId,
      journalId: batch,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      sourceType: 'PAYMENT',
      sourceId: input.paymentTransactionId,
      lines,
    });
  }

  /** Reverse a prior settlement: Dr AR (+ unapplied) Cr cash for payment amount. */
  async postPaymentReversalJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      paymentTransactionId: string;
      reversalId: string;
      leaseId: string | null;
      currency: string;
      allocatedAmount: Prisma.Decimal;
      unallocatedAmount: Prisma.Decimal;
      effectiveAt: Date;
      channel: string;
    },
  ): Promise<void> {
    await this.ensureDefaultAccounts(input.tenantId, tx);
    const allocated = roundMoney(input.allocatedAmount);
    const unallocated = roundMoney(input.unallocatedAmount);
    const total = roundMoney(allocated.plus(unallocated));
    if (total.lte(0)) {
      return;
    }
    const cashLike =
      input.channel === 'CASH' ? DEFAULT_CASH_ACCOUNT_CODE : DEFAULT_BANK_ACCOUNT_CODE;
    const lines: JournalLineInput[] = [];
    if (allocated.gt(0)) {
      lines.push({
        accountCode: DEFAULT_AR_ACCOUNT_CODE,
        side: 'DEBIT',
        amount: allocated,
        postingKey: `payment_reversal:${input.reversalId}:ar`,
        leaseId: input.leaseId,
        description: 'Payment reversal AR restore',
      });
    }
    if (unallocated.gt(0)) {
      lines.push({
        accountCode: DEFAULT_UNAPPLIED_ACCOUNT_CODE,
        side: 'DEBIT',
        amount: unallocated,
        postingKey: `payment_reversal:${input.reversalId}:unapplied`,
        leaseId: input.leaseId,
        description: 'Payment reversal unapplied restore',
      });
    }
    lines.push({
      accountCode: cashLike,
      side: 'CREDIT',
      amount: total,
      postingKey: `payment_reversal:${input.reversalId}:cash`,
      leaseId: input.leaseId,
      description: 'Payment reversal cash',
    });
    await this.postBalancedJournal(tx, {
      tenantId: input.tenantId,
      journalId: input.reversalId,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      sourceType: 'PAYMENT_REVERSAL',
      sourceId: input.reversalId,
      lines,
    });
  }

  /** Refund execute: Dr AR Cr cash for refund amount (reduce collected funds). */
  async postRefundJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      refundId: string;
      leaseId: string | null;
      currency: string;
      amount: Prisma.Decimal;
      effectiveAt: Date;
      channel: string;
      fromUnapplied: Prisma.Decimal;
      fromAr: Prisma.Decimal;
    },
  ): Promise<void> {
    await this.ensureDefaultAccounts(input.tenantId, tx);
    const amount = roundMoney(input.amount);
    if (amount.lte(0)) {
      return;
    }
    const cashLike =
      input.channel === 'CASH' ? DEFAULT_CASH_ACCOUNT_CODE : DEFAULT_BANK_ACCOUNT_CODE;
    const fromUnapplied = roundMoney(input.fromUnapplied);
    const fromAr = roundMoney(input.fromAr);
    const lines: JournalLineInput[] = [];
    if (fromAr.gt(0)) {
      lines.push({
        accountCode: DEFAULT_AR_ACCOUNT_CODE,
        side: 'DEBIT',
        amount: fromAr,
        postingKey: `refund:${input.refundId}:ar`,
        leaseId: input.leaseId,
        description: 'Refund AR restore',
      });
    }
    if (fromUnapplied.gt(0)) {
      lines.push({
        accountCode: DEFAULT_UNAPPLIED_ACCOUNT_CODE,
        side: 'DEBIT',
        amount: fromUnapplied,
        postingKey: `refund:${input.refundId}:unapplied`,
        leaseId: input.leaseId,
        description: 'Refund unapplied reduction',
      });
    }
    lines.push({
      accountCode: cashLike,
      side: 'CREDIT',
      amount,
      postingKey: `refund:${input.refundId}:cash`,
      leaseId: input.leaseId,
      description: 'Refund cash outflow',
    });
    await this.postBalancedJournal(tx, {
      tenantId: input.tenantId,
      journalId: input.refundId,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      sourceType: 'REFUND',
      sourceId: input.refundId,
      lines,
    });
  }

  /**
   * Deposit disposition: release liability via refund (Dr liability Cr cash/bank),
   * forfeit (Dr liability Cr revenue), or deduction (Dr liability Cr AR).
   */
  async postDepositDispositionJournal(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      dispositionId: string;
      leaseId: string;
      currency: string;
      amount: Prisma.Decimal;
      effectiveAt: Date;
      dispositionType: 'REFUND' | 'FORFEIT' | 'DEDUCTION' | 'TRANSFER' | 'REMAINING_HELD';
      description?: string;
    },
  ): Promise<void> {
    const amount = roundMoney(input.amount);
    if (amount.lte(0)) {
      return;
    }
    if (input.dispositionType === 'TRANSFER' || input.dispositionType === 'REMAINING_HELD') {
      return;
    }

    const creditAccount =
      input.dispositionType === 'REFUND'
        ? DEFAULT_CASH_ACCOUNT_CODE
        : input.dispositionType === 'FORFEIT'
          ? DEFAULT_REVENUE_ACCOUNT_CODE
          : DEFAULT_AR_ACCOUNT_CODE;

    await this.postBalancedJournal(tx, {
      tenantId: input.tenantId,
      journalId: input.dispositionId,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      sourceType: 'DEPOSIT_DISPOSITION',
      sourceId: input.dispositionId,
      lines: [
        {
          accountCode: DEFAULT_DEPOSIT_LIABILITY_ACCOUNT_CODE,
          side: 'DEBIT',
          amount,
          postingKey: `deposit_disposition:${input.dispositionId}:liability`,
          leaseId: input.leaseId,
          description: input.description ?? 'Deposit disposition liability release',
        },
        {
          accountCode: creditAccount,
          side: 'CREDIT',
          amount,
          postingKey: `deposit_disposition:${input.dispositionId}:offset`,
          leaseId: input.leaseId,
          description: input.description ?? `Deposit disposition ${input.dispositionType}`,
        },
      ],
    });
  }
}
