import { Inject, Injectable } from '@nestjs/common';

import { REFRESH_COOKIE_NAME } from '@rpm/contracts';

import { API_CONFIG } from '../../bootstrap/api-config.module';

import type { ApiConfig } from '../../bootstrap/configuration';
import type { Request, Response } from 'express';

@Injectable()
export class RefreshCookieService {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  readRefreshToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE_NAME];
  }

  private cookieOptions(expires?: Date) {
    const secure =
      this.config.nodeEnv !== 'development' && this.config.nodeEnv !== 'test'
        ? true
        : this.config.auth.cookieSameSite === 'none';

    return {
      httpOnly: true,
      secure,
      sameSite: this.config.auth.cookieSameSite,
      path: this.config.auth.refreshCookiePath,
      ...(expires !== undefined ? { expires } : {}),
    };
  }

  setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE_NAME, token, this.cookieOptions(expiresAt));
  }

  clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }
}

export { REFRESH_COOKIE_NAME };
