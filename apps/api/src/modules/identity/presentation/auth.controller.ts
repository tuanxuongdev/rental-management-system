import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';

import {
  emailResendRequestSchema,
  emailVerifyRequestSchema,
  loginRequestSchema,
  logoutAllRequestSchema,
  mfaChallengeRequestSchema,
  organizationSwitchRequestSchema,
  passwordForgotRequestSchema,
  passwordResetRequestSchema,
} from '@rpm/contracts';

import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { Public } from '../../../common/auth/public.decorator';
import { AuthService } from '../application/auth.service';
import { MeService } from '../application/me.service';

import type { AuthActor } from '../../../common/auth/auth.types';
import type { RequestWithCorrelation } from '../../../common/context/correlation-id.middleware';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Req() request: RequestWithCorrelation,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    const parsed = loginRequestSchema.parse(body);
    const result = await this.authService.login(
      parsed,
      request as Request,
      response,
      request.correlationId,
    );
    return result;
  }

  @Public()
  @Post('mfa/challenge')
  async mfaChallenge(
    @Req() request: RequestWithCorrelation,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    const parsed = mfaChallengeRequestSchema.parse(body);
    return this.authService.completeMfaChallenge(
      parsed,
      request as Request,
      response,
      request.correlationId,
    );
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.refresh(request, response);
  }

  @Post('organization-switch')
  async switchOrganization(
    @CurrentActor() actor: AuthActor,
    @Req() request: RequestWithCorrelation,
    @Body() body: unknown,
  ) {
    const parsed = organizationSwitchRequestSchema.parse(body);
    return this.authService.switchOrganization(
      actor.userId,
      actor.sessionId,
      parsed.organizationId,
      request.correlationId,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @CurrentActor() actor: AuthActor,
  ): Promise<void> {
    await this.authService.logout(request, response, actor.userId, actor.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentActor() actor: AuthActor, @Body() body: unknown): Promise<void> {
    const parsed = logoutAllRequestSchema.parse(body);
    await this.authService.logoutAll(actor.userId, parsed, actor.sessionId);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Req() request: RequestWithCorrelation, @Body() body: unknown) {
    const parsed = passwordForgotRequestSchema.parse(body);
    return this.authService.forgotPassword(parsed, request.correlationId);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: unknown): Promise<void> {
    const parsed = passwordResetRequestSchema.parse(body);
    await this.authService.resetPassword(parsed);
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() body: unknown): Promise<void> {
    const parsed = emailVerifyRequestSchema.parse(body);
    await this.authService.verifyEmail(parsed);
  }

  @Public()
  @Post('email/verification/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Req() request: RequestWithCorrelation, @Body() body: unknown) {
    const parsed = emailResendRequestSchema.parse(body);
    return this.authService.resendVerification(parsed, request.correlationId);
  }
}

@Controller()
export class MeController {
  constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get('me')
  getMe(@CurrentActor() actor: AuthActor) {
    return this.meService.getMe(actor.userId, actor.sessionId);
  }
}
