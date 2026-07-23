import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type DoNotRentFlag,
  type Party,
  type PartyContact,
  type ResidentProfile,
  type ResidentStatus,
} from '@prisma/client';

import {
  type ClearDoNotRentRequest,
  type CreateResidentRequest,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  type PatchResidentRequest,
  PERMISSION_KEYS,
  type ResidentDuplicateCheckRequest,
  type ResidentDuplicateCheckResponse,
  type ResidentResponse,
  type ResidentsCollection,
  type SetDoNotRentRequest,
} from '@rpm/contracts';

import { throwVersionMismatch } from '../../../common/auth/if-match';
import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  collectNormalizedContacts,
  encryptIdentifierValue,
  identifierLookupHash,
  isEmailContactType,
  isPhoneContactType,
  maskDateOfBirth,
  maskIdentifier,
  normalizeContactValue,
  normalizeEmail,
  normalizePhone,
} from '../domain/resident.rules';

type ResidentRecord = ResidentProfile & {
  party: Party & { contacts: PartyContact[] };
  doNotRentFlags?: DoNotRentFlag[];
};

@Injectable()
export class ResidentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listResidents(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      q?: string;
      status?: string;
      preferredPropertyId?: string;
      includeSensitive?: boolean;
      canViewNotes?: boolean;
    },
  ): Promise<ResidentsCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    // Property-scoped actors: only residents whose preferredPropertyId is in grant set
    // (null preferredPropertyId visible only to org-wide actors).
    const scopedWhere =
      accessible === null
        ? {
            ...(options?.preferredPropertyId !== undefined
              ? { preferredPropertyId: options.preferredPropertyId }
              : {}),
          }
        : {
            preferredPropertyId:
              options?.preferredPropertyId !== undefined
                ? accessible.includes(options.preferredPropertyId)
                  ? options.preferredPropertyId
                  : '00000000-0000-4000-8000-000000000000'
                : { in: accessible },
          };

    const profiles = await this.prisma.residentProfile.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ...scopedWhere,
        ...(options?.status !== undefined ? { status: options.status as ResidentStatus } : {}),
        ...(options?.q !== undefined
          ? {
              party: {
                OR: [
                  { displayName: { contains: options.q, mode: 'insensitive' } },
                  { legalName: { contains: options.q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
        ...(options?.after !== undefined ? { partyId: { gt: options.after } } : {}),
      },
      include: {
        party: { include: { contacts: true } },
        // active flag loaded separately via party relation would need nested; use find after map
      },
      orderBy: { partyId: 'asc' },
      take: limit + 1,
    });

    const pageItems = profiles.slice(0, limit);
    const hasMore = profiles.length > limit;
    const last = pageItems.at(-1);

    const partyIds = pageItems.map((item) => item.partyId);
    const activeFlags = await this.prisma.doNotRentFlag.findMany({
      where: {
        tenantId: organizationId,
        partyId: { in: partyIds },
        status: 'ACTIVE',
      },
    });
    const flagByParty = new Map(activeFlags.map((flag) => [flag.partyId, flag]));

    return {
      data: pageItems.map((item) =>
        this.toResponse(
          {
            ...item,
            doNotRentFlags: flagByParty.get(item.partyId) ? [flagByParty.get(item.partyId)!] : [],
          },
          {
            includeSensitive: options?.includeSensitive === true,
            canViewNotes: options?.canViewNotes === true,
          },
        ),
      ),
      page: {
        nextCursor: hasMore && last !== undefined ? last.partyId : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getResident(
    organizationId: string,
    membershipId: string,
    residentId: string,
    options?: { includeSensitive?: boolean; canViewNotes?: boolean },
  ): Promise<ResidentResponse> {
    const record = await this.findResident(organizationId, membershipId, residentId);
    return this.toResponse(record, {
      includeSensitive: options?.includeSensitive === true,
      canViewNotes: options?.canViewNotes === true,
    });
  }

  async createResident(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: CreateResidentRequest,
    correlationId?: string,
  ): Promise<ResidentResponse> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    if (accessible !== null) {
      if (body.preferredPropertyId === undefined) {
        throw new UnprocessableEntityException({
          message: 'preferredPropertyId is required for property-scoped actors',
          code: 'PREFERRED_PROPERTY_REQUIRED',
        });
      }
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        body.preferredPropertyId,
      );
    } else if (body.preferredPropertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        body.preferredPropertyId,
      );
    }

    const { emails, phones } = collectNormalizedContacts(body.contacts);
    const identifierHashes = (body.identifiers ?? []).map((item) =>
      identifierLookupHash(item.identifierType, item.value),
    );
    const candidates = await this.findDuplicateCandidates(organizationId, {
      emails,
      phones,
      identifierHashes,
    });
    if (candidates.length > 0 && body.confirmDuplicateProceed !== true) {
      throw new ConflictException({
        message: 'Possible duplicate residents found; confirm to proceed',
        code: 'DUPLICATE_PARTY_SUSPECTED',
        candidates,
      });
    }

    const created = await this.transactions.run(async (tx) => {
      const party = await tx.party.create({
        data: {
          tenantId: organizationId,
          partyType: 'PERSON',
          displayName: body.displayName,
          legalName: body.legalName ?? null,
          residentProfile: {
            create: {
              tenantId: organizationId,
              status: (body.status as ResidentStatus | undefined) ?? 'PROSPECT',
              preferredPropertyId: body.preferredPropertyId ?? null,
              dateOfBirth: body.dateOfBirth !== undefined ? new Date(body.dateOfBirth) : null,
              notes: body.notes ?? null,
            },
          },
          ...(body.contacts !== undefined && body.contacts.length > 0
            ? {
                contacts: {
                  create: body.contacts.map((contact) => ({
                    tenantId: organizationId,
                    type: contact.type,
                    value: normalizeContactValue(contact.type, contact.value),
                    purpose: contact.purpose ?? null,
                    isPreferred: contact.isPreferred ?? false,
                  })),
                },
              }
            : {}),
          ...(body.identifiers !== undefined && body.identifiers.length > 0
            ? {
                identifiers: {
                  create: body.identifiers.map((identifier) => ({
                    tenantId: organizationId,
                    identifierType: identifier.identifierType,
                    issuer: identifier.issuer ?? null,
                    valueEncrypted: encryptIdentifierValue(identifier.value),
                    lookupHash: identifierLookupHash(identifier.identifierType, identifier.value),
                  })),
                },
              }
            : {}),
        },
        include: {
          contacts: true,
          residentProfile: true,
        },
      });

      return party;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'resident.create',
      outcome: 'SUCCESS',
      targetType: 'resident',
      targetId: created.id,
      correlationId,
      changeSummary: {
        displayName: body.displayName,
        preferredPropertyId: body.preferredPropertyId ?? null,
      },
    });

    const profile = created.residentProfile!;
    const flags = await this.resolveSensitiveFlags(membershipId, organizationId);
    return this.toResponse(
      {
        ...profile,
        party: created,
        doNotRentFlags: [],
      },
      flags,
    );
  }

  async patchResident(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    residentId: string,
    body: PatchResidentRequest,
    ifMatchVersion: number,
    correlationId?: string,
    options?: { includeSensitive?: boolean; canViewNotes?: boolean },
  ): Promise<ResidentResponse> {
    const existing = await this.findResident(organizationId, membershipId, residentId);
    if (existing.version !== ifMatchVersion) {
      throwVersionMismatch('Resident version mismatch');
    }

    if (body.preferredPropertyId !== undefined && body.preferredPropertyId !== null) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        body.preferredPropertyId,
      );
    }

    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    if (accessible !== null && body.preferredPropertyId === null) {
      throw new UnprocessableEntityException({
        message: 'preferredPropertyId cannot be cleared by property-scoped actors',
        code: 'PREFERRED_PROPERTY_REQUIRED',
      });
    }

    const sensitiveFlags = await this.resolveSensitiveFlags(membershipId, organizationId);
    if (
      (body.dateOfBirth !== undefined || body.notes !== undefined) &&
      !sensitiveFlags.includeSensitive
    ) {
      throw new UnprocessableEntityException({
        message: 'Sensitive fields require residents.sensitive_data.view',
        code: 'SENSITIVE_FIELD_FORBIDDEN',
      });
    }

    const updated = await this.transactions.run(async (tx) => {
      await tx.party.update({
        where: { id: residentId },
        data: {
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
          version: { increment: 1 },
        },
      });

      await tx.residentProfile.update({
        where: { partyId: residentId },
        data: {
          ...(body.preferredPropertyId !== undefined
            ? { preferredPropertyId: body.preferredPropertyId }
            : {}),
          ...(body.dateOfBirth !== undefined
            ? {
                dateOfBirth: body.dateOfBirth === null ? null : new Date(body.dateOfBirth),
              }
            : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.status !== undefined ? { status: body.status as ResidentStatus } : {}),
          version: { increment: 1 },
        },
      });

      if (body.contacts !== undefined) {
        await tx.partyContact.deleteMany({ where: { partyId: residentId } });
        if (body.contacts.length > 0) {
          await tx.partyContact.createMany({
            data: body.contacts.map((contact) => ({
              tenantId: organizationId,
              partyId: residentId,
              type: contact.type,
              value: normalizeContactValue(contact.type, contact.value),
              purpose: contact.purpose ?? null,
              isPreferred: contact.isPreferred ?? false,
            })),
          });
        }
      }

      return tx.residentProfile.findFirstOrThrow({
        where: { partyId: residentId },
        include: { party: { include: { contacts: true } } },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'resident.update',
      outcome: 'SUCCESS',
      targetType: 'resident',
      targetId: residentId,
      correlationId,
      changeSummary: body as Record<string, unknown>,
    });

    const flags = await this.prisma.doNotRentFlag.findMany({
      where: { tenantId: organizationId, partyId: residentId, status: 'ACTIVE' },
    });

    return this.toResponse(
      { ...updated, doNotRentFlags: flags },
      {
        includeSensitive: options?.includeSensitive === true,
        canViewNotes: options?.canViewNotes === true,
      },
    );
  }

  async archiveResident(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    residentId: string,
    correlationId?: string,
  ): Promise<void> {
    const existing = await this.findResident(organizationId, membershipId, residentId);
    if (existing.legalHold) {
      throw new UnprocessableEntityException({
        message: 'Resident is under legal hold',
        code: 'LEGAL_HOLD_ACTIVE',
      });
    }

    await this.transactions.run(async (tx) => {
      await tx.residentProfile.update({
        where: { partyId: residentId },
        data: {
          status: 'ARCHIVED',
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.party.update({
        where: { id: residentId },
        data: { status: 'ARCHIVED', deletedAt: new Date(), version: { increment: 1 } },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'resident.archive',
      outcome: 'SUCCESS',
      targetType: 'resident',
      targetId: residentId,
      correlationId,
    });
  }

  async duplicateCheck(
    organizationId: string,
    membershipId: string,
    body: ResidentDuplicateCheckRequest,
  ): Promise<ResidentDuplicateCheckResponse> {
    // membership ensures org path isolation via controller guard; scope not required for check
    void membershipId;
    const emails = body.email !== undefined ? [normalizeEmail(body.email)] : [];
    const phones = body.phone !== undefined ? [normalizePhone(body.phone)] : [];
    const identifierHashes =
      body.identifierType !== undefined && body.identifierValue !== undefined
        ? [identifierLookupHash(body.identifierType, body.identifierValue)]
        : [];

    const candidates = await this.findDuplicateCandidates(
      organizationId,
      { emails, phones, identifierHashes },
      body.excludeResidentId,
    );

    return { candidates, autoMerge: false };
  }

  async setDoNotRent(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    residentId: string,
    body: SetDoNotRentRequest,
    correlationId?: string,
  ): Promise<ResidentResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      PERMISSION_KEYS.RESIDENTS_DO_NOT_RENT_MANAGE,
    );
    await this.findResident(organizationId, membershipId, residentId);

    await this.transactions.run(async (tx) => {
      await tx.doNotRentFlag.updateMany({
        where: { tenantId: organizationId, partyId: residentId, status: 'ACTIVE' },
        data: {
          status: 'CLEARED',
          clearedAt: new Date(),
          clearedByUserId: actorUserId,
          clearReason: 'Superseded by new flag',
        },
      });
      await tx.doNotRentFlag.create({
        data: {
          tenantId: organizationId,
          partyId: residentId,
          reason: body.reason,
          category: body.category ?? 'GENERAL',
          evidenceNote: body.evidenceNote ?? null,
          setByUserId: actorUserId,
          reviewAt: body.reviewAt !== undefined ? new Date(body.reviewAt) : null,
          expiresAt: body.expiresAt !== undefined ? new Date(body.expiresAt) : null,
          status: 'ACTIVE',
        },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'resident.do_not_rent.set',
      outcome: 'SUCCESS',
      targetType: 'resident',
      targetId: residentId,
      correlationId,
      changeSummary: { reason: body.reason, category: body.category ?? 'GENERAL' },
    });

    return this.getResident(organizationId, membershipId, residentId);
  }

  async clearDoNotRent(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    residentId: string,
    body: ClearDoNotRentRequest,
    correlationId?: string,
  ): Promise<ResidentResponse> {
    await this.authorization.assertPermission(
      membershipId,
      organizationId,
      PERMISSION_KEYS.RESIDENTS_DO_NOT_RENT_MANAGE,
    );
    await this.findResident(organizationId, membershipId, residentId);

    const updated = await this.prisma.doNotRentFlag.updateMany({
      where: { tenantId: organizationId, partyId: residentId, status: 'ACTIVE' },
      data: {
        status: 'CLEARED',
        clearedAt: new Date(),
        clearedByUserId: actorUserId,
        clearReason: body.reason,
      },
    });
    if (updated.count === 0) {
      throw new NotFoundException({
        message: 'Active do-not-rent flag not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'resident.do_not_rent.clear',
      outcome: 'SUCCESS',
      targetType: 'resident',
      targetId: residentId,
      correlationId,
      changeSummary: { reason: body.reason },
    });

    return this.getResident(organizationId, membershipId, residentId);
  }

  async resolveSensitiveFlags(
    membershipId: string,
    organizationId: string,
  ): Promise<{ includeSensitive: boolean; canViewNotes: boolean }> {
    const keys = await this.authorization.getEffectivePermissionKeys(membershipId);
    const includeSensitive = keys.includes(PERMISSION_KEYS.RESIDENTS_SENSITIVE_DATA_VIEW);
    const canUpdate = keys.includes(PERMISSION_KEYS.RESIDENTS_UPDATE);
    // Notes: require update + sensitive, or hide for auditor-style read-only
    const canViewNotes = includeSensitive && canUpdate;
    void organizationId;
    return { includeSensitive, canViewNotes };
  }

  private async findResident(
    organizationId: string,
    membershipId: string,
    residentId: string,
  ): Promise<ResidentRecord> {
    const profile = await this.prisma.residentProfile.findFirst({
      where: {
        tenantId: organizationId,
        partyId: residentId,
        deletedAt: null,
      },
      include: { party: { include: { contacts: true } } },
    });
    if (profile === null) {
      throw new NotFoundException({
        message: 'Resident not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    if (accessible !== null) {
      if (
        profile.preferredPropertyId === null ||
        !accessible.includes(profile.preferredPropertyId)
      ) {
        throw new NotFoundException({
          message: 'Resident not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
    }

    const flags = await this.prisma.doNotRentFlag.findMany({
      where: { tenantId: organizationId, partyId: residentId, status: 'ACTIVE' },
    });

    return { ...profile, doNotRentFlags: flags };
  }

  private async findDuplicateCandidates(
    organizationId: string,
    input: { emails: string[]; phones: string[]; identifierHashes: string[] },
    excludeResidentId?: string,
  ): Promise<
    Array<{
      residentId: string;
      partyId: string;
      displayName: string;
      matchReasons: string[];
    }>
  > {
    const reasonByParty = new Map<string, Set<string>>();

    const addReason = (partyId: string, reason: string) => {
      const set = reasonByParty.get(partyId) ?? new Set<string>();
      set.add(reason);
      reasonByParty.set(partyId, set);
    };

    if (input.emails.length > 0 || input.phones.length > 0) {
      const contacts = await this.prisma.partyContact.findMany({
        where: {
          tenantId: organizationId,
          party: {
            deletedAt: null,
            residentProfile: { isNot: null },
            ...(excludeResidentId !== undefined ? { id: { not: excludeResidentId } } : {}),
          },
        },
        include: { party: true },
      });
      for (const contact of contacts) {
        if (
          isEmailContactType(contact.type) &&
          input.emails.includes(normalizeEmail(contact.value))
        ) {
          addReason(contact.partyId, 'email');
        }
        if (
          isPhoneContactType(contact.type) &&
          input.phones.includes(normalizePhone(contact.value))
        ) {
          addReason(contact.partyId, 'phone');
        }
      }
    }

    if (input.identifierHashes.length > 0) {
      const identifiers = await this.prisma.partyIdentifier.findMany({
        where: {
          tenantId: organizationId,
          lookupHash: { in: input.identifierHashes },
          deletedAt: null,
          ...(excludeResidentId !== undefined ? { partyId: { not: excludeResidentId } } : {}),
        },
      });
      for (const identifier of identifiers) {
        addReason(identifier.partyId, 'identifier');
      }
    }

    if (reasonByParty.size === 0) {
      return [];
    }

    const parties = await this.prisma.party.findMany({
      where: {
        tenantId: organizationId,
        id: { in: [...reasonByParty.keys()] },
        residentProfile: { isNot: null },
      },
    });

    return parties.map((party) => ({
      residentId: party.id,
      partyId: party.id,
      displayName: party.displayName,
      matchReasons: [...(reasonByParty.get(party.id) ?? [])],
    }));
  }

  private toResponse(
    record: ResidentRecord,
    options: { includeSensitive: boolean; canViewNotes: boolean },
  ): ResidentResponse {
    const activeFlag = (record.doNotRentFlags ?? []).find((flag) => flag.status === 'ACTIVE');
    const response: ResidentResponse = {
      id: record.partyId,
      organizationId: record.tenantId,
      partyId: record.partyId,
      displayName: record.party.displayName,
      legalName: record.party.legalName,
      status: record.status,
      preferredPropertyId: record.preferredPropertyId,
      dateOfBirthMasked: maskDateOfBirth(record.dateOfBirth),
      retentionClass: record.retentionClass,
      legalHold: record.legalHold,
      version: record.version,
      contacts: record.party.contacts.map((contact) => ({
        id: contact.id,
        type: contact.type,
        value: options.includeSensitive ? contact.value : maskIdentifier(contact.value),
        purpose: contact.purpose,
        isPreferred: contact.isPreferred,
      })),
      activeDoNotRent:
        activeFlag !== undefined
          ? {
              id: activeFlag.id,
              status: activeFlag.status,
              category: activeFlag.category,
              reason: options.includeSensitive ? activeFlag.reason : undefined,
              reviewAt: activeFlag.reviewAt?.toISOString() ?? null,
              expiresAt: activeFlag.expiresAt?.toISOString() ?? null,
            }
          : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };

    if (options.includeSensitive) {
      response.dateOfBirth =
        record.dateOfBirth !== null ? record.dateOfBirth.toISOString().slice(0, 10) : null;
    }

    if (options.canViewNotes) {
      response.notes = record.notes;
    }

    return response;
  }
}
