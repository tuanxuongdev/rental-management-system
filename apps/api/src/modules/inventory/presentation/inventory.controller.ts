import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  availabilityQuerySchema,
  createAmenityRequestSchema,
  createBedRequestSchema,
  createBuildingRequestSchema,
  createPropertyRequestSchema,
  createUnitRequestSchema,
  listUnitsQuerySchema,
  paginationQuerySchema,
  patchBedRequestSchema,
  patchBuildingRequestSchema,
  patchPropertyRequestSchema,
  patchUnitRequestSchema,
  PERMISSION_KEYS,
  replaceAmenitiesRequestSchema,
  restoreRequestSchema,
  unitStatusRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { requireIfMatchVersion } from '../../../common/auth/if-match';
import { OrganizationPathGuard } from '../../../common/auth/organization.guards';
import { PermissionsGuard } from '../../../common/auth/permissions.guard';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import { AmenityService } from '../application/amenity.service';
import { AvailabilityService } from '../application/availability.service';
import { BedService } from '../application/bed.service';
import { BuildingService } from '../application/building.service';
import { PropertyService } from '../application/property.service';
import { UnitService } from '../application/unit.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';

@Controller('organizations/:organizationId')
@UseGuards(OrganizationPathGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    @Inject(PropertyService) private readonly properties: PropertyService,
    @Inject(BuildingService) private readonly buildings: BuildingService,
    @Inject(UnitService) private readonly units: UnitService,
    @Inject(BedService) private readonly beds: BedService,
    @Inject(AmenityService) private readonly amenities: AmenityService,
    @Inject(AvailabilityService) private readonly availability: AvailabilityService,
  ) {}

  @Get('properties')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_LIST)
  listProperties(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.properties.listProperties(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      status: typeof query.status === 'string' ? query.status : undefined,
      q: typeof query.q === 'string' ? query.q : undefined,
    });
  }

  @Post('properties')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_CREATE)
  createProperty(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createPropertyRequestSchema.parse(body);
    return this.properties.createProperty(
      organizationId,
      actor.userId,
      actor.membershipId!,
      parsed,
      request.correlationId,
    );
  }

  @Get('properties/:propertyId')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_VIEW)
  getProperty(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.properties.getProperty(organizationId, actor.membershipId!, propertyId);
  }

  @Patch('properties/:propertyId')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_UPDATE)
  patchProperty(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchPropertyRequestSchema.parse(body);
    return this.properties.patchProperty(
      organizationId,
      actor.membershipId!,
      actor.userId,
      propertyId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Delete('properties/:propertyId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_ARCHIVE)
  async archiveProperty(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    await this.properties.archiveProperty(
      organizationId,
      actor.membershipId!,
      actor.userId,
      propertyId,
      request.correlationId,
    );
  }

  @Post('properties/:propertyId/restore')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_UPDATE)
  restoreProperty(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = restoreRequestSchema.parse(body);
    return this.properties.restoreProperty(
      organizationId,
      actor.membershipId!,
      actor.userId,
      propertyId,
      parsed.reason,
      request.correlationId,
    );
  }

  @Get('properties/:propertyId/buildings')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_VIEW)
  listBuildings(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.buildings.listBuildings(organizationId, actor.membershipId!, propertyId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post('properties/:propertyId/buildings')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_UPDATE)
  createBuilding(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createBuildingRequestSchema.parse(body);
    return this.buildings.createBuilding(
      organizationId,
      actor.membershipId!,
      actor.userId,
      propertyId,
      parsed,
      request.correlationId,
    );
  }

  @Get('buildings/:buildingId')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_VIEW)
  getBuilding(
    @Param('organizationId') organizationId: string,
    @Param('buildingId') buildingId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.buildings.getBuilding(organizationId, actor.membershipId!, buildingId);
  }

  @Patch('buildings/:buildingId')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_UPDATE)
  patchBuilding(
    @Param('organizationId') organizationId: string,
    @Param('buildingId') buildingId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchBuildingRequestSchema.parse(body);
    return this.buildings.patchBuilding(
      organizationId,
      actor.membershipId!,
      actor.userId,
      buildingId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Delete('buildings/:buildingId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_ARCHIVE)
  async archiveBuilding(
    @Param('organizationId') organizationId: string,
    @Param('buildingId') buildingId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    await this.buildings.archiveBuilding(
      organizationId,
      actor.membershipId!,
      actor.userId,
      buildingId,
      request.correlationId,
    );
  }

  @Get('units')
  @RequirePermissions(PERMISSION_KEYS.UNITS_LIST)
  listUnitsOrgWide(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = listUnitsQuerySchema.parse(query);
    return this.units.listUnitsOrgWide(organizationId, actor.membershipId!, {
      limit: parsed.limit,
      after: parsed.after,
      propertyId: parsed.propertyId,
      status: parsed.status,
      q: parsed.q,
      unitType: parsed.unitType,
      operationalStatus: parsed.operationalStatus,
    });
  }

  @Get('properties/:propertyId/units')
  @RequirePermissions(PERMISSION_KEYS.UNITS_LIST)
  listUnits(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.units.listUnits(organizationId, actor.membershipId!, propertyId, {
      limit: parsed.limit,
      after: parsed.after,
      status: typeof query.status === 'string' ? query.status : undefined,
      buildingId: typeof query.buildingId === 'string' ? query.buildingId : undefined,
      q: typeof query.q === 'string' ? query.q : undefined,
    });
  }

  @Post('properties/:propertyId/units')
  @RequirePermissions(PERMISSION_KEYS.UNITS_CREATE)
  createUnit(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createUnitRequestSchema.parse(body);
    return this.units.createUnit(
      organizationId,
      actor.membershipId!,
      actor.userId,
      propertyId,
      parsed,
      request.correlationId,
    );
  }

  @Get('units/:unitId')
  @RequirePermissions(PERMISSION_KEYS.UNITS_VIEW)
  getUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.units.getUnit(organizationId, actor.membershipId!, unitId);
  }

  @Patch('units/:unitId')
  @RequirePermissions(PERMISSION_KEYS.UNITS_UPDATE)
  patchUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchUnitRequestSchema.parse(body);
    return this.units.patchUnit(
      organizationId,
      actor.membershipId!,
      actor.userId,
      unitId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Delete('units/:unitId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_KEYS.UNITS_ARCHIVE)
  async archiveUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    await this.units.archiveUnit(
      organizationId,
      actor.membershipId!,
      actor.userId,
      unitId,
      request.correlationId,
    );
  }

  @Post('units/:unitId/restore')
  @RequirePermissions(PERMISSION_KEYS.UNITS_UPDATE)
  restoreUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = restoreRequestSchema.parse(body);
    return this.units.restoreUnit(
      organizationId,
      actor.membershipId!,
      actor.userId,
      unitId,
      parsed.reason,
      request.correlationId,
    );
  }

  @Post('units/:unitId/status')
  @RequirePermissions(PERMISSION_KEYS.UNITS_UPDATE)
  updateUnitStatus(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = unitStatusRequestSchema.parse(body);
    return this.units.updateOperationalStatus(
      organizationId,
      actor.membershipId!,
      actor.userId,
      unitId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Get('units/:unitId/beds')
  @RequirePermissions(PERMISSION_KEYS.BEDS_LIST)
  listBeds(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.beds.listBeds(organizationId, actor.membershipId!, unitId, {
      limit: parsed.limit,
      after: parsed.after,
    });
  }

  @Post('units/:unitId/beds')
  @RequirePermissions(PERMISSION_KEYS.BEDS_CREATE)
  createBed(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createBedRequestSchema.parse(body);
    return this.beds.createBed(
      organizationId,
      actor.membershipId!,
      actor.userId,
      unitId,
      parsed,
      request.correlationId,
    );
  }

  @Get('beds/:bedId')
  @RequirePermissions(PERMISSION_KEYS.BEDS_VIEW)
  getBed(
    @Param('organizationId') organizationId: string,
    @Param('bedId') bedId: string,
    @CurrentActor() actor: AuthActor,
  ) {
    return this.beds.getBed(organizationId, actor.membershipId!, bedId);
  }

  @Patch('beds/:bedId')
  @RequirePermissions(PERMISSION_KEYS.BEDS_UPDATE)
  patchBed(
    @Param('organizationId') organizationId: string,
    @Param('bedId') bedId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = patchBedRequestSchema.parse(body);
    return this.beds.patchBed(
      organizationId,
      actor.membershipId!,
      actor.userId,
      bedId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Delete('beds/:bedId')
  @HttpCode(204)
  @RequirePermissions(PERMISSION_KEYS.BEDS_ARCHIVE)
  async archiveBed(
    @Param('organizationId') organizationId: string,
    @Param('bedId') bedId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
  ) {
    await this.beds.archiveBed(
      organizationId,
      actor.membershipId!,
      actor.userId,
      bedId,
      request.correlationId,
    );
  }

  @Get('amenities')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_VIEW)
  listAmenities(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = paginationQuerySchema.parse(query);
    return this.amenities.listAmenities(organizationId, {
      limit: parsed.limit,
      after: parsed.after,
      q: typeof query.q === 'string' ? query.q : undefined,
    });
  }

  @Post('amenities')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_UPDATE)
  createAmenity(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = createAmenityRequestSchema.parse(body);
    return this.amenities.createAmenity(
      organizationId,
      actor.userId,
      parsed,
      request.correlationId,
    );
  }

  @Put('properties/:propertyId/amenities')
  @RequirePermissions(PERMISSION_KEYS.PROPERTIES_UPDATE)
  replacePropertyAmenities(
    @Param('organizationId') organizationId: string,
    @Param('propertyId') propertyId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = replaceAmenitiesRequestSchema.parse(body);
    return this.amenities.replacePropertyAmenities(
      organizationId,
      actor.membershipId!,
      actor.userId,
      propertyId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Put('units/:unitId/amenities')
  @RequirePermissions(PERMISSION_KEYS.UNITS_UPDATE)
  replaceUnitAmenities(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() body: unknown,
  ) {
    const parsed = replaceAmenitiesRequestSchema.parse(body);
    return this.amenities.replaceUnitAmenities(
      organizationId,
      actor.membershipId!,
      actor.userId,
      unitId,
      parsed,
      requireIfMatchVersion(ifMatch),
      request.correlationId,
    );
  }

  @Get('availability')
  @RequirePermissions(PERMISSION_KEYS.OCCUPANCY_VIEW)
  listAvailability(
    @Param('organizationId') organizationId: string,
    @CurrentActor() actor: AuthActor,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = availabilityQuerySchema.parse(query);
    return this.availability.listAvailability(organizationId, actor.membershipId!, parsed);
  }
}
