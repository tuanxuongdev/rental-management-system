import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

import { API_CONFIG } from '../../bootstrap/api-config.module';

import type { ApiConfig } from '../../bootstrap/configuration';

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  org_id: string | null;
  membership_id: string | null;
  auth_time: number;
  amr: string[];
  acr: string;
  token_version: number;
};

@Injectable()
export class JwtService {
  private readonly secret: Uint8Array;

  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {
    this.secret = new TextEncoder().encode(config.auth.jwtSecret);
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = this.config.auth.accessTokenTtlSeconds;
    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({
      sid: claims.sid,
      org_id: claims.org_id,
      membership_id: claims.membership_id,
      auth_time: claims.auth_time,
      amr: claims.amr,
      acr: claims.acr,
      token_version: claims.token_version,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(this.config.auth.jwtIssuer)
      .setAudience(this.config.auth.jwtAudience)
      .setSubject(claims.sub)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .setJti(crypto.randomUUID())
      .sign(this.secret);

    return { token, expiresIn };
  }

  async verifyAccessToken(
    token: string,
  ): Promise<AccessTokenClaims & { exp: number; iat: number }> {
    const { payload } = await jwtVerify(token, this.secret, {
      issuer: this.config.auth.jwtIssuer,
      audience: this.config.auth.jwtAudience,
    });

    if (typeof payload.sub !== 'string') {
      throw new Error('Invalid token subject');
    }

    return {
      sub: payload.sub,
      sid: String(payload.sid ?? ''),
      org_id:
        payload.org_id === null || payload.org_id === undefined ? null : String(payload.org_id),
      membership_id:
        payload.membership_id === null || payload.membership_id === undefined
          ? null
          : String(payload.membership_id),
      auth_time: Number(payload.auth_time ?? payload.iat ?? 0),
      amr: Array.isArray(payload.amr) ? payload.amr.map(String) : ['pwd'],
      acr: String(payload.acr ?? '1'),
      token_version: Number(payload.token_version ?? 1),
      exp: Number(payload.exp ?? 0),
      iat: Number(payload.iat ?? 0),
    };
  }
}
